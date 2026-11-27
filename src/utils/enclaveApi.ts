import {
  API_BASE_URL,
  ENCLAVE_API_URL_LOCAL,
} from "../constants/server.constants";
import { verifyResponseAttestation, verifyResponseNonce } from "./attestation";

const IS_LOCAL = API_BASE_URL === ENCLAVE_API_URL_LOCAL;
// LOCAL TEST ONLY: sends a partner portal key so partner fees apply.
const PARTNER_API_KEY = import.meta.env.VITE_PARTNER_API_KEY || "";

export const enclaveFetch = async <T>(
  path: string,
  requestNonce?: string,
  init?: RequestInit,
): Promise<{ res: Response; data: T }> => {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(
      url,
      PARTNER_API_KEY
        ? { ...init, headers: { ...(init?.headers as Record<string, string>), "x-api-key": PARTNER_API_KEY } }
        : init,
    );
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  const rawBody = await res.text();
  if (requestNonce) {
    verifyResponseNonce(rawBody, requestNonce);
  }
  if (!IS_LOCAL && requestNonce) {
    await verifyResponseAttestation(res, rawBody);
  }

  return { res, data: JSON.parse(rawBody) as T };
};
