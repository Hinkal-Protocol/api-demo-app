import {
  buildEnclaveSignMessage,
  resolveSessionAuthMode,
} from "./auth";
import { generateClientKeyPair } from "./request-signature";
import { registerEnclaveSession } from "./session";
import { signTronPersonalMessage } from "./tron-wallet";
import type { EnclaveSession } from "./types";

export const createTronEnclaveSession = async (
  address: string,
  useEIP712 = false,
): Promise<EnclaveSession> => {
  const { privateKey, clientPublicKey } = generateClientKeyPair();
  const authMode = resolveSessionAuthMode(useEIP712);
  const sessionId = crypto.randomUUID();
  const message = buildEnclaveSignMessage(sessionId, clientPublicKey, authMode);

  const signature = await Promise.resolve(signTronPersonalMessage(message));
  const normalizedSig = signature.startsWith("0x")
    ? signature
    : `0x${signature}`;

  return registerEnclaveSession({
    signature: normalizedSig,
    address,
    sessionId,
    useEIP712,
    clientPublicKey,
    privateKey,
  });
};
