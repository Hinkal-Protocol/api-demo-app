import { ethers } from "ethers";
import {
  buildEnclaveSignMessage,
  EnclaveSessionAuthMode,
  resolveSessionAuthMode,
} from "./auth";
import { enclaveFetch } from "./enclaveApi";
import type { EnclaveSession } from "./types";

export type CreateSessionRequest = {
  signature: string;
  address: string;
  chainId: number;
  sessionId: string;
  nonce: string;
  timestamp?: number;
  useEIP712?: boolean;
};

type CreateSessionResponse =
  | {
      success: true;
      expiresAt: string;
      authMode: EnclaveSessionAuthMode;
    }
  | { success: false; error?: string };

export const createEnclaveSession = async (
  signer: ethers.Signer,
  address: string,
  chainId: number,
  useEIP712: boolean,
): Promise<EnclaveSession> => {
  const sessionId = crypto.randomUUID();
  const authMode = resolveSessionAuthMode(useEIP712);
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(sessionId, authMode),
  );

  const requestNonce = crypto.randomUUID();
  const requestBody: CreateSessionRequest = {
    signature,
    address,
    chainId,
    sessionId,
    nonce: requestNonce,
    timestamp: Date.now(),
    useEIP712,
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
    throw new Error(
      ("error" in data && data.error) || "Session was not created",
    );
  }

  return {
    signature,
    sessionId,
    authMode: data.authMode,
    expiresAt: data.expiresAt,
  };
};
