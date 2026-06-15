import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { signTronPersonalMessage } from "./tron-wallet";
import type { EnclaveSession } from "./types";

type CreateSessionResponse =
  | { success: true; expiresAt: string; hasWriteAccess: boolean }
  | { success: false; error?: string };

/**
 * Create a Hinkal enclave session signed via TronLink.
 * Always requests write access so Tron users don't need per-tx typed data signing.
 */
export const createTronEnclaveSession = async (
  address: string,
  chainId: number,
  writeAccess = true,
): Promise<EnclaveSession> => {
  const access = writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read;
  const sessionId = crypto.randomUUID();
  const requestNonce = crypto.randomUUID();
  const message = buildEnclaveSignMessage(sessionId, access);

  const signature = await Promise.resolve(signTronPersonalMessage(message));
  const normalizedSig = signature.startsWith("0x") ? signature : `0x${signature}`;

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
        writeAccess,
      }),
    },
  );
  if (!res.ok || !data.success) {
    throw new Error(("error" in data && data.error) || "Session was not created");
  }

  return {
    signature: normalizedSig,
    sessionId,
    hasWriteAccess: writeAccess,
    expiresAt: data.expiresAt,
  };
};
