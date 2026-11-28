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

/**
 * Signs the raw payload with no route binding. Only valid for /create-session: at that
 * point no session/binding context exists yet to protect, and enclave-api's
 * createSessionMiddleware verifies the raw body directly (verifyRequestSignature), not
 * through the route-bound verifyRequestSignatureSession path. Every other route must go
 * through requestSignatureGetHeader/requestSignaturePostHeader instead.
 */
export const signPayload = async (
  privateKey: Uint8Array,
  payload: string,
): Promise<string> => {
  const hash = await sha256(payload);
  const signingKey = new ethers.SigningKey(privateKey);
  const sig = signingKey.sign(hash);
  // compact r||s: strip 0x from each, 64 bytes total
  return sig.r.slice(2) + sig.s.slice(2);
};

const normalizeRoutePath = (path: string): string => {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
};

/**
 * The action a signature is authorized for: HTTP method + normalized route path,
 * e.g. "POST /withdraw". Binding this into the signed digest prevents a signature
 * from being replayed against a different route. Must match enclave-api's
 * buildActionBinding (requestBinding.ts) exactly.
 */
const buildActionBinding = (method: string, routePath: string): string =>
  `${method.toUpperCase()} ${normalizeRoutePath(routePath)}`;

/** secp256k1 request-signature payload: binds the action to the raw body/query. */
const buildRequestSignaturePayload = (binding: string, payload: string): string =>
  `${binding}\n${payload}`;

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
  routePath: string,
  queryString: string,
): Promise<Record<string, string>> => ({
  "x-hinkal-request-signature": await signPayload(
    session.privateKey,
    buildRequestSignaturePayload(buildActionBinding("GET", routePath), queryString),
  ),
});

export const requestSignaturePostHeader = async (
  session: Session,
  routePath: string,
  body: Record<string, unknown>,
): Promise<Record<string, string>> => ({
  "x-hinkal-request-signature": await signPayload(
    session.privateKey,
    buildRequestSignaturePayload(buildActionBinding("POST", routePath), JSON.stringify(body)),
  ),
});
