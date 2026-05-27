import { API_BASE_URL } from "../constants/server.constants";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { generateNonce } from "./enclave-auth";
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
  const nonce = generateNonce();
  const message = buildEnclaveSignMessage(nonce, access);

  // TronLink signMessageV2 is synchronous but wrapped in Promise for consistency
  const signature = await Promise.resolve(signTronPersonalMessage(message));
  const normalizedSig = signature.startsWith("0x") ? signature : `0x${signature}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/create-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: normalizedSig,
        address,
        chainId,
        nonce,
        writeAccess,
      }),
    });
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  const data = (await res.json()) as CreateSessionResponse;
  if (!res.ok || !data.success) {
    throw new Error(("error" in data && data.error) || "Session was not created");
  }

  return {
    signature: normalizedSig,
    nonce,
    hasWriteAccess: writeAccess,
    expiresAt: data.expiresAt,
  };
};
