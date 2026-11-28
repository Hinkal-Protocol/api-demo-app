import { ReceiveVaultBlockedFund, ReceiveVaultRecord } from "../types";
import { ENCLAVE_SERVER_BASE_URL } from "../constants/server.constants";
import type { TxData } from "./deposit";
import { buildAuthGet, buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import {
  type Session,
  requestSignaturePostHeader,
  sessionBodyParams,
} from "./request-signature";
import { resolveReceiveVaultRecoverAuth } from "./resolve-tx-auth";
import type { Auth, TxSessionAuth, TxWallet } from "./types";

// EVM: transaction request, Tron: unsigned TronWeb transaction, Solana: base64 serialized transaction.
export type ReceiveVaultRecoverTxData = TxData | Record<string, unknown> | string;

export const createReceiveAddress = async (
  session: Session,
  chainId: number,
  forceFresh = false,
): Promise<ReceiveVaultRecord> => {
  const body = { ...sessionBodyParams(session, chainId), forceFresh };

  const { res, data } = await enclaveFetch<
    { success: true; record: ReceiveVaultRecord } | { error?: string }
  >("/receive-address", body.nonce, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await requestSignaturePostHeader(session, "/receive-address", body)),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Receive address creation failed",
    );
  }

  return data.record;
};

export const checkReceiveVaultAddress = async (
  vaultAddress: string,
): Promise<boolean> => {
  const res = await fetch(`${ENCLAVE_SERVER_BASE_URL}/receive-vault/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultAddress }),
  });
  const data: { isReceiveVault?: boolean; detail?: string } = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail ?? "Deposit address check failed");
  }

  return !!data.isReceiveVault;
};

// The account spans every network, but a fund can only be recovered on its own chain.
export const fetchReceiveVaultBlockedFunds = async (
  auth: Auth,
): Promise<ReceiveVaultBlockedFund[]> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(
    auth,
    "/receive-vault-account",
  );

  const { res, data } = await enclaveFetch<
    | { success: true; blockedFunds: ReceiveVaultBlockedFund[] }
    | { error?: string }
  >(`/receive-vault-account?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Receive vault account fetch failed",
    );
  }

  return data.blockedFunds.filter(
    (fund) => fund.token.chainId === auth.chainId,
  );
};

export const recoverReceiveVault = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  vaultAddress: string,
  tokenAddress: string,
  recipientAddress: string,
): Promise<ReceiveVaultRecoverTxData> => {
  const txParams = { vaultAddress, tokenAddress, recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/receive-vault-recover",
    txParams,
    () =>
      resolveReceiveVaultRecoverAuth(
        wallet,
        session.sessionId,
        chainId,
        vaultAddress,
        tokenAddress,
        recipientAddress,
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txData: ReceiveVaultRecoverTxData } | { error?: string }
  >("/receive-vault-recover", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Receive address recovery failed",
    );
  }

  return data.txData;
};
