import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import {
  resolveRecoverStuckBalanceAuth,
  resolveWithdrawAuth,
} from "./resolve-tx-auth";
import type { RecoverStuckBalanceParams, TxSessionAuth, TxWallet } from "./types";

/** utxo -> txHashes; bridge -> counts and amount; vault -> txData the caller's wallet broadcasts. */
export type RecoverStuckBalanceResult = {
  txHashes?: string[];
  recoveredCount?: number;
  recoveredAmount?: string;
  failedCount?: number;
  errors?: string[];
  txData?: { to: string; data: string } | string;
};

export const withdraw = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeAmount?: string,
  ref?: string,
): Promise<string> => {
  const txParams = {
    tokenAddresses,
    amounts,
    recipientAddress,
    feeToken,
    feeAmount,
    ref,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/withdraw",
    txParams,
    () =>
      resolveWithdrawAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
        feeToken,
        feeAmount,
        ref,
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txHash: string } | { error?: string }
  >("/withdraw", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Withdraw failed");
  }

  return data.txHash;
};

/** Recovers one token from one stuck source (utxo, bridge or vault) to recipientAddress. */
export const recoverStuckBalance = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  params: RecoverStuckBalanceParams,
): Promise<RecoverStuckBalanceResult> => {
  const { vaultAddress, ...rest } = params;
  // The enclave rejects vaultAddress on any kind but vault.
  const txParams = { ...rest, ...(vaultAddress && { vaultAddress }) };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/recover-stuck-balance",
    txParams,
    () => resolveRecoverStuckBalanceAuth(wallet, session.sessionId, chainId, params),
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & RecoverStuckBalanceResult) | { error?: string }
  >("/recover-stuck-balance", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Recover stuck balance failed");
  }

  return data;
};
