import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { enclaveFetch } from "./enclaveApi";
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
  writeAccess = true,
): Promise<EnclaveSession> => {
  const access = writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read;
  const nonce = generateNonce();
  const message = buildEnclaveSignMessage(nonce, access);
  const signature = await signSolanaMessage(provider, message);
  const normalizedSig = signature.startsWith("0x") ? signature : `0x${signature}`;

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    nonce,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: normalizedSig,
        address,
        chainId,
        nonce,
        writeAccess,
      }),
    },
  );
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
