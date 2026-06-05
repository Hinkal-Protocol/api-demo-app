import { ethers } from "ethers";
import type { Account, Chain, Client, Transport } from "viem";
import { getConnectorClient, switchChain } from "wagmi/actions";
import { ERC20_ABI } from "../constants/erc20.constants";
import { networkRegistry } from "../constants/chain.constants";
import { wagmiConfig } from "../wagmi.config";

export interface PrivyEvmWallet {
  address: string;
  switchChain: (chainId: number | `0x${string}`) => Promise<void>;
  getEthereumProvider: () => Promise<ethers.Eip1193Provider>;
}

let activePrivyWallet: PrivyEvmWallet | null = null;

export const setActivePrivyWallet = (wallet: PrivyEvmWallet | null): void => {
  activePrivyWallet = wallet;
};

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

export const getEthersSigner = async (
  chainId?: number,
): Promise<ethers.JsonRpcSigner> => {
  if (activePrivyWallet) {
    if (chainId) await activePrivyWallet.switchChain(chainId);
    const provider = await activePrivyWallet.getEthereumProvider();
    const browserProvider = new ethers.BrowserProvider(provider);
    return browserProvider.getSigner();
  }

  if (chainId) {
    try {
      await switchChain(wagmiConfig, { chainId: chainId as any });
    } catch (err) {
      console.error("switchChain in getEthersSigner failed", err);
    }
  }
  const client = await getConnectorClient(
    wagmiConfig,
    chainId ? { chainId: chainId as any, assertChainId: false } : undefined,
  );
  return clientToSigner(client);
};

export const getJsonRpcProvider = (chainId: number): ethers.JsonRpcProvider => {
  const rpcUrl = networkRegistry[chainId]?.fetchRpcUrl;
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
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

const sendViaWallet = async (
  signer: ethers.JsonRpcSigner,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> => {
  const hash = await signer.sendUncheckedTransaction({
    to: tx.to,
    data: tx.data ?? "0x",
    ...(tx.value && tx.value > 0n ? { value: tx.value } : {}),
  });
  const { chainId } = await signer.provider.getNetwork();
  const receipt = await getJsonRpcProvider(Number(chainId)).waitForTransaction(
    hash,
    1,
    180_000,
  );
  if (!receipt) throw new Error("Transaction failed");
  if (receipt.status === 0) throw new Error(`Transaction reverted: ${hash}`);
  return receipt;
};

export const approveErc20 = async (
  signer: ethers.JsonRpcSigner,
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Promise<ethers.TransactionReceipt> =>
  sendViaWallet(signer, {
    to: tokenAddress,
    data: new ethers.Interface(ERC20_ABI).encodeFunctionData("approve", [
      spender,
      amount,
    ]),
  });

export const sendTx = async (
  signer: ethers.JsonRpcSigner,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> => sendViaWallet(signer, tx);

export const broadcastDepositTx = async (
  signer: ethers.JsonRpcSigner,
  serializedTxBase64: string,
): Promise<ethers.TransactionReceipt> => {
  const rlpHex = ethers.hexlify(ethers.decodeBase64(serializedTxBase64));
  const parsedTx = ethers.Transaction.from(rlpHex);
  return sendViaWallet(signer, {
    to: parsedTx.to!,
    data: parsedTx.data,
    value: parsedTx.value ?? undefined,
  });
};
