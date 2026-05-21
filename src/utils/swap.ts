import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import { ERC20Token } from "../types";
import { buildSwapAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { ExternalActionId, getFeeStructure } from "./fees";
import { Auth, TxSessionAuth } from "./types";

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
  const params = new URLSearchParams({
    signature,
    nonce,
    address,
    chainId: String(chainId),
    inputTokenAddress,
    outputTokenAddress,
    amount,
  });
  if (slippagePercentage !== undefined) {
    params.append("slippagePercentage", String(slippagePercentage));
  }

  const res = await fetch(`${API_BASE_URL}/get-swap-data?${params}`);

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
  signer: ethers.Signer,
  session: TxSessionAuth,
  account: string,
  getterAuth: Auth,
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

  const tokenAddresses = [
    inToken.erc20TokenAddress,
    outToken.erc20TokenAddress,
  ];
  const amounts = [(-inAmountWei).toString(), outAdjusted.toString()];

  const feeStructure = await getFeeStructure(
    getterAuth,
    inToken.erc20TokenAddress,
    tokenAddresses,
    quotedData.externalActionId,
    HINKAL_SWAP_VARIABLE_RATE.toString(),
  );

  const authFields = await resolveTxAuthFields(session, () =>
    buildSwapAuthFields(signer, {
      chainId: getterAuth.chainId,
      tokenAddresses,
      amounts,
    }),
  );

  const res = await fetch(`${API_BASE_URL}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...authFields,
      address: account,
      chainId: getterAuth.chainId,
      tokenAddresses,
      amounts,
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
