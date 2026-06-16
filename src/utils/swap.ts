import { ERC20Token } from "../types";
import { buildAuthGet } from "./enclave-auth";
import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { ExternalActionId, getFeeStructure } from "./fees";
import { resolveSwapAuth } from "./resolve-tx-auth";
import { isSolanaChain } from "./solana-wallet";
import { Auth, TxSessionAuth, TxWallet } from "./types";

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
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, {
    inputTokenAddress,
    outputTokenAddress,
    amount,
    ...(slippagePercentage !== undefined
      ? { slippagePercentage: String(slippagePercentage) }
      : {}),
  });

  const { res, data } = await enclaveFetch<
    (SwapData & { success: true }) | { error?: string }
  >(`/get-swap-data?${queryString}`, requestNonce, { headers });

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
  wallet: TxWallet,
  session: TxSessionAuth,
  account: string,
  getterAuth: Auth,
  inToken: ERC20Token,
  outToken: ERC20Token,
  inAmount: string,
  quotedData: SwapData,
): Promise<string> => {
  const isSolana = isSolanaChain(getterAuth.chainId);
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

  const feeToken = isSolana
    ? outToken.erc20TokenAddress
    : inToken.erc20TokenAddress;

  const feeStructure = await getFeeStructure(
    getterAuth,
    feeToken,
    tokenAddresses,
    quotedData.externalActionId,
    HINKAL_SWAP_VARIABLE_RATE.toString(),
    isSolana ? [inAmountWei, -BigInt(quotedData.outSwapAmount)] : undefined,
    isSolana ? inToken.erc20TokenAddress : undefined,
  );

  const txParams: Record<string, unknown> = {
    tokenAddresses,
    amounts,
    externalActionId: quotedData.externalActionId,
    swapData: quotedData.swapData,
    ...(isSolana ? { feeStructure } : { feeToken, feeStructure }),
  };

  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    account,
    getterAuth.chainId,
    txParams,
    () =>
      resolveSwapAuth(
        wallet,
        session.sessionId,
        getterAuth.chainId,
        tokenAddresses,
        amounts,
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txHash: string } | { error?: string }
  >("/swap", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Swap failed");
  }

  return data.txHash;
};
