import { StuckBalance, TokenBalance } from "../types";
import { buildAuthGet } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { Auth } from "./types";

type BalanceResponse<T> =
  | { success: true; balances: T[] }
  | { error?: string };

const fetchBalanceEndpoint = async <T extends TokenBalance>(
  endpoint: "balance" | "stuck-balances",
  auth: Auth,
  signal?: AbortSignal,
): Promise<T[]> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, `/${endpoint}`);

  const { res, data } = await enclaveFetch<BalanceResponse<T>>(
    `/${endpoint}?${queryString}`,
    requestNonce,
    { signal, headers },
  );

  if (!res.ok || !("success" in data && data.success)) {
    const errorMessage = "error" in data ? data.error : undefined;
    throw new Error(
      errorMessage ??
        (endpoint === "balance" ? "Balance fetch failed" : `${endpoint} fetch failed`),
    );
  }

  return data.balances;
};

export const fetchBalances = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const balances = await fetchBalanceEndpoint("balance", auth, signal);
  return balances.filter((b) => b.balance !== "0");
};

/** Everything stuck on auth.chainId, per token, split by source (utxo, bridge, vault). */
export const fetchStuckBalances = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<StuckBalance[]> => {
  const balances = await fetchBalanceEndpoint<StuckBalance>("stuck-balances", auth, signal);
  return balances.filter((b) => b.balance !== "0");
};
