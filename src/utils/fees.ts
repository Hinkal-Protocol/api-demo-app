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

export const getFeeAmount = (feeStructure?: FeeStructure): bigint =>
  feeStructure ? BigInt(feeStructure.flatFee) : 0n;

export const getFeeStructure = async (
  auth: Auth,
  feeToken: string,
  tokenAddresses: string[],
  externalActionId: ExternalActionId,
  variableRate?: string,
  amounts?: bigint[],
  mintFrom?: string
): Promise<FeeStructure> => {
  const { signature, nonce, address, chainId } = auth;
  const params = new URLSearchParams({
    signature,
    nonce,
    address,
    chainId: String(chainId),
    feeToken,
    externalActionId,
  });
  for (const tokenAddress of tokenAddresses) {
    params.append("tokenAddresses", tokenAddress);
  }
  if (variableRate !== undefined) {
    params.append("variableRate", variableRate);
  }
  if (amounts !== undefined) {
    for (const amount of amounts) {
      params.append("amounts", amount.toString());
    }
  }
  if (mintFrom !== undefined) {
    params.append("mintFrom", mintFrom);
  }

  const res = await fetch(`${API_BASE_URL}/get-fee-structure?${params}`);

  const data = (await res.json()) as
    | { success: true; feeStructure: FeeStructure }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee structure fetch failed"
    );
  }

  return data.feeStructure;
};
