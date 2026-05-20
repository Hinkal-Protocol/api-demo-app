export type EnclaveAuthFields = {
  signature: string;
  nonce: string;
};

/** Getter-route auth: personal message signature + address + chainId. */
export type Auth = EnclaveAuthFields & {
  address: string;
  chainId: number;
};
