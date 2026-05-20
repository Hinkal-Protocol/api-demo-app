export { generateNonce, buildEnclaveAuthFields } from "./enclave-auth";

export const buildEnclaveSignMessage = (sessionId: string): string =>
  `Authorize Hinkal session\nSession ID: ${sessionId}`;
