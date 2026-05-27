import { API_BASE_URL } from "../constants/server.constants";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { generateNonce } from "./enclave-auth";
import { signSolanaMessage, SolanaWalletProvider } from "./solana-wallet";
import type { EnclaveSession } from "./types";

type CreateSessionResponse =
  | { success: true; expiresAt: string; hasWriteAccess: boolean }
  | { success: false; error?: string };

/**
 * Create a Hinkal enclave session signed via Phantom or Solflare.
 * Always requests write access so Solana users don't need per-tx typed data signing.
 */
export const createSolanaEnclaveSession = async (
  address: string,
  chainId: number,
  provider: SolanaWalletProvider,
): Promise<EnclaveSession> => {
  const nonce = generateNonce();
  const message = buildEnclaveSignMessage(nonce, EnclaveSessionAccess.Write);
  const signature = await signSolanaMessage(provider, message);
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
        writeAccess: true,
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
    hasWriteAccess: true,
    expiresAt: data.expiresAt,
  };
};
