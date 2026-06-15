import { buildAuthGet } from "./hmac";
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
  mintFrom?: string,
): Promise<FeeStructure> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, {
    feeToken,
    externalActionId,
    tokenAddresses,
    ...(variableRate !== undefined ? { variableRate } : {}),
    ...(mintFrom !== undefined ? { mintFrom } : {}),
    ...(amounts !== undefined
      ? { amounts: amounts.map((amount) => amount.toString()) }
      : {}),
  });

  const { res, data } = await enclaveFetch<
    | { success: true; feeStructure: FeeStructure }
    | { error?: string }
  >(`/get-fee-structure?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee structure fetch failed",
    );
  }

  return data.feeStructure;
};
