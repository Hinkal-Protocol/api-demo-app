import {
  arbitrum,
  mainnet,
  optimism,
  polygon,
  base,
  sepolia,
  tempoMainnet,
} from "wagmi/chains";
import { defineChain } from "viem";

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.arc.io"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://explorer.arc.io" },
  },
});

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
});

export const SUPPORTED_CHAINS = [
  mainnet, // 1
  polygon, // 137
  arbitrum, // 42161
  optimism, // 10
  base, // 8453
  tempoMainnet, // 4217
  arcMainnet, // 5042
  arcTestnet, // 5042002
  sepolia, // 11155111
] as const;

export const SUPPORTED_CHAIN_IDS: number[] = SUPPORTED_CHAINS.map(
  (chain) => chain.id,
);
