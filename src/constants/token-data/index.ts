import arcTestnetRegistryJson from './arcTestnetRegistry.json';
import tronNileRegistryJson from './tronNileRegistry.json';
import tronMainnetRegistryJson from './tronMainnetRegistry.json';
import solanaMainnetRegistryJson from './solanaMainnetRegistry.json';
import tempoRegistryJson from './tempoRegistry.json';

import ethMainnetRegistryJson from './ethMainnetRegistry.json';
import arbMainnetRegistryJson from './arbMainnetRegistry.json';
import polygonRegistryJson from './polygonRegistry.json';
import baseRegistryJson from './baseRegistry.json';
import bnbMainnetRegistryJson from './bnbMainnetRegistry.json';

export * from './ERC20Registry';

const ethMainnetRegistry = ethMainnetRegistryJson.networkRegistry;
const arbMainnetRegistry = arbMainnetRegistryJson.networkRegistry;
const polygonRegistry = polygonRegistryJson.networkRegistry;
const baseRegistry = baseRegistryJson.networkRegistry;
const bnbMainnetRegistry = bnbMainnetRegistryJson.networkRegistry;

const arcTestnetRegistry = arcTestnetRegistryJson.networkRegistry;
const tronNileRegistry = tronNileRegistryJson.networkRegistry;
const tronMainnetRegistry = tronMainnetRegistryJson.networkRegistry;
const solanaMainnetRegistry = solanaMainnetRegistryJson.networkRegistry;
const tempoRegistry = tempoRegistryJson.networkRegistry;

export {
  ethMainnetRegistry,
  arbMainnetRegistry,
  polygonRegistry,
  baseRegistry,
  bnbMainnetRegistry,
  arcTestnetRegistry,
  tronNileRegistry,
  tronMainnetRegistry,
  solanaMainnetRegistry,
  tempoRegistry,
};
