import { RELAYER_BASE_URL } from "../constants/server.constants";

export const getTokenPrices = async (
  chainId: number,
  erc20Addresses: string[]
): Promise<number[]> => {
  if (erc20Addresses.length === 0) return [];

  const res = await fetch(`${RELAYER_BASE_URL}/get-token-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId, erc20Addresses }),
  });

  const data = (await res.json()) as
    | { prices: number[] }
    | { status: string; message?: string };

  if (!res.ok || !("prices" in data) || !Array.isArray(data.prices)) {
    throw new Error(
      ("message" in data && data.message) || "Failed to fetch token prices"
    );
  }

  return data.prices;
};
