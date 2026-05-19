import { useState, useCallback } from "react";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";

type UseTransferOptions = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

export const useTransfer = ({
  onError,
  onSuccess,
}: UseTransferOptions = {}) => {
  const { hinkal, dataLoaded } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const transfer = useCallback(
    async (token: ERC20Token, amount: string, recipientAddress: string) => {
      try {
        setIsProcessing(true);

        if (!dataLoaded) throw new Error("Wallet not connected");
        if (!amount || parseFloat(amount) <= 0)
          throw new Error("Invalid amount");
        if (!recipientAddress) throw new Error("Recipient address is required");

        const amountInBigInt = getAmountInWei(token, amount);
        // TODO: enclave API call
        // await hinkal.transfer(
        //   hinkal,
        //   [token],
        //   [-amountInBigInt],
        //   recipientAddress,
        // );
        console.warn("transfer stub", {
          token,
          amountInBigInt,
          recipientAddress,
          hinkal,
        });

        onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Transfer failed");
        onError?.(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [hinkal, dataLoaded, onError, onSuccess],
  );

  return { transfer, isProcessing };
};
