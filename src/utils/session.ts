import { ethers } from "ethers";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import { enclaveFetch } from "./enclaveApi";
import { generateNonce } from "./enclave-auth";
import type { EnclaveSession } from "./types";

export type CreateSessionRequest = {
  signature: string;
  address: string;
  chainId: number;
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
  chainId: number,
  writeAccess: boolean,
): Promise<EnclaveSession> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(
      nonce,
      writeAccess ? EnclaveSessionAccess.Write : EnclaveSessionAccess.Read,
    ),
  );

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    "/create-session",
    nonce,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        address,
        chainId,
        nonce,
        writeAccess,
      } satisfies CreateSessionRequest),
    },
  );

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
