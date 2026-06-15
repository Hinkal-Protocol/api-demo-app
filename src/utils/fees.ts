import { enclaveFetch } from "./enclaveApi";
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
  const { signature, sessionId, address, chainId } = auth;
  const requestNonce = crypto.randomUUID();
  const params = new URLSearchParams({
    signature,
    sessionId,
    nonce: requestNonce,
    timestamp: Date.now().toString(),
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

  const { res, data } = await enclaveFetch<
    | { success: true; feeStructure: FeeStructure }
    | { error?: string }
  >(`/get-fee-structure?${params}`, requestNonce);

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee structure fetch failed"
    );
  }

  return data.feeStructure;
};
