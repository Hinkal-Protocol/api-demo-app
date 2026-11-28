import { ethers } from "ethers";
import type { Account, Chain, Client, Transport } from "viem";
import { getConnectorClient, switchChain } from "wagmi/actions";
import { TurnkeySigner } from "@turnkey/ethers";
import { getSigner } from "@dynamic-labs/ethers-v6";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import type { Wallet } from "@dynamic-labs/sdk-react-core";
import type { DfnsWallet } from "@dfns/lib-ethersjs6";
import { ERC20_ABI } from "../constants/erc20.constants";
import { zeroAddress } from "../constants";
import { networkRegistry } from "../constants/chain.constants";
import { wagmiConfig } from "../wagmi.config";
import { populateOpenfortGas } from "./openfort-gas";

export const requireEvmSigner = (
  signer: ethers.Signer | null | undefined,
): ethers.Signer => {
  if (!signer) throw new Error("EVM signer required");
  return signer;
};

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
  // Typed from TurnkeySigner itself: @turnkey/ethers pins its own
  // @turnkey/http version, so the top-level TurnkeyClient type doesn't match.
  client: ConstructorParameters<typeof TurnkeySigner>[0]["client"];
  organizationId: string;
  signWith: string;
}
let activeTurnkeyParams: TurnkeySignerParams | null = null;
export const setActiveTurnkeyParams = (
  params: TurnkeySignerParams | null,
): void => {
  activeTurnkeyParams = params;
};

let activeDynamicWallet: Wallet | null = null;
export const setActiveDynamicWallet = (wallet: Wallet | null): void => {
  activeDynamicWallet = wallet;
};

let activeDfnsWallet: DfnsWallet | null = null;
export const setActiveDfnsWallet = (wallet: DfnsWallet | null): void => {
  activeDfnsWallet = wallet;
};

type OpenfortProvider = {
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
};
let activeOpenfortProvider: OpenfortProvider | null = null;
export const setActiveOpenfort = (provider: OpenfortProvider | null): void => {
  activeOpenfortProvider = provider;
};
export const isOpenfortActive = (): boolean => activeOpenfortProvider !== null;

const buildOpenfortSigner = async (
  chainId: number,
): Promise<{ signer: ethers.Signer; address: string }> => {
  if (!activeOpenfortProvider) throw new Error("Openfort wallet not connected");
  await activeOpenfortProvider
    .request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
    .catch(() => {});
  const signer = await new ethers.BrowserProvider(
    activeOpenfortProvider as unknown as ethers.Eip1193Provider,
  ).getSigner();
  return { signer, address: await signer.getAddress() };
};

/**
 * ethers serializes the EIP-712 domain chainId to a hex string ("0xa"), which
 * Dynamic's WaaS signTypedData endpoint rejects (it requires a number). Route
 * signTypedData through Dynamic's viem walletClient, which keeps it numeric.
 */
const wrapDynamicSigner = (wallet: Wallet, signer: ethers.Signer) => {
  signer.signTypedData = async (domain, types, value) => {
    const nested = new Set(
      Object.values(types)
        .flat()
        .map((f) => f.type.replace(/\[\]$/, "")),
    );
    const primaryType = Object.keys(types).find((t) => !nested.has(t));
    if (!primaryType) throw new Error("Could not derive EIP-712 primaryType");
    const client = await (
      wallet as unknown as { getWalletClient: () => Promise<any> }
    ).getWalletClient();
    return client.signTypedData({
      account: await signer.getAddress(),
      domain,
      types,
      primaryType,
      message: value,
    });
  };
  return signer;
};

/**
 * DfnsWallet.signTypedData JSON-serializes the EIP-712 message, which throws on
 * BigInt values (chainId, amounts). Stringify BigInts before they reach it.
 */
const wrapDfnsSigner = (signer: ethers.Signer): ethers.Signer => {
  const orig = signer.signTypedData.bind(signer);
  signer.signTypedData = (domain, types, value) =>
    orig(
      domain,
      types,
      JSON.parse(
        JSON.stringify(value, (_, x) =>
          typeof x === "bigint" ? x.toString() : x,
        ),
      ),
    );
  return signer;
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
  if (activeOpenfortProvider) {
    const targetChainId = chainId ?? wagmiConfig.chains[0].id;
    const { signer } = await buildOpenfortSigner(targetChainId);
    return signer;
  }

  if (activeDfnsWallet) {
    const provider = getJsonRpcProvider(chainId ?? wagmiConfig.chains[0].id);
    return wrapDfnsSigner(
      activeDfnsWallet.connect(
        provider as unknown as Parameters<DfnsWallet["connect"]>[0],
      ) as unknown as ethers.Signer,
    );
  }

  if (activeDynamicWallet) {
    if (!isEthereumWallet(activeDynamicWallet)) {
      throw new Error("Connected Dynamic wallet is not an Ethereum wallet");
    }
    if (chainId && Number(await activeDynamicWallet.getNetwork()) !== chainId) {
      await activeDynamicWallet.switchNetwork(chainId);
    }
    return wrapDynamicSigner(
      activeDynamicWallet,
      await getSigner(activeDynamicWallet),
    );
  }

  if (activeTurnkeyParams) {
    const targetChainId = chainId ?? wagmiConfig.chains[0].id;
    const provider = getJsonRpcProvider(targetChainId);
    return new TurnkeySigner(activeTurnkeyParams, provider);
  }

  if (activePrivyWallet) {
    const provider = await activePrivyWallet.getEthereumProvider();
    if (chainId) {
      await (provider as ethers.Eip1193Provider).request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    }
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
  if (activeOpenfortProvider) return;
  if (activeDynamicWallet) {
    await activeDynamicWallet.switchNetwork(chainId);
    return;
  }
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

// Balance reads fire for every token in the list at once, so share one
// provider per chain: static network skips the eth_chainId probe per call.
const readProviders = new Map<number, ethers.JsonRpcProvider>();
const getReadProvider = (chainId: number): ethers.JsonRpcProvider => {
  let provider = readProviders.get(chainId);
  if (!provider) {
    const rpcUrl =
      networkRegistry[chainId]?.balanceRpcUrl ??
      networkRegistry[chainId]?.fetchRpcUrl;
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain ${chainId}`);
    }
    const request = new ethers.FetchRequest(rpcUrl);
    request.timeout = 20_000;
    provider = new ethers.JsonRpcProvider(request, chainId, {
      staticNetwork: true,
      batchMaxCount: 1,
    });
    readProviders.set(chainId, provider);
  }
  return provider;
};

export const getNativeBalance = async (
  chainId: number,
  address: string,
): Promise<bigint> => getReadProvider(chainId).getBalance(address);

export const getErc20Balance = async (
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> => {
  const contract = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    getReadProvider(chainId),
  );
  return contract.balanceOf(walletAddress);
};

// Multicall3 is deployed at this address on nearly every EVM chain.
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
  "function getEthBalance(address addr) view returns (uint256 balance)",
];
const MULTICALL_BATCH_SIZE = 500;
const multicall3Probes = new Map<number, Promise<boolean>>();

// Balances for a whole token list (same order) in one eth_call per 500
// tokens, or null when the chain has no Multicall3.
export const getEvmBalancesMulticall = async (
  chainId: number,
  tokenAddresses: string[],
  walletAddress: string,
): Promise<bigint[] | null> => {
  const provider = getReadProvider(chainId);
  let probe = multicall3Probes.get(chainId);
  if (!probe) {
    probe = provider.getCode(MULTICALL3_ADDRESS).then((code) => code !== "0x");
    probe.catch(() => multicall3Probes.delete(chainId)); // retry failed probes
    multicall3Probes.set(chainId, probe);
  }
  if (!(await probe)) return null;

  const multicall = new ethers.Contract(
    MULTICALL3_ADDRESS,
    MULTICALL3_ABI,
    provider,
  );
  const erc20 = new ethers.Interface(ERC20_ABI);
  const calls = tokenAddresses.map((address) =>
    address.toLowerCase() === zeroAddress
      ? {
          target: MULTICALL3_ADDRESS,
          allowFailure: true,
          callData: multicall.interface.encodeFunctionData("getEthBalance", [
            walletAddress,
          ]),
        }
      : {
          target: address.toLowerCase(), // skip checksum validation
          allowFailure: true,
          callData: erc20.encodeFunctionData("balanceOf", [walletAddress]),
        },
  );
  const requests: Promise<{ success: boolean; returnData: string }[]>[] = [];
  for (let i = 0; i < calls.length; i += MULTICALL_BATCH_SIZE) {
    requests.push(
      multicall.aggregate3.staticCall(calls.slice(i, i + MULTICALL_BATCH_SIZE)),
    );
  }
  // Reverted or empty balanceOf reads as 0, like the per-token path.
  return (await Promise.all(requests))
    .flat()
    .map(({ success, returnData }) =>
      success && returnData.length >= 66 ? BigInt(returnData.slice(0, 66)) : 0n,
    );
};

const sendViaWallet = async (
  signer: ethers.Signer,
  tx: { to: string; data?: string; value?: bigint },
): Promise<ethers.TransactionReceipt> => {
  const txRequest: ethers.TransactionRequest = {
    to: tx.to,
    data: tx.data ?? "0x",
    ...(tx.value && tx.value > 0n ? { value: tx.value } : {}),
  };

  if (activeOpenfortProvider) await populateOpenfortGas(signer, txRequest);

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
