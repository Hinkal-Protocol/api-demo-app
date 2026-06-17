import { enclaveFetch } from "./enclaveApi";
import { hasKeySignSession, signGetRequest } from "./session";
import { Auth } from "./types";

type RecipientInfoResponse =
  | { success: true; recipientInfo: string }
  | { success?: false; error?: string };

export const fetchRecipientInfo = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<string> => {
  const { signature, nonce, address, chainId } = auth;

  const params = new URLSearchParams({
    address,
    chainId: String(chainId),
    signature,
    nonce,
  });

  const init: RequestInit = { signal };
  if (hasKeySignSession()) {
    const signature = signGetRequest(params);
    init.headers = { "X-Request-Signature": signature };
  }

  const { res, data } = await enclaveFetch<RecipientInfoResponse>(
    `/recipient-info?${params}`,
    nonce,
    init,
  );

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(errorMessage ?? "Recipient info fetch failed");
  }

  return data.recipientInfo;
};
