import { buildAuthGet } from "./enclave-auth";
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

export const getFeeAmount = (feeAmount?: string): bigint =>
  feeAmount ? BigInt(feeAmount) : 0n;

export const getFee = async (
  auth: Auth,
  feeToken: string,
  tokenAddresses: string[],
  externalActionId: ExternalActionId,
  amounts?: bigint[],
  mintFrom?: string,
): Promise<string> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, "/get-fee", {
    feeToken,
    externalActionId,
    tokenAddresses,
    ...(mintFrom !== undefined ? { mintFrom } : {}),
    ...(amounts !== undefined
      ? { amounts: amounts.map((amount) => amount.toString()) }
      : {}),
  });

  const { res, data } = await enclaveFetch<
    { success: true; feeAmount: string } | { error?: string }
  >(`/get-fee?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee fetch failed",
    );
  }

  return data.feeAmount;
};
