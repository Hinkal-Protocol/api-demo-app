import { buildAuthGet } from "./hmac";
import { enclaveFetch } from "./enclaveApi";
import { Auth } from "./types";

type RecipientInfoResponse =
  | { success: true; recipientInfo: string }
  | { success?: false; error?: string };

export const fetchRecipientInfo = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<string> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth);

  const { res, data } = await enclaveFetch<RecipientInfoResponse>(
    `/recipient-info?${queryString}`,
    requestNonce,
    { signal, headers },
  );

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(errorMessage ?? "Recipient info fetch failed");
  }

  return data.recipientInfo;
};
