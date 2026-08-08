import arbMainnetRegistry from "./arbMainnetRegistry.json";
import ethMainnetRegistry from "./ethMainnetRegistry.json";
import baseRegistry from "./baseRegistry.json";
import bnbMainnetRegistry from "./bnbMainnetRegistry.json";
import polygonRegistry from "./polygonRegistry.json";
import arcTestnetRegistry from "./arcTestnetRegistry.json";
import tronNileRegistry from "./tronNileRegistry.json";
import tronMainnetRegistry from "./tronMainnetRegistry.json";
import solanaMainnetRegistry from "./solanaMainnetRegistry.json";
import tempoRegistry from "./tempoRegistry.json";
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

    case chainIds.base:
      return baseRegistry.networkRegistry as ERC20Token[];

    case chainIds.bnbMainnet:
      return bnbMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.arcTestnet:
      return arcTestnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.tronNile:
      return tronNileRegistry.networkRegistry as ERC20Token[];

    case chainIds.tronMainnet:
      return tronMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.solanaMainnet:
      return solanaMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.tempo:
      return tempoRegistry.networkRegistry as ERC20Token[];

    default:
      return [];
  }
};
