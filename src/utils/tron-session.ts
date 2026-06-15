import {
  buildEnclaveSignMessage,
  EnclaveSessionAuthMode,
  resolveSessionAuthMode,
} from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { signTronPersonalMessage } from "./tron-wallet";
import type { EnclaveSession } from "./types";

type CreateSessionResponse =
  | { success: true; expiresAt: string; authMode: EnclaveSessionAuthMode }
  | { success: false; error?: string };

export const createTronEnclaveSession = async (
  address: string,
  chainId: number,
  useEIP712 = false,
): Promise<EnclaveSession> => {
  const authMode = resolveSessionAuthMode(useEIP712);
  const sessionId = crypto.randomUUID();
  const requestNonce = crypto.randomUUID();
  const message = buildEnclaveSignMessage(sessionId, authMode);

  const signature = await Promise.resolve(signTronPersonalMessage(message));
  const normalizedSig = signature.startsWith("0x")
    ? signature
    : `0x${signature}`;

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    requestNonce,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: normalizedSig,
        address,
        chainId,
        sessionId,
        nonce: requestNonce,
        timestamp: Date.now(),
        useEIP712,
      }),
    },
  );
  if (!res.ok || !data.success) {
    throw new Error(
      ("error" in data && data.error) || "Session was not created",
    );
  }

  return {
    signature: normalizedSig,
    sessionId,
    authMode: data.authMode,
    expiresAt: data.expiresAt,
  };
};
