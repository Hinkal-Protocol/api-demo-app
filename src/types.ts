export enum AppTab {
  Deposit,
  Transfer,
  Withdraw,
  Swap,
  MultiSend,
}

export interface ERC20Token {
  chainId: number;
  erc20TokenAddress: string;
  wrappedErc20TokenAddress?: string;
  underlyingErc20TokenAddress?: string;
  name: string;
  symbol: string;
  decimals: number;
  nftTokenType?: string;
  logoURI?: string;
  logoURIs?: string[];
  whitelisted?: boolean;
  isCustom?: true;
  tokenIds?: string[];
  approvalType?: ApprovalType;
  isVolatile?: boolean;
  sharedAddress?: string;
  isPendleToken?: boolean;
  isHToken?: boolean;
  hasHToken?: boolean;
  aaveToken?: boolean;
  allowanceStorageOffset?: number;
  balanceStorageOffset?: number;
  isVyper?: boolean;
  isSpam?: boolean;
  is2022Program?: boolean;
}

export enum ApprovalType {
  Classic,
  ERC20Permit,
  DAIPermit,
}

export interface TokenBalance {
  chainId: number;
  tokenAddress: string;
  balance: string;
}

export interface NFT {
  tokenId: number;
  image?: string;
  name?: string;
  timestamp?: string;
}

export type Network = {
  chainId: number;
  name: string;
  fetchRpcUrl: string;
};

export enum ScheduleDelayOption {
  INSTANTLY = "Instantly",
  FIFTEEN_MINUTES = "15m",
  THIRTY_MINUTES = "30m",
  ONE_HOUR = "1hr",
  TWENTY_FOUR_HOURS = "24hrs",
}
