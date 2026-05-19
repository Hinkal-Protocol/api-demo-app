import arcTestnetRegistryJson from './arcTestnetRegistry.json';

import ethMainnetRegistryJson from './ethMainnetRegistry.json';
import arbMainnetRegistryJson from './arbMainnetRegistry.json';
import polygonRegistryJson from './polygonRegistry.json';
import optimismRegistryJson from './optimismRegistry.json';
import baseRegistryJson from './baseRegistry.json';

export * from './ERC20Registry';

const ethMainnetRegistry = ethMainnetRegistryJson.networkRegistry;
const arbMainnetRegistry = arbMainnetRegistryJson.networkRegistry;
const polygonRegistry = polygonRegistryJson.networkRegistry;
const optimismRegistry = optimismRegistryJson.networkRegistry;
const baseRegistry = baseRegistryJson.networkRegistry;

const arcTestnetRegistry = arcTestnetRegistryJson.networkRegistry;

export {
  ethMainnetRegistry,
  arbMainnetRegistry,
  polygonRegistry,
  optimismRegistry,
  baseRegistry,
  arcTestnetRegistry,
};
