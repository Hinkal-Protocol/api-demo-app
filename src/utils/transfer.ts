import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { FeeStructure } from "./fees";
import { resolveTransferAuth } from "./resolve-tx-auth";
import type { TxSessionAuth, TxWallet } from "./types";

export const transfer = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const txParams = {
    tokenAddresses,
    amounts,
    recipientAddress,
    feeToken,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    account,
    chainId,
    txParams,
    () =>
      resolveTransferAuth(
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
  >("/transfer", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};
