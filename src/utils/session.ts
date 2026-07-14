import { ethers } from "ethers";
import {
  buildEnclaveSignMessage,
  resolveSessionAuthMode,
} from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { generateClientKeyPair, signPayload } from "./request-signature";
import type { EnclaveSession } from "./types";

type CreateSessionResponse =
  | {
      success: true;
      expiresAt: string;
    }
  | { success: false; error?: string };

const postCreateSession = async (
  privateKey: Uint8Array,
  body: Record<string, unknown>,
): Promise<EnclaveSession> => {
  const bodyJson = JSON.stringify(body);
  const requestNonce = body.nonce as string;

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    requestNonce,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hinkal-request-signature": await signPayload(privateKey, bodyJson),
      },
      body: bodyJson,
    },
  );

  if (!res.ok || !data.success) {
    throw new Error(("error" in data && data.error) || "Session was not created");
  }

  return {
    sessionId: body.sessionId as string,
    authMode: resolveSessionAuthMode((body.useEIP712 as boolean | undefined) ?? false),
    expiresAt: data.expiresAt,
    privateKey,
  };
};

export const registerEnclaveSession = async ({
  signature,
  address,
  sessionId,
  useEIP712,
  clientPublicKey: providedPublicKey,
  privateKey: providedPrivateKey,
}: {
  signature: string;
  address: string;
  sessionId: string;
  useEIP712: boolean;
  clientPublicKey?: string;
  privateKey?: Uint8Array;
}): Promise<EnclaveSession> => {
  const { privateKey, clientPublicKey } =
    providedPrivateKey && providedPublicKey
      ? { privateKey: providedPrivateKey, clientPublicKey: providedPublicKey }
      : generateClientKeyPair();
  const body = {
    signature,
    address,
    sessionId,
    clientPublicKey,
    nonce: crypto.randomUUID(),
    useEIP712,
  };
  return postCreateSession(privateKey, body);
};

export const createEnclaveSession = async (
  signer: ethers.Signer,
  address: string,
  useEIP712: boolean,
): Promise<EnclaveSession> => {
  const { privateKey, clientPublicKey } = generateClientKeyPair();
  const sessionId = crypto.randomUUID();
  const authMode = resolveSessionAuthMode(useEIP712);
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(sessionId, clientPublicKey, authMode),
  );
  const body = {
    signature,
    address,
    sessionId,
    clientPublicKey,
    nonce: crypto.randomUUID(),
    useEIP712,
  };
  return postCreateSession(privateKey, body);
};
