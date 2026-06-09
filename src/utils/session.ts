import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { generateNonce } from "./enclave-auth";
import type { EnclaveSession } from "./types";

export type CreateSessionRequest = {
  signature: string;
  address: string;
  nonce: string;
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
  writeAccess: boolean,
): Promise<EnclaveSession> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(
      nonce,
      writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read,
    ),
  );

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/create-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        address,
        nonce,
        writeAccess,
      } satisfies CreateSessionRequest),
    });
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  const data = (await res.json()) as CreateSessionResponse;

  if (!res.ok || !data.success) {
    throw new Error(
      ("error" in data && data.error) || "Session was not created",
    );
  }

  return {
    signature,
    nonce,
    hasWriteAccess: data.hasWriteAccess,
    expiresAt: data.expiresAt,
  };
};
