export { generateNonce, buildEnclaveAuthFields } from "./enclave-auth";

export const buildSignMessage = (nonce: string): string => `Hinkal - ${nonce}`;
