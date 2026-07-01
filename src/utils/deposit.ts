import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { isValidPrivateAddress } from "./recipientAddress";
import { resolveDepositAuth, resolveDepositForOtherAuth } from "./resolve-tx-auth";
import { isSolanaChain } from "./solana-wallet";
import type { TxSessionAuth, TxWallet } from "./types";

export type TxData = {
  to: string;
  data: string;
  value?: string;
  from?: string;
  gasLimit?: string;
};

export const deposit = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData | string> => {
  const txParams = { tokenAddresses, amounts };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txParams,
    () =>
      resolveDepositAuth(wallet, session.sessionId, chainId, tokenAddresses, amounts),
  );

  const { res, data } = await enclaveFetch<
    | { success: true; txData: TxData | string }
    | { error?: string }
  >("/deposit", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};

export const depositForOther = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<TxData | string> => {
  const isPrivate = isValidPrivateAddress(recipient);
  const txParams = {
    tokenAddresses,
    amounts,
    ...(isPrivate ? { recipientInfo: recipient } : { recipientAddress: recipient }),
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txParams,
    () => resolveDepositForOtherAuth(wallet, session.sessionId, chainId, tokenAddresses, amounts, recipient),
  );

  const endpoint = isSolanaChain(chainId) ? "/deposit-solana-for-other" : "/deposit-for-other";

  const { res, data } = await enclaveFetch<
    | { success: true; txData: TxData | string }
    | { error?: string }
  >(endpoint, requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit for other failed");
  }

  return data.txData;
};
