import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { getAmountInToken } from "../utils/amount.utils";
import { getTokenPrices } from "../utils/prices";

export interface BalanceItem {
  token: ERC20Token;
  balanceWei: bigint;
  amount: number;
  usdValue: number;
}

export const useShieldedUsdBalances = () => {
  const { balances, erc20List, chainId } = useAppContext();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const tokenBalances = useMemo(() => {
    const byAddress = new Map(
      erc20List.map((t) => [t.erc20TokenAddress.toLowerCase(), t])
    );
    return balances
      .map((b) => {
        const token = byAddress.get(b.tokenAddress.toLowerCase());
        return token ? { token, balanceWei: BigInt(b.balance) } : null;
      })
      .filter(
        (x): x is { token: ERC20Token; balanceWei: bigint } => x !== null
      );
  }, [balances, erc20List]);

  // Stable key so the price fetch only re-runs when the token set changes.
  const addressesKey = useMemo(
    () =>
      tokenBalances
        .map((t) => t.token.erc20TokenAddress.toLowerCase())
        .sort()
        .join(","),
    [tokenBalances]
  );

  useEffect(() => {
    if (!chainId || tokenBalances.length === 0) {
      setPrices({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const addresses = tokenBalances.map((t) => t.token.erc20TokenAddress);
    getTokenPrices(chainId, addresses)
      .then((priceArr) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        addresses.forEach((a, i) => {
          map[a.toLowerCase()] = priceArr[i] ?? 0;
        });
        setPrices(map);
      })
      .catch(() => {
        if (!cancelled) setPrices({});
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, addressesKey]);

  const items = useMemo<BalanceItem[]>(
    () =>
      tokenBalances
        .map(({ token, balanceWei }) => {
          const amount = Number(getAmountInToken(token, balanceWei));
          const price = prices[token.erc20TokenAddress.toLowerCase()] ?? 0;
          return { token, balanceWei, amount, usdValue: amount * price };
        })
        .sort((a, b) => b.usdValue - a.usdValue),
    [tokenBalances, prices]
  );

  const totalUsd = useMemo(
    () => items.reduce((sum, i) => sum + i.usdValue, 0),
    [items]
  );

  return { items, totalUsd, isLoading };
};
