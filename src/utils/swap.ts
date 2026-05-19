import { Auth } from "./types";
import { ExternalActionId, getFeeStructure } from "./fees";
import { API_BASE_URL } from "../constants/server.constants";
import { ERC20Token } from "../types";

export const HINKAL_SWAP_VARIABLE_RATE = 35n;

export type SwapData = {
  swapData: string;
  externalActionId: ExternalActionId;
  outSwapAmount: string;
};

export const getSwapData = async (
  auth: Auth,
  inputTokenAddress: string,
  outputTokenAddress: string,
  amount: string,
  slippagePercentage?: number,
): Promise<SwapData> => {
  const { signature, nonce, address, chainId } = auth;
  const body = {
    signature,
    nonce,
    address,
    chainId,
    inputTokenAddress,
    outputTokenAddress,
    amount,
    slippagePercentage,
  };

  const res = await fetch(`${API_BASE_URL}/get-swap-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | (SwapData & { success: true })
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Swap data fetch failed",
    );
  }

  return {
    swapData: data.swapData,
    externalActionId: data.externalActionId,
    outSwapAmount: data.outSwapAmount,
  };
};

export const executeSwap = async (
  auth: Auth,
  inToken: ERC20Token,
  outToken: ERC20Token,
  inAmount: string,
  quotedData: SwapData,
): Promise<string> => {
  const inAmountWei = BigInt(
    Math.floor(parseFloat(inAmount) * 10 ** inToken.decimals),
  );
  const outAmountWei = BigInt(quotedData.outSwapAmount);
  const outAdjusted =
    (outAmountWei * (10000n - HINKAL_SWAP_VARIABLE_RATE)) / 10000n;

  const feeStructure = await getFeeStructure(
    auth,
    inToken.erc20TokenAddress,
    [inToken.erc20TokenAddress, outToken.erc20TokenAddress],
    quotedData.externalActionId,
    HINKAL_SWAP_VARIABLE_RATE.toString(),
  );

  const res = await fetch(`${API_BASE_URL}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...auth,
      tokenAddresses: [inToken.erc20TokenAddress, outToken.erc20TokenAddress],
      amounts: [(-inAmountWei).toString(), outAdjusted.toString()],
      externalActionId: quotedData.externalActionId,
      swapData: quotedData.swapData,
      feeToken: inToken.erc20TokenAddress,
      feeStructure,
    }),
  });

  const data = (await res.json()) as
    | { success: true; txHash: string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Swap failed");
  }

  return data.txHash;
};
