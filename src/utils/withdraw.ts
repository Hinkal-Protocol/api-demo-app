import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import {
  resolveWithdrawAuth,
  resolveWithdrawStuckUtxosAuth,
  resolveRecoverStuckBridgeBalanceAuth,
} from "./resolve-tx-auth";
import type { TxSessionAuth, TxWallet } from "./types";

export const withdraw = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeAmount?: string,
  ref?: string
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
        ref
      )
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

export const withdrawStuckUtxos = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string
): Promise<string[]> => {
  const txParams = { tokenAddress, recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/withdraw-stuck-utxos",
    txParams,
    () =>
      resolveWithdrawStuckUtxosAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddress,
        recipientAddress
      )
  );

  const { res, data } = await enclaveFetch<
    { success: true; txHashes: string[] } | { error?: string }
  >("/withdraw-stuck-utxos", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Withdraw stuck UTXOs failed"
    );
  }

  return data.txHashes;
};

export const recoverStuckBridgeBalance = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string
): Promise<number> => {
  const txParams = { tokenAddress, recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/recover-stuck-bridge-balance",
    txParams,
    () =>
      resolveRecoverStuckBridgeBalanceAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddress,
        recipientAddress
      )
  );

  const { res, data } = await enclaveFetch<
    { success: true; recoveredCount: number } | { error?: string }
  >("/recover-stuck-bridge-balance", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Recover failed");
  }

  return data.recoveredCount;
};
