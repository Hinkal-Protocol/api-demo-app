import { TRON_CHAIN_IDS } from "../constants/chain.constants";

export const isTronLike = (chainId: number) => TRON_CHAIN_IDS.includes(chainId);
