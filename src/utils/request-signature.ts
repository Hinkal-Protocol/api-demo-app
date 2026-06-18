import { ethers } from "ethers";

export type Session = {
  sessionId: string;
  privateKey: Uint8Array;
};

const sha256 = async (payload: string): Promise<Uint8Array> => {
  const bytes = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return new Uint8Array(hash);
};

const signPayload = async (
  privateKey: Uint8Array,
  payload: string,
): Promise<string> => {
  const hash = await sha256(payload);
  const signingKey = new ethers.SigningKey(privateKey);
  const sig = signingKey.sign(hash);
  // compact r||s: strip 0x from each, 64 bytes total
  return sig.r.slice(2) + sig.s.slice(2);
};

export const generateClientKeyPair = (): {
  privateKey: Uint8Array;
  clientPublicKey: string;
} => {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const signingKey = new ethers.SigningKey(privateKey);
  // compressedPublicKey is "0x02..." or "0x03...", strip 0x
  return { privateKey, clientPublicKey: signingKey.compressedPublicKey.slice(2) };
};

export const sessionQueryParams = (
  session: Session,
  chainId: number,
): Record<string, string> => ({
  sessionId: session.sessionId,
  nonce: crypto.randomUUID(),
  chainId: String(chainId),
  timestamp: Date.now().toString(),
});

export const sessionBodyParams = (
  session: Session,
  chainId: number,
): {
  sessionId: string;
  nonce: string;
  chainId: number;
  timestamp: number;
} => ({
  sessionId: session.sessionId,
  nonce: crypto.randomUUID(),
  chainId,
  timestamp: Date.now(),
});

export const requestSignatureGetHeader = async (
  session: Session,
  queryString: string,
): Promise<Record<string, string>> => ({
  "X-Request-Signature": await signPayload(session.privateKey, queryString),
});

export const requestSignaturePostHeader = async (
  session: Session,
  body: Record<string, unknown>,
): Promise<Record<string, string>> => ({
  "X-Request-Signature": await signPayload(
    session.privateKey,
    JSON.stringify(body),
  ),
});
