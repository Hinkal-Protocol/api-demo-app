import arbMainnetRegistry from "./arbMainnetRegistry.json";
import ethMainnetRegistry from "./ethMainnetRegistry.json";
import optimismRegistry from "./optimismRegistry.json";
import baseRegistry from "./baseRegistry.json";
import polygonRegistry from "./polygonRegistry.json";
import arcTestnetRegistry from "./arcTestnetRegistry.json";
import sepoliaRegistry from "./sepoliaRegistry.json";
import tronNileRegistry from "./tronNileRegistry.json";
import solanaMainnetRegistry from "./solanaMainnetRegistry.json";
import { ERC20Token } from "../../types";
import { chainIds } from "../chain.constants";

export const getERC20Registry = (chainId: number): ERC20Token[] => {
  switch (chainId) {
    case chainIds.polygon:
      return polygonRegistry.networkRegistry as ERC20Token[];

    case chainIds.arbMainnet:
      return arbMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.ethMainnet:
      return ethMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.optimism:
      return optimismRegistry.networkRegistry as ERC20Token[];

    case chainIds.base:
      return baseRegistry.networkRegistry as ERC20Token[];

    case chainIds.arcTestnet:
      return arcTestnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.sepolia:
      return sepoliaRegistry.networkRegistry as ERC20Token[];

    case chainIds.tronNile:
      return tronNileRegistry.networkRegistry as ERC20Token[];

    case chainIds.solanaMainnet:
      return solanaMainnetRegistry.networkRegistry as ERC20Token[];

    default:
      return [];
  }
};
