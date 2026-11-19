import { buildAuthGet, buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { requireEvmSigner } from "./ethers-wallet";
import { requestSignaturePostHeader, sessionBodyParams } from "./request-signature";
import { resolveReceiveAddressBoundAuth, resolveReceiveVaultRecoverAuth } from "./resolve-tx-auth";
import { broadcastSolanaTransaction, isSolanaChain } from "./solana-wallet";
import { isTronChain } from "./tron-wallet";
import type { Auth, TxSessionAuth, TxWallet } from "./types";

export type BoundReceiveRecord = {
  vaultAddress: string;
  expiry: string;
  network?: string;
  createBlockedUtxos?: boolean;
};

export const createBoundReceiveAddress = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  recipientAddress: string,
): Promise<BoundReceiveRecord> => {
  const txParams = { recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/receive-address-bound",
    txParams,
    () =>
      resolveReceiveAddressBoundAuth(
        wallet,
        session.sessionId,
        chainId,
        recipientAddress,
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; record: BoundReceiveRecord } | { error?: string }
  >("/receive-address-bound", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ??
        "Create bound receive address failed",
    );
  }

  return data.record;
};

const failed = (data: unknown, fallback: string) =>
  new Error((data as { error?: string }).error ?? fallback);

/** A plain (unbound) receive address: settles into the caller's own shielded balance. Always uses the
 *  session request signature, in both auth modes. */
export const createReceiveAddress = async (
  session: TxSessionAuth,
  chainId: number,
): Promise<BoundReceiveRecord> => {
  const body = { ...sessionBodyParams(session, chainId), forceFresh: true };
  const { res, data } = await enclaveFetch<
    { success: true; record: BoundReceiveRecord } | { error?: string }
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
export const fetchReceiveAddresses = async (auth: Auth): Promise<BoundReceiveRecord[]> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, "/receive-vault-account");
  const { res, data } = await enclaveFetch<
    { success: true; entries: BoundReceiveRecord[] } | { error?: string }
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
  const txParams = { vaultAddress, tokenAddress, recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/receive-vault-recover",
    txParams,
    () =>
      resolveReceiveVaultRecoverAuth(wallet, session.sessionId, chainId, vaultAddress, tokenAddress, recipientAddress),
  );
  const { res, data } = await enclaveFetch<
    { success: true; txData: { to: string; data: string } | string } | { error?: string }
  >("/receive-vault-recover", requestNonce, { method: "POST", headers, body: bodyJson });
  if (!res.ok || !("success" in data && data.success)) throw failed(data, "Recover failed");

  if (isSolanaChain(chainId)) {
    if (!wallet.solanaProvider) throw new Error("Solana provider not set");
    return broadcastSolanaTransaction(wallet.solanaProvider, data.txData as string);
  }
  if (isTronChain(chainId)) throw new Error("Tron recover broadcast is not wired in the demo app");
  const { to, data: callData } = data.txData as { to: string; data: string };
  const tx = await requireEvmSigner(wallet.signer).sendTransaction({ to, data: callData });
  return tx.hash;
};
