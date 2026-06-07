import { ethers } from "ethers";
import type { Account, Chain, Client, Transport } from "viem";
import { getConnectorClient, switchChain } from "wagmi/actions";
import { TurnkeySigner } from "@turnkey/ethers";
import type { TurnkeyClient } from "@turnkey/http";
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

interface TurnkeySignerParams {
  client: TurnkeyClient;
  organizationId: string;
  signWith: string;
}
let activeTurnkeyParams: TurnkeySignerParams | null = null;
export const setActiveTurnkeyParams = (
  params: TurnkeySignerParams | null,
): void => {
  activeTurnkeyParams = params;
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
): Promise<ethers.Signer> => {
  if (activeTurnkeyParams) {
    const targetChainId = chainId ?? wagmiConfig.chains[0].id;
    const provider = getJsonRpcProvider(targetChainId);
    return new TurnkeySigner(activeTurnkeyParams, provider);
  }

  if (activePrivyWallet) {
    if (chainId) await activePrivyWallet.switchChain(chainId);
    const provider = await activePrivyWallet.getEthereumProvider();
    const browserProvider = new ethers.BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const signerAddress = await signer.getAddress();
    if (
      signerAddress.toLowerCase() !== activePrivyWallet.address.toLowerCase()
    ) {
      throw new Error(
        `Wallet mismatch: expected ${activePrivyWallet.address}, got ${signerAddress}. Disable other wallet extensions and reconnect.`,
      );
    }
    return signer;
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

export const switchActiveWalletChain = async (
  chainId: number,
): Promise<void> => {
  if (activeTurnkeyParams) return;
  if (activePrivyWallet) {
    await activePrivyWallet.switchChain(chainId);
    return;
  }
  await switchChain(wagmiConfig, { chainId: chainId as any });
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
  signer: ethers.Signer,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> => {
  const txRequest = {
    to: tx.to,
    data: tx.data ?? "0x",
    ...(tx.value && tx.value > 0n ? { value: tx.value } : {}),
  };
  const hash = (signer as any).sendUncheckedTransaction
    ? await (signer as ethers.JsonRpcSigner).sendUncheckedTransaction(txRequest)
    : (await signer.sendTransaction(txRequest)).hash;
  const { chainId } = await signer.provider!.getNetwork();
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
  signer: ethers.Signer,
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
  signer: ethers.Signer,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> => sendViaWallet(signer, tx);

export const broadcastDepositTx = async (
  signer: ethers.Signer,
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
