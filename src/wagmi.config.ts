import { http, createConfig } from "wagmi";
import { metaMask, walletConnect } from "wagmi/connectors";
import { SUPPORTED_CHAINS } from "./constants/supported-chain-ids.constants";
import { networkRegistry } from "./constants/chain.constants";

const createWagmiConfig = () => {
  const transports = SUPPORTED_CHAINS.reduce((acc, chain) => {
    // Use our configured (Alchemy) RPC instead of viem's public default
    // (e.g. mainnet's https://eth.merkle.io, which rate-limits / CORS-fails).
    const rpcUrl = networkRegistry[chain.id]?.fetchRpcUrl;
    acc[chain.id] = rpcUrl ? http(rpcUrl) : http();
    return acc;
  }, {} as Record<number, ReturnType<typeof http>>);

  return createConfig({
    chains: SUPPORTED_CHAINS,
    connectors: [
      metaMask(),
      walletConnect({ projectId: "6c5e68094017e64428795a28e4c6aef1" }),
    ],
    transports,
  });
};

export const wagmiConfig = createWagmiConfig();

export const getWagmiConfig = () => wagmiConfig;
