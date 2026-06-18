import { ethers } from "ethers";
import {
  buildEnclaveSignMessage,
  EnclaveSessionAuthMode,
  resolveSessionAuthMode,
} from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { computeHmacHex, generateClientKeyMaterial } from "./hmac";
import type { EnclaveSession } from "./types";

type CreateSessionResponse =
  | {
      success: true;
      expiresAt: string;
      authMode: EnclaveSessionAuthMode;
      clientPublicKey: string;
    }
  | { success: false; error?: string };

type RegisterSessionParams = {
  signature: string;
  address: string;
  sessionId: string;
  useEIP712: boolean;
};

export const registerEnclaveSession = async ({
  signature,
  address,
  sessionId,
  useEIP712,
}: RegisterSessionParams): Promise<EnclaveSession> => {
  const { clientPublicKey, clientSecret } = await generateClientKeyMaterial();
  const requestNonce = crypto.randomUUID();
  const body = {
    signature,
    address,
    sessionId,
    clientPublicKey,
    nonce: requestNonce,
    useEIP712,
  };
  const bodyJson = JSON.stringify(body);
  const hmac = await computeHmacHex(clientSecret, bodyJson);

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    requestNonce,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HMAC-SHA256": hmac,
      },
      body: bodyJson,
    },
  );

  if (!res.ok || !data.success) {
    throw new Error(
      ("error" in data && data.error) || "Session was not created",
    );
  }

  if (data.clientPublicKey !== clientPublicKey) {
    throw new Error("Response clientPublicKey does not match request");
  }

  return {
    sessionId,
    authMode: data.authMode,
    expiresAt: data.expiresAt,
    clientSecret,
  };
};

export const createEnclaveSession = async (
  signer: ethers.Signer,
  address: string,
  useEIP712: boolean,
): Promise<EnclaveSession> => {
  const sessionId = crypto.randomUUID();
  const authMode = resolveSessionAuthMode(useEIP712);
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(sessionId, authMode),
  );

  return registerEnclaveSession({
    signature,
    address,
    sessionId,
    useEIP712,
  });
};
