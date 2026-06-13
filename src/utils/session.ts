import { ethers } from "ethers";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { generateNonce } from "./enclave-auth";
import type { EnclaveSession } from "./types";

export type CreateSessionRequest = {
  signature: string;
  address: string;
  chainId: number;
  nonce: string;
  writeAccess?: boolean;
  publicKey?: string;
  requestId?: string;
};

type CreateSessionResponse =
  | {
      success: true;
      expiresAt: string;
      hasWriteAccess: boolean;
      publicKey?: string;
    }
  | { success: false; error?: string };


let sessionPrivateKey: string | null = null;

const compactSign = (privateKey: string, bodyJson: string): string => {
  const digest = ethers.sha256(ethers.toUtf8Bytes(bodyJson));
  const sig = new ethers.SigningKey(privateKey).sign(digest);
  // compact r+s (64 bytes = 128 hex chars), no 0x prefix
  return sig.r.slice(2) + sig.s.slice(2);
};

export const signGetRequest = (params: URLSearchParams): string => {
  if (!sessionPrivateKey) throw new Error("No session signing key");
  return compactSign(sessionPrivateKey, params.toString());
};

export const signWriteRequest = (
  body: Record<string, unknown>,
): { body: Record<string, unknown>; signature: string } => {
  if (!sessionPrivateKey) throw new Error("No session signing key");
  const requestId = generateNonce();
  const enrichedBody = { ...body, requestId };
  const signature = compactSign(sessionPrivateKey, JSON.stringify(enrichedBody));
  return { body: enrichedBody, signature };
};

export const hasKeySignSession = (): boolean => sessionPrivateKey !== null;

export const clearSessionKey = (): void => {
  sessionPrivateKey = null;
};

export const createEnclaveSession = async (
  signer: ethers.Signer,
  address: string,
  chainId: number,
  writeAccess: boolean,
  useKeySign = false,
): Promise<EnclaveSession> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(
      nonce,
      writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read,
    ),
  );

  let requestBody: Record<string, unknown> = {
    signature,
    address,
    chainId,
    nonce,
    writeAccess,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (writeAccess && useKeySign) {
    const wallet = ethers.Wallet.createRandom();
    sessionPrivateKey = wallet.privateKey;
    requestBody.publicKey = wallet.signingKey.compressedPublicKey.slice(2);

    const signed = signWriteRequest(requestBody);
    requestBody = signed.body;
    headers["X-Request-Signature"] = signed.signature;
  }

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    nonce,
    {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    },
  );

  if (!res.ok || !data.success) {
    throw new Error(("error" in data && data.error) || "Session was not created");
  }

  if (requestBody.publicKey && data.publicKey !== requestBody.publicKey) {
    throw new Error("Session public key mismatch — possible MITM attack");
  }

  return {
    signature,
    nonce,
    hasWriteAccess: data.hasWriteAccess,
    expiresAt: data.expiresAt,
  };
};
