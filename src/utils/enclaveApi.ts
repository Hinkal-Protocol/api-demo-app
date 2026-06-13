import { API_BASE_URL, ENCLAVE_API_URL_LOCAL } from "../constants/server.constants";
import { verifyResponseWithAttestation } from "./attestation";

const IS_LOCAL = API_BASE_URL === ENCLAVE_API_URL_LOCAL;

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
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  const rawBody = await res.text();
  if (!IS_LOCAL) {
    let expectedNonce = requestNonce;
    if (init?.body && typeof init.body === "string") {
      try {
        const outgoing = JSON.parse(init.body) as Record<string, unknown>;
        if (typeof outgoing.requestId === "string") expectedNonce = outgoing.requestId;
      } catch {}
    }
    await verifyResponseWithAttestation(res, rawBody, expectedNonce);
  }

  return { res, data: JSON.parse(rawBody) as T };
};
