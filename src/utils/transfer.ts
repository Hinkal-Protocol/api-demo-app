import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import { buildTransferAuthFields, resolveTxAuthFields } from "./enclave-auth";
import type { TxSessionAuth } from "./types";
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
): Promise<string> => {
  const authFields = await resolveTxAuthFields(session, () => {
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

  const res = await fetch(`${API_BASE_URL}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; txHash: string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};
