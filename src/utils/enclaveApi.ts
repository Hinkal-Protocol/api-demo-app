import { API_BASE_URL } from "../constants/server.constants";
import { verifyResponseWithAttestation } from "./attestation";

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
  await verifyResponseWithAttestation(res, rawBody, requestNonce);

  return { res, data: JSON.parse(rawBody) as T };
};
