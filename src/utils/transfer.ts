import { ethers } from "ethers";
import { buildTransferAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import type { EnclaveAuthFields, TxSessionAuth } from "./types";
import { FeeStructure } from "./fees";

export const transfer = async (
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
  buildReadOnlyAuth?: () => Promise<EnclaveAuthFields>,
): Promise<string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
    if (!signer) throw new Error("EVM signer required for transfer without write-access session");
    return buildTransferAuthFields(signer, { chainId, tokenAddresses, amounts, recipient: recipientAddress });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
    recipientAddress,
    feeToken,
    feeStructure,
  };

  const { res, data } = await enclaveFetch<
    | { success: true; txHash: string }
    | { error?: string }
  >("/transfer", authFields.nonce, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};
