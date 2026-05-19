import { API_BASE_URL } from "../constants/server.constants";
import { Auth } from "./types";

export enum ExternalActionId {
  Transact = "Transact",
  Uniswap = "Uniswap",
  Odos = "Odos",
  OneInch = "OneInch",
  Lifi = "Lifi",
  Okx = "Okx",
  Emporium = "Emporium",
  Wallet = "Wallet",
}

export type FeeStructure = {
  feeToken: string;
  flatFee: string;
  variableRate: string;
};

export const getFeeStructure = async (
  auth: Auth,
  feeToken: string,
  tokenAddresses: string[],
  externalActionId: ExternalActionId,
  variableRate?: string,
): Promise<FeeStructure> => {
  const { signature, nonce, address, chainId } = auth;
  const body = {
    signature,
    nonce,
    address,
    chainId,
    feeToken,
    tokenAddresses,
    externalActionId,
    variableRate,
  };

  const res = await fetch(`${API_BASE_URL}/get-fee-structure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; feeStructure: FeeStructure }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee structure fetch failed",
    );
  }

  return data.feeStructure;
};
