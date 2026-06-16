import { fetchAndVerifyAttestation } from "./attestation";

export type HmacSession = {
  sessionId: string;
  clientSecret: ArrayBuffer;
};

const pemToSpkiDer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  return Buffer.from(b64, "base64").buffer as ArrayBuffer;
};

const compressP256PublicKey = (raw: Uint8Array): string => {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Expected uncompressed P-256 public key");
  }
  const compressed = new Uint8Array([raw[64]! & 1 ? 0x03 : 0x02, ...raw.subarray(1, 33)]);
  return Array.from(compressed, (b) => b.toString(16).padStart(2, "0")).join("");
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

