import type { EnclaveSessionAuthMode } from "./auth";

export type EnclaveSessionAuthFields = {
  signature: string;
  sessionId: string;
};

export type EnclaveTxAuthFields = EnclaveSessionAuthFields & {
  nonce: string;
  timestamp: number;
};

export type EnclaveSession = EnclaveSessionAuthFields & {
  authMode: EnclaveSessionAuthMode;
  expiresAt: string;
};

export type TxSessionAuth = EnclaveSessionAuthFields & {
  authMode: EnclaveSessionAuthMode;
};

/** Getter-route auth: session signature + sessionId + address + chainId. */
export type Auth = EnclaveSessionAuthFields & {
  address: string;
  chainId: number;
};
