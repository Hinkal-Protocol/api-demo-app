import { arbitrum, mainnet, optimism, polygon, base } from "wagmi/chains";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.arc-testnet.caldera.xyz"] },
  },
});

export const SUPPORTED_CHAINS = [
  mainnet, // 1
  polygon, // 137
  arbitrum, // 42161
  optimism, // 10
  base, // 8453
  arcTestnet, // 5042002
] as const;

export const SUPPORTED_CHAIN_IDS: number[] = SUPPORTED_CHAINS.map(
  (chain) => chain.id
);
