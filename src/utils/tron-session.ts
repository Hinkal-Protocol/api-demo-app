import {
  buildEnclaveSignMessage,
  resolveSessionAuthMode,
} from "./auth";
import { registerEnclaveSession } from "./session";
import { signTronPersonalMessage } from "./tron-wallet";
import type { EnclaveSession } from "./types";

export const createTronEnclaveSession = async (
  address: string,
  useEIP712 = false,
): Promise<EnclaveSession> => {
  const authMode = resolveSessionAuthMode(useEIP712);
  const sessionId = crypto.randomUUID();
  const message = buildEnclaveSignMessage(sessionId, authMode);

  const signature = await Promise.resolve(signTronPersonalMessage(message));
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
