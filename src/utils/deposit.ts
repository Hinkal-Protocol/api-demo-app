import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { resolveDepositAuth } from "./resolve-tx-auth";
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
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData | string> => {
  const txParams = { tokenAddresses, amounts };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    account,
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
