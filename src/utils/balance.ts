import { API_BASE_URL } from "../constants/server.constants";
import { TokenBalance } from "../types";
import { Auth } from "./types";

export const fetchBalances = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const { signature, nonce, address, chainId } = auth;

  const params = new URLSearchParams({
    address,
    chainId: String(chainId),
    signature,
    nonce,
  });

  const res = await fetch(`${API_BASE_URL}/balance?${params}`, { signal });
  const data = (await res.json()) as
    | { success: true; balances: TokenBalance[] }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Balance fetch failed",
    );
  }

  return (data.balances as TokenBalance[]).filter((b) => b.balance !== "0");
};
