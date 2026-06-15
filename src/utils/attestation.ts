import { API_BASE_URL } from "../constants/server.constants";

const toBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const s = window.atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const encode = (s: string): Uint8Array<ArrayBuffer> => {
  const bytes = new TextEncoder().encode(s);
  const out = new Uint8Array(bytes.length);
  bytes.forEach((b, i) => {
    out[i] = b;
  });
  return out;
};

const GOOGLE_CONFIDENTIAL_SPACE_JWKS_URI =
  "https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com";

const parseJwtPayload = (jwt: string) =>
  JSON.parse(
    window.atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    aud: string;
    eat_nonce: string;
    submods?: { container?: { image_digest?: string } };
  };

const verifyJwtSignature = async (jwt: string): Promise<void> => {
  const [header64, payload64, sig64] = jwt.split(".");
  const { kid: key_id } = JSON.parse(
    window.atob(header64.replace(/-/g, "+").replace(/_/g, "/")),
  ) as { kid: string };

  const { keys } = (await fetch(GOOGLE_CONFIDENTIAL_SPACE_JWKS_URI).then((r) =>
    r.json(),
  )) as {
    keys: ({ kid: string } & JsonWebKey)[];
  };
  const jwk = keys.find((k) => k.kid === key_id);
  if (!jwk) throw new Error("JWT signing key not found in Google JWKS");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = toBytes(sig64.replace(/-/g, "+").replace(/_/g, "/"));
  const dataBytes = encode(`${header64}.${payload64}`);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    sigBytes,
    dataBytes,
  );
  if (!valid) throw new Error("JWT signature verification failed");
};

export const fetchAndVerifyAttestation = async (): Promise<string> => {
  const nonce = crypto.randomUUID();
  const res = await fetch(`${API_BASE_URL}/attestation?nonce=${nonce}`);
  if (!res.ok) throw new Error("Failed to fetch attestation");

  const { jwt, imageDigest, verificationPublicKey } = (await res.json()) as {
    jwt: string;
    imageDigest: string;
    verificationPublicKey: string;
  };

  await verifyJwtSignature(jwt);

  const payload = parseJwtPayload(jwt);
  if (payload.eat_nonce !== nonce)
    throw new Error("Attestation nonce mismatch");
  if (payload.aud !== verificationPublicKey)
    throw new Error("JWT aud does not match verificationPublicKey");
  if (imageDigest !== payload.submods?.container?.image_digest)
    throw new Error("imageDigest does not match JWT");

  return verificationPublicKey;
};

let verificationPublicKey: string | null = null;
let initPromise: Promise<string> | null = null;

const refreshEnclaveAttestation = async (): Promise<string> => {
  verificationPublicKey = await fetchAndVerifyAttestation();
  return verificationPublicKey;
};

const ensureVerificationPublicKey = async (): Promise<string> => {
  if (!verificationPublicKey) {
    if (!initPromise) {
      initPromise = refreshEnclaveAttestation().catch((err) => {
        initPromise = null;
        throw err;
      });
    }
    verificationPublicKey = await initPromise;
  }
  return verificationPublicKey;
};

export const verifyResponseNonce = (
  rawBody: string,
  requestNonce: string,
): void => {
  const parsed = JSON.parse(rawBody) as { nonce?: unknown };
  if (parsed.nonce !== requestNonce) {
    throw new Error("Response nonce mismatch");
  }
};

export const verifyResponseAttestation = async (
  res: Response,
  rawBody: string,
): Promise<void> => {
  const key = await ensureVerificationPublicKey();

  const signature = res.headers.get("x-hinkal-signature");
  if (!signature) throw new Error("Missing X-Hinkal-Signature header");
  let valid = await verifyEnclaveResponse(rawBody, signature, key);
  if (!valid) {
    const freshKey = await refreshEnclaveAttestation();
    valid = await verifyEnclaveResponse(rawBody, signature, freshKey);
    if (!valid)
      throw new Error("Enclave response signature verification failed");
  }
};

export const verifyEnclaveResponse = async (
  rawBody: string,
  signatureB64: string,
  verificationPublicKey: string,
): Promise<boolean> => {
  const der = toBytes(
    verificationPublicKey.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""),
  );
  const key = await crypto.subtle.importKey(
    "spki",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    toBytes(signatureB64),
    encode(rawBody),
  );
};
