import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { FeeStructure } from "./fees";
import {
  resolveWithdrawAuth,
  resolveWithdrawStuckUtxosAuth,
} from "./resolve-tx-auth";
import type { TxSessionAuth, TxWallet } from "./types";

export const withdraw = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  isRelayerOff?: boolean,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const txParams = {
    tokenAddresses,
    amounts,
    recipientAddress,
    isRelayerOff,
    feeToken,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    account,
    chainId,
    txParams,
    () =>
      resolveWithdrawAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
      ),
  );

  const { res, data } = await enclaveFetch<
    | { success: true; txHash: string }
    | { error?: string }
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
  account: string,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<string[]> => {
  const txParams = { tokenAddress, recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    account,
    chainId,
    txParams,
    () =>
      resolveWithdrawStuckUtxosAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddress,
        recipientAddress,
      ),
  );

  const { res, data } = await enclaveFetch<
    | { success: true; txHashes: string[] }
    | { error?: string }
  >("/withdraw-stuck-utxos", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Withdraw stuck UTXOs failed",
    );
  }

  return data.txHashes;
};
