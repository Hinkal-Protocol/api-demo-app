import {
  mergeNetworks,
  type DynamicContextProps,
} from "@dynamic-labs/sdk-react-core";
import { SUPPORTED_CHAINS } from "./supported-chain-ids.constants";
import { networkRegistry } from "./chain.constants";
import { DYNAMIC_ENVIRONMENT_ID } from "../constants";

const dynamicEvmNetworks = SUPPORTED_CHAINS.filter(
  (chain) => networkRegistry[chain.id]?.fetchRpcUrl,
).map((chain) => ({
  chainId: chain.id,
  networkId: chain.id,
  name: chain.name,
  nativeCurrency: chain.nativeCurrency,
  rpcUrls: [networkRegistry[chain.id].fetchRpcUrl],
  blockExplorerUrls: chain.blockExplorers
    ? [chain.blockExplorers.default.url]
    : [],
  iconUrls: [],
}));

export const dynamicSettings: DynamicContextProps["settings"] = {
  environmentId: DYNAMIC_ENVIRONMENT_ID || "missing-environment-id",
  walletsFilter: () => [],
  overrides: {
    evmNetworks: (networks) => mergeNetworks(dynamicEvmNetworks, networks),
  },
};
