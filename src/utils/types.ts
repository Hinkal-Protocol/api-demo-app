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
  privateKey: Uint8Array;
};

export type TxSessionAuth = {
  sessionId: string;
  authMode: EnclaveSessionAuthMode;
  privateKey: Uint8Array;
};

/** Getter-route auth: session + chainId. */
export type Auth = {
  sessionId: string;
  privateKey: Uint8Array;
  chainId: number;
};
