import { useEffect, useState } from "react";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { ExternalActionId, getFee } from "../utils/fees";

interface UseTransactFeeParams {
  token?: ERC20Token;
  amountWei: bigint;
  enabled?: boolean;
  ref?: string;
}

export const useTransactFee = ({
  token,
  amountWei,
  enabled = true,
  ref,
}: UseTransactFeeParams) => {
  const { chainId, walletAddress, privateKey, sessionId } = useAppContext();
  const [feeAmount, setFeeAmount] = useState<string | undefined>();
  const [isFeeLoading, setIsFeeLoading] = useState(false);

  useEffect(() => {
    if (
      !enabled ||
      !token ||
      !chainId ||
      !walletAddress ||
      !privateKey ||
      !sessionId ||
      amountWei <= 0n
    ) {
      setFeeAmount(undefined);
      setIsFeeLoading(false);
      return;
    }

    let cancelled = false;
    setIsFeeLoading(true);
    const tokenAddress = token.erc20TokenAddress;
    const timer = setTimeout(async () => {
      try {
        const auth = { sessionId, privateKey, address: walletAddress, chainId };
        const fetchedFeeAmount = await getFee(
          auth,
          tokenAddress,
          [tokenAddress],
          ExternalActionId.Transact,
          [amountWei],
          undefined,
          ref,
        );
        if (!cancelled) setFeeAmount(fetchedFeeAmount);
      } catch {
        if (!cancelled) setFeeAmount(undefined);
      } finally {
        if (!cancelled) setIsFeeLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, token, amountWei, chainId, walletAddress, privateKey, sessionId, ref]);

  return { feeAmount, isFeeLoading };
};
