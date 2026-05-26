import { API_BASE_URL } from "../constants/server.constants";
import { TokenBalance } from "../types";
import { Auth } from "./types";

type BalanceResponse =
  | { success: true; balances: TokenBalance[] }
  | { error?: string };

const fetchBalanceEndpoint = async (
  endpoint: "balance" | "stuck-utxo-balance",
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const res = await fetch(`${API_BASE_URL}/${endpoint}?${params}`, { signal });
  const data = (await res.json()) as BalanceResponse;

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(
      errorMessage ??
        (endpoint === "balance"
          ? "Balance fetch failed"
          : "Stuck UTXO balance fetch failed"),
    );
  }

  return data.balances;
};

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

  const balances = await fetchBalanceEndpoint("balance", params, signal);

  return balances.filter((b) => b.balance !== "0");
};

export const fetchStuckUtxoBalances = async (
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

  const balances = await fetchBalanceEndpoint(
    "stuck-utxo-balance",
    params,
    signal,
  );

  return balances.filter((b) => b.balance !== "0");
};
