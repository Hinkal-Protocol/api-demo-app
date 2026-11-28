import { buildAuthGet, buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { requireEvmSigner } from "./ethers-wallet";
import { requestSignaturePostHeader, sessionBodyParams } from "./request-signature";
import { resolveTransferAddressAuth } from "./resolve-tx-auth";
import { recoverStuckBalance } from "./withdraw";
import { broadcastSolanaTransaction, isSolanaChain, signSolanaMessage } from "./solana-wallet";
import { broadcastRawTronTx, getTronWeb, isTronChain } from "./tron-wallet";
import { getEnclaveTypedDataDomain, getTypesForPrimary } from "../constants/enclave.constants";
import type { Auth, ReceiveVaultNetwork, TransferBridgeParams, TxSessionAuth, TxWallet } from "./types";

export type ReceiveAddressRecord = {
  vaultAddress: string;
  expiry: string;
  network?: string;
  recipientAddress?: string; // set only on a transfer address
  destinationChainId?: number;
  destinationTokenAddress?: string;
};

export const createTransferAddress = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  recipientAddress: string,
  bridge?: TransferBridgeParams,
): Promise<ReceiveAddressRecord> => {
  const txParams = { recipientAddress, ...bridge };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/receive-address",
    txParams,
    () =>
      resolveTransferAddressAuth(
        wallet,
        session.sessionId,
        chainId,
        recipientAddress,
        bridge,
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; record: ReceiveAddressRecord } | { error?: string }
  >("/receive-address", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ??
        "Create transfer address failed",
    );
  }

  return data.record;
};

/** Same as createTransferAddress, but no session or signature: enclaveFetch sends VITE_PARTNER_API_KEY,
 *  and each address gets its own fresh account. Takes a network: one address serves all its chains. */
export const createTransferAddressWithApiKey = async (
  network: ReceiveVaultNetwork,
  recipientAddress: string,
  refundTo: string,
  bridge?: TransferBridgeParams,
): Promise<{ record: ReceiveAddressRecord; acceptedChainIds: number[] }> => {
  const { res, data } = await enclaveFetch<
    { success: true; record: ReceiveAddressRecord; acceptedChainIds: number[] } | { error?: string }
  >("/partner/transfer-address", undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ networkType: network, recipientAddress, refundTo, ...bridge }),
  });
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Create transfer address failed");
  return data;
};

export type RefundToChainStuck = {
  chainId: number;
  balances: { tokenAddress: string; balance: string; sources: { kind: string; amount: string }[] }[];
  error?: string;
};

/** What is stuck, per chain and summed over every address, for this partner's API-key addresses refunding to refundTo. */
export const fetchRefundToStuckBalances = async (refundTo: string): Promise<RefundToChainStuck[]> => {
  const { res, data } = await enclaveFetch<{ success: true; chains: RefundToChainStuck[] } | { error?: string }>(
    `/partner/transfer-address/stuck-balances?refundTo=${encodeURIComponent(refundTo)}`,
    undefined,
  );
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Fetch stuck balances failed");
  return data.chains;
};

export type RefundToRecoverResult = {
  txHashes?: string[];
  recoveredCount?: number;
  recoveredAmount?: string;
  errors?: string[];
  txData?: unknown;
  error?: string;
};

/** Signs as the refundTo wallet. Solana signs a text message, EVM and Tron EIP-712. */
const signRefundToRecover = async (
  wallet: TxWallet,
  fields: { refundTo: string; chainId: number; tokenAddress: string; kind: string; nonce: string; timestamp: number },
): Promise<string> => {
  if (isSolanaChain(fields.chainId)) {
    if (!wallet.solanaProvider) throw new Error("Solana provider not set");
    const message =
      `Hinkal Enclave\n\nPrimary Type: RefundToRecover\nChain ID: ${fields.chainId}` +
      `\nRefund To: ${fields.refundTo}\nToken Address: ${fields.tokenAddress}` +
      `\nKind: ${fields.kind}\nNonce: ${fields.nonce}\nTimestamp: ${fields.timestamp}`;
    return signSolanaMessage(wallet.solanaProvider, message);
  }
  const domain = getEnclaveTypedDataDomain(fields.chainId);
  const types = getTypesForPrimary("RefundToRecover", fields);
  if (isTronChain(fields.chainId)) return getTronWeb().trx._signTypedData(domain, types, fields);
  return requireEvmSigner(wallet.signer).signTypedData(domain, types, fields);
};

/** Recovers one token and kind to refundTo from every API-key address refunding to it. The connected wallet must
 *  be refundTo: it signs, and it sends any vault txData itself. */
export const recoverRefundToStuck = async (
  wallet: TxWallet,
  refundTo: string,
  chainId: number,
  tokenAddress: string,
  kind: string,
): Promise<{ results: RefundToRecoverResult[]; sentTxHashes: string[] }> => {
  const fields = {
    refundTo,
    chainId,
    tokenAddress,
    kind,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const signature = await signRefundToRecover(wallet, fields);
  const { res, data } = await enclaveFetch<{ success: true; results: RefundToRecoverResult[] } | { error?: string }>(
    "/partner/transfer-address/recover",
    undefined,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, signature }),
    },
  );
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Recover failed");

  // One at a time: every vault tx comes from the same wallet.
  const sentTxHashes = await data.results.reduce<Promise<string[]>>(async (previous, { txData }) => {
    const hashes = await previous;
    return txData ? [...hashes, await sendRecoverTxData(wallet, chainId, txData)] : hashes;
  }, Promise.resolve([]));
  return { results: data.results, sentTxHashes };
};

/** Broadcasts a vault recover's txData from the connected wallet, which pays the gas. */
const sendRecoverTxData = async (wallet: TxWallet, chainId: number, txData: unknown): Promise<string> => {
  if (isSolanaChain(chainId)) {
    if (!wallet.solanaProvider) throw new Error("Solana provider not set");
    return broadcastSolanaTransaction(wallet.solanaProvider, txData as string);
  }
  if (isTronChain(chainId)) return broadcastRawTronTx(txData);
  const { to, data: callData } = txData as { to: string; data: string };
  const tx = await requireEvmSigner(wallet.signer).sendTransaction({ to, data: callData });
  return tx.hash;
};

const failed = (data: unknown, fallback: string) =>
  new Error((data as { error?: string }).error ?? fallback);

/** A plain receive address: settles into the caller's own shielded balance. Always uses the
 *  session request signature, in both auth modes. */
export const createReceiveAddress = async (
  session: TxSessionAuth,
  chainId: number,
): Promise<ReceiveAddressRecord> => {
  const body = { ...sessionBodyParams(session, chainId), forceFresh: true };
  const { res, data } = await enclaveFetch<
    { success: true; record: ReceiveAddressRecord } | { error?: string }
  >("/receive-address", body.nonce, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await requestSignaturePostHeader(session, "/receive-address", body)),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Create receive address failed");
  return data.record;
};

/** Every receive address this account created on auth.chainId, so they can be recovered after a reload. */
export const fetchReceiveAddresses = async (auth: Auth): Promise<ReceiveAddressRecord[]> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, "/receive-vault-account");
  const { res, data } = await enclaveFetch<
    { success: true; entries: ReceiveAddressRecord[] } | { error?: string }
  >(`/receive-vault-account?${queryString}`, requestNonce, { headers });
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Fetch receive addresses failed");
  // The account spans every network; keep the ones this chain can see.
  const network = isSolanaChain(auth.chainId) ? "solana" : isTronChain(auth.chainId) ? "tron" : "evm";
  return data.entries.filter((entry) => entry.network === network);
};

/** Sweeps a token out of a receive address to recipientAddress; the caller's wallet broadcasts and pays gas. */
export const recoverReceiveVault = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  vaultAddress: string,
  tokenAddress: string,
  recipientAddress: string,
): Promise<string> => {
  const { txData } = await recoverStuckBalance(wallet, session, chainId, {
    tokenAddress,
    recipientAddress,
    kind: "vault",
    vaultAddress,
  });
  if (!txData) throw new Error("Recover returned no txData");
  return sendRecoverTxData(wallet, chainId, txData);
};
