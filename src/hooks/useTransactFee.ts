import { useEffect, useState } from "react";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { ExternalActionId, FeeStructure, getFeeStructure } from "../utils/fees";

interface UseTransactFeeParams {
  token?: ERC20Token;
  amountWei: bigint;
  enabled?: boolean;
}

export const useTransactFee = ({
  token,
  amountWei,
  enabled = true,
}: UseTransactFeeParams) => {
  const { chainId, walletAddress, privateKey, sessionId } = useAppContext();
  const [feeStructure, setFeeStructure] = useState<FeeStructure | undefined>();
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
      setFeeStructure(undefined);
      setIsFeeLoading(false);
      return;
    }

    let cancelled = false;
    setIsFeeLoading(true);
    const tokenAddress = token.erc20TokenAddress;
    const timer = setTimeout(async () => {
      try {
        const auth = { sessionId, privateKey, address: walletAddress, chainId };
        const fee = await getFeeStructure(
          auth,
          tokenAddress,
          [tokenAddress],
          ExternalActionId.Transact,
          undefined,
          [amountWei]
        );
        if (!cancelled) setFeeStructure(fee);
      } catch {
        if (!cancelled) setFeeStructure(undefined);
      } finally {
        if (!cancelled) setIsFeeLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, token, amountWei, chainId, walletAddress, privateKey, sessionId]);

  return { feeStructure, isFeeLoading };
};
