import type { Signer } from "ethers";
import type { EnclaveSessionAuthMode } from "./auth";
import type { SolanaWalletProvider } from "./solana-wallet";

export type TxWallet = {
  signer: Signer | null;
  solanaProvider?: SolanaWalletProvider | null;
};

export type EnclaveTxAuthFields = {
  sessionId: string;
  nonce: string;
  timestamp: number;
  signature?: string;
};

export type EnclaveSession = {
  sessionId: string;
  authMode: EnclaveSessionAuthMode;
  expiresAt: string;
  clientSecret: ArrayBuffer;
};

export type TxSessionAuth = {
  sessionId: string;
  authMode: EnclaveSessionAuthMode;
  clientSecret: ArrayBuffer;
};

/** Getter-route auth: HMAC session + address + chainId. */
export type Auth = {
  sessionId: string;
  clientSecret: ArrayBuffer;
  address: string;
  chainId: number;
};
