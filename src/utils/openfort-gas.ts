import { ethers } from "ethers";
import { networkRegistry } from "../constants/chain.constants";

const getJsonRpcProvider = (chainId: number): ethers.JsonRpcProvider => {
  const rpcUrl = networkRegistry[chainId]?.fetchRpcUrl;
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
};

/**
 * Openfort routes eth_estimateGas to its backend, which 400s for EOA wallets.
 * Pre-fill gas/fees/nonce from our own RPC so ethers skips estimation; Openfort's
 * EOA path then just signs locally and broadcasts.
 */
export const populateOpenfortGas = async (
  signer: ethers.Signer,
  txRequest: ethers.TransactionRequest,
): Promise<void> => {
  const from = await signer.getAddress();
  const { chainId } = await signer.provider!.getNetwork();
  const rpc = getJsonRpcProvider(Number(chainId));
  const [gasLimit, feeData, nonce] = await Promise.all([
    rpc.estimateGas({
      from,
      to: txRequest.to ?? undefined,
      data: txRequest.data,
      value: txRequest.value,
    }),
    rpc.getFeeData(),
    rpc.getTransactionCount(from, "pending"),
  ]);
  txRequest.gasLimit = (gasLimit * 12n) / 10n; // 20% headroom
  txRequest.nonce = nonce;
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    txRequest.maxFeePerGas = feeData.maxFeePerGas;
    txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  } else if (feeData.gasPrice) {
    txRequest.gasPrice = feeData.gasPrice;
  }
};
