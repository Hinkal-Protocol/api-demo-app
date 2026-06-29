import type { SolanaWalletProvider } from "../../utils/solana-wallet";

/**
 * Stable ids for the embedded-wallet / non-wagmi connection flows. Wagmi
 * connectors use their own `connector.id` (a plain string), so `connectingId`
 * stays `string | null`; these enum members are the fixed, hand-written ids.
 */
export enum WalletConnectId {
  Privy = "privy",
  PrivyCreating = "privy-creating",
  PrivySigning = "privy-signing",
  Turnkey = "turnkey",
  TurnkeySigning = "turnkey-signing",
  Dynamic = "dynamic",
  DynamicSigning = "dynamic-signing",
  Dfns = "dfns",
  Openfort = "openfort",
  TronLink = "tronlink",
}

export const solanaConnectId = (provider: SolanaWalletProvider): string =>
  `solana-${provider}`;
