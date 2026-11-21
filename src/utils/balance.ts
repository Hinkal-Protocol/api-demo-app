import { TokenBalance } from "../types";
import { buildAuthGet } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { Auth } from "./types";

type BalanceResponse =
  | { success: true; balances: TokenBalance[] }
  | { error?: string };

const fetchBalanceEndpoint = async (
  endpoint: "balance" | "stuck-utxo-balance" | "stuck-bridge-balance",
  auth: Auth,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(auth, `/${endpoint}`);

  const { res, data } = await enclaveFetch<BalanceResponse>(
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

export const fetchStuckUtxoBalances = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const balances = await fetchBalanceEndpoint("stuck-utxo-balance", auth, signal);
  return balances.filter((b) => b.balance !== "0");
};

/** Bridge refunds parked in a temporary wallet or the NEAR Intents account, on auth.chainId. */
export const fetchStuckBridgeBalances = async (
  auth: Auth,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const balances = await fetchBalanceEndpoint("stuck-bridge-balance", auth, signal);
  return balances.filter((b) => b.balance !== "0");
};
