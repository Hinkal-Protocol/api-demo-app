import { Auth } from "./types";
import { FeeStructure } from "./fees";
import { API_BASE_URL } from "../constants/server.constants";

export const transfer = async (
  auth: Auth,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const { signature, nonce, address, chainId } = auth;
  const body = {
    signature,
    nonce,
    address,
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
