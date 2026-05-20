import { ethers } from "ethers";
import type { Account, Chain, Client, Transport } from "viem";
import { getConnectorClient } from "wagmi/actions";
import { ERC20_ABI } from "../constants/erc20.constants";
import { networkRegistry } from "../constants/chain.constants";
import { wagmiConfig } from "../wagmi.config";

const clientToSigner = (
  client: Client<Transport, Chain, Account>,
): ethers.JsonRpcSigner => {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.BrowserProvider(transport, network);
  return new ethers.JsonRpcSigner(provider, account.address);
};

export const getEthersSigner = async (): Promise<ethers.JsonRpcSigner> => {
  const client = await getConnectorClient(wagmiConfig);
  return clientToSigner(client);
};

export const getJsonRpcProvider = (chainId: number): ethers.JsonRpcProvider => {
  const rpcUrl = networkRegistry[chainId]?.fetchRpcUrl;
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
};

export const waitForTx = async (
  tx: ethers.TransactionResponse,
): Promise<ethers.TransactionReceipt> => {
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction failed");
  return receipt;
};

export const getNativeBalance = async (
  chainId: number,
  address: string,
): Promise<bigint> => getJsonRpcProvider(chainId).getBalance(address);

export const getErc20Balance = async (
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> => {
  const contract = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    getJsonRpcProvider(chainId),
  );
  return contract.balanceOf(walletAddress);
};

export const approveErc20 = async (
  signer: ethers.Signer,
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Promise<ethers.TransactionReceipt> => {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  return waitForTx(await contract.approve(spender, amount));
};

export const sendTx = async (
  signer: ethers.Signer,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> =>
  waitForTx(
    await signer.sendTransaction({
      to: tx.to,
      data: tx.data ?? "0x",
      value: tx.value ?? 0n,
    }),
  );
