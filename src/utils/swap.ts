import { ethers } from "ethers";
import { ERC20Token } from "../types";
import { buildSwapAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { buildSolanaSwapAuthFields } from "./solana-auth";
import { enclaveFetch } from "./enclaveApi";
import { ExternalActionId, getFeeStructure } from "./fees";
import type { SolanaWalletProvider } from "./solana-wallet";
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
  const { signature, sessionId, address, chainId } = auth;
  const requestNonce = crypto.randomUUID();
  const params = new URLSearchParams({
    signature,
    sessionId,
    nonce: requestNonce,
    timestamp: Date.now().toString(),
    address,
    chainId: String(chainId),
    inputTokenAddress,
    outputTokenAddress,
    amount,
  });
  if (slippagePercentage !== undefined) {
    params.append("slippagePercentage", String(slippagePercentage));
  }

  const { res, data } = await enclaveFetch<
    (SwapData & { success: true }) | { error?: string }
  >(`/get-swap-data?${params}`, requestNonce);

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
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  getterAuth: Auth,
  inToken: ERC20Token,
  outToken: ERC20Token,
  inAmount: string,
  quotedData: SwapData,
  solanaProvider?: SolanaWalletProvider,
): Promise<string> => {
  const isSolana = !!solanaProvider;
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

  const authFields = await resolveTxAuthFields(session, async () => {
    if (isSolana) {
      return buildSolanaSwapAuthFields(
        session,
        solanaProvider,
        getterAuth.chainId,
        tokenAddresses,
        amounts,
      );
    }
    if (!signer)
      throw new Error(
        "EVM signer required for swap without write-access session",
      );
    return buildSwapAuthFields(session, signer, {
      chainId: getterAuth.chainId,
      tokenAddresses,
      amounts,
    });
  });

  const swapBody: Record<string, unknown> = {
    ...authFields,
    address: account,
    chainId: getterAuth.chainId,
    tokenAddresses,
    amounts,
    externalActionId: quotedData.externalActionId,
    swapData: quotedData.swapData,
    ...(isSolana ? { feeStructure } : { feeToken, feeStructure }),
  };

  const { res, data } = await enclaveFetch<
    { success: true; txHash: string } | { error?: string }
  >("/swap", authFields.nonce, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(swapBody),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Swap failed");
  }

  return data.txHash;
};
