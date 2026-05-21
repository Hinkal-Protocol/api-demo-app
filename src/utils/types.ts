export type EnclaveAuthFields = {
  signature: string;
  nonce: string;
};

export type EnclaveSession = EnclaveAuthFields & {
  hasWriteAccess: boolean;
  expiresAt: string;
};

export type TxSessionAuth = EnclaveAuthFields & {
  hasWriteAccess: boolean;
};

/** Getter-route auth: personal message signature + address + chainId. */
export type Auth = EnclaveAuthFields & {
  address: string;
  chainId: number;
};
