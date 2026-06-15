import {
  buildEnclaveSignMessage,
  EnclaveSessionAuthMode,
  resolveSessionAuthMode,
} from "./auth";
import { signSolanaMessage, SolanaWalletProvider } from "./solana-wallet";
import { registerEnclaveSession } from "./session";
import type { EnclaveSession } from "./types";

export const createSolanaEnclaveSession = async (
  address: string,
  provider: SolanaWalletProvider,
  useEIP712 = false,
): Promise<EnclaveSession> => {
  const authMode = resolveSessionAuthMode(useEIP712);
  const sessionId = crypto.randomUUID();
  const message = buildEnclaveSignMessage(sessionId, authMode);
  const signature = await signSolanaMessage(provider, message);
  const normalizedSig = signature.startsWith("0x")
    ? signature
    : `0x${signature}`;

  return registerEnclaveSession({
    signature: normalizedSig,
    address,
    sessionId,
    useEIP712,
  });
};
