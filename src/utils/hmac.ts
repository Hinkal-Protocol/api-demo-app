import { fetchAndVerifyAttestation } from "./attestation";
import type { Auth } from "./types";

export type HmacSession = {
  sessionId: string;
  clientSecret: ArrayBuffer;
};

const pemToSpkiDer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
};

const compressP256PublicKey = (raw: Uint8Array): string => {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Expected uncompressed P-256 public key");
  }
  const prefix = raw[64]! & 1 ? 0x03 : 0x02;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(raw.subarray(1, 33), 1);
  return Array.from(compressed)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const computeHmacHex = async (
  secret: ArrayBuffer,
  payload: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payloadBytes = new Uint8Array(new TextEncoder().encode(payload));
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const generateClientKeyMaterial = async (): Promise<{
  clientPublicKey: string;
  clientSecret: ArrayBuffer;
}> => {
  const verificationPublicKeyPem = await fetchAndVerifyAttestation();
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const rawPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const clientPublicKey = compressP256PublicKey(rawPublicKey);
  const serverPublicKey = await crypto.subtle.importKey(
    "spki",
    pemToSpkiDer(verificationPublicKeyPem),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const clientSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPublicKey },
    keyPair.privateKey,
    256,
  );
  return { clientPublicKey, clientSecret };
};

export const sessionQueryParams = (
  session: HmacSession,
  address: string,
  chainId: number,
): Record<string, string> => ({
  sessionId: session.sessionId,
  nonce: crypto.randomUUID(),
  address,
  chainId: String(chainId),
  timestamp: Date.now().toString(),
});

export const sessionBodyParams = (
  session: HmacSession,
  address: string,
  chainId: number,
): {
  sessionId: string;
  nonce: string;
  address: string;
  chainId: number;
  timestamp: number;
} => ({
  sessionId: session.sessionId,
  nonce: crypto.randomUUID(),
  address,
  chainId,
  timestamp: Date.now(),
});

export const hmacGetHeader = async (
  session: HmacSession,
  queryString: string,
): Promise<Record<string, string>> => ({
  "X-HMAC-SHA256": await computeHmacHex(session.clientSecret, queryString),
});

export const hmacPostHeader = async (
  session: HmacSession,
  body: Record<string, unknown>,
): Promise<Record<string, string>> => ({
  "X-HMAC-SHA256": await computeHmacHex(
    session.clientSecret,
    JSON.stringify(body),
  ),
});

type QueryParamValue = string | string[];

const appendQueryParams = (
  search: URLSearchParams,
  params: Record<string, QueryParamValue>,
): void => {
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.append(key, value);
    }
  }
};

export const buildAuthGet = async (
  auth: Auth,
  params: Record<string, QueryParamValue> = {},
): Promise<{
  queryString: string;
  headers: Record<string, string>;
  requestNonce: string;
}> => {
  const base = sessionQueryParams(auth, auth.address, auth.chainId);
  const search = new URLSearchParams();
  appendQueryParams(search, { ...base, ...params });
  const queryString = search.toString();
  return {
    queryString,
    requestNonce: base.nonce,
    headers: await hmacGetHeader(auth, queryString),
  };
};
