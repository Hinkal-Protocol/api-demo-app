import { TokenBalance } from "../types";
import { enclaveFetch } from "./enclaveApi";
import { hasKeySignSession, signGetRequest } from "./session";
import { Auth } from "./types";

type BalanceResponse =
  | { success: true; balances: TokenBalance[] }
  | { error?: string };

const fetchBalanceEndpoint = async (
  endpoint: "balance" | "stuck-utxo-balance",
  params: URLSearchParams,
  requestNonce: string,
  signal?: AbortSignal,
): Promise<TokenBalance[]> => {
  const init: RequestInit = { signal };
  if (hasKeySignSession()) {
    const signature = signGetRequest(params);
    init.headers = { "X-Request-Signature": signature };
  }

  const { res, data } = await enclaveFetch<BalanceResponse>(
    `/${endpoint}?${params}`,
    requestNonce,
    init,
  );

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

  const balances = await fetchBalanceEndpoint("balance", params, nonce, signal);

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
    nonce,
    signal,
  );

  return balances.filter((b) => b.balance !== "0");
};
