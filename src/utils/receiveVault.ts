import { ReceiveVaultAccount, ReceiveVaultRecord } from "../types";
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

export type RecoverTxData = TxData | Record<string, unknown>;

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

export const fetchReceiveVaultAccount = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<ReceiveVaultAccount> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(
    auth,
    "/receive-vault-account",
  );

  const { res, data } = await enclaveFetch<
    (ReceiveVaultAccount & { success: true }) | { error?: string }
  >(`/receive-vault-account?${queryString}`, requestNonce, { signal, headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Receive vault account fetch failed",
    );
  }

  return { entries: data.entries, blockedFunds: data.blockedFunds };
};

export const recoverReceiveVault = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  vaultAddress: string,
  tokenAddress: string,
  recipientAddress: string,
): Promise<RecoverTxData> => {
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
    { success: true; txData: RecoverTxData } | { error?: string }
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
