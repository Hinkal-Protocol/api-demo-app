import { ethers } from "ethers";
import { ENCLAVE_TRANSACTION_NAMES } from "../constants/enclave.constants";
import { API_BASE_URL } from "../constants/server.constants";
import { buildTokenTransferAuthFields } from "./enclave-auth";
import { FeeStructure } from "./fees";

export const withdraw = async (
  signer: ethers.Signer,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  isRelayerOff?: boolean,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const authFields = await buildTokenTransferAuthFields(
    signer,
    ENCLAVE_TRANSACTION_NAMES.withdraw,
    {
      chainId,
      tokenAddresses,
      amounts,
      recipient: recipientAddress,
    },
  );
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
    recipientAddress,
    isRelayerOff,
    feeToken,
    feeStructure,
  };

  const res = await fetch(`${API_BASE_URL}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; txHash: string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Withdraw failed");
  }

  return data.txHash;
};
