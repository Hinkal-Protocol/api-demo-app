export type EnclaveSessionAuthFields = {
  signature: string;
  sessionId: string;
};

export type EnclaveTxAuthFields = EnclaveSessionAuthFields & {
  nonce: string;
  timestamp: number;
};

export type EnclaveSession = EnclaveSessionAuthFields & {
  hasWriteAccess: boolean;
  expiresAt: string;
};

export type TxSessionAuth = EnclaveSessionAuthFields & {
  hasWriteAccess: boolean;
};

/** Getter-route auth: session signature + sessionId + address + chainId. */
export type Auth = EnclaveSessionAuthFields & {
  address: string;
  chainId: number;
};
