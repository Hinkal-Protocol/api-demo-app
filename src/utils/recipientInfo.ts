import { enclaveFetch } from "./enclaveApi";
import { Auth } from "./types";

type RecipientInfoResponse =
  | { success: true; recipientInfo: string }
  | { success?: false; error?: string };

export const fetchRecipientInfo = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<string> => {
  const { signature, sessionId, address, chainId } = auth;
  const requestNonce = crypto.randomUUID();

  const params = new URLSearchParams({
    address,
    chainId: String(chainId),
    signature,
    sessionId,
    nonce: requestNonce,
    timestamp: Date.now().toString(),
  });

  const { res, data } = await enclaveFetch<RecipientInfoResponse>(
    `/recipient-info?${params}`,
    requestNonce,
    { signal },
  );

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(errorMessage ?? "Recipient info fetch failed");
  }

  return data.recipientInfo;
};
