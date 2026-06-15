import { ethers } from "ethers";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { enclaveFetch } from "./enclaveApi";
import type { EnclaveSession } from "./types";

export type CreateSessionRequest = {
  signature: string;
  address: string;
  chainId: number;
  sessionId: string;
  nonce: string;
  timestamp?: number;
  writeAccess?: boolean;
};

type CreateSessionResponse =
  | {
      success: true;
      expiresAt: string;
      hasWriteAccess: boolean;
    }
  | { success: false; error?: string };

export const createEnclaveSession = async (
  signer: ethers.Signer,
  address: string,
  chainId: number,
  writeAccess: boolean,
): Promise<EnclaveSession> => {
  const sessionId = crypto.randomUUID();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(
      sessionId,
      writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read,
    ),
  );

  const requestNonce = crypto.randomUUID();
  const requestBody: CreateSessionRequest = {
    signature,
    address,
    chainId,
    sessionId,
    nonce: requestNonce,
    timestamp: Date.now(),
    writeAccess,
  };

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    requestNonce,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    },
  );

  if (!res.ok || !data.success) {
    throw new Error(("error" in data && data.error) || "Session was not created");
  }

  return {
    signature,
    sessionId,
    hasWriteAccess: data.hasWriteAccess,
    expiresAt: data.expiresAt,
  };
};
