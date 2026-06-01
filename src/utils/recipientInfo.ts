import { API_BASE_URL } from "../constants/server.constants";
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

  const res = await fetch(`${API_BASE_URL}/recipient-info?${params}`, {
    signal,
  });
  const data = (await res.json()) as RecipientInfoResponse;

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(errorMessage ?? "Recipient info fetch failed");
  }

  return data.recipientInfo;
};
