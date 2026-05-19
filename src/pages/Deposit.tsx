import { SyntheticEvent, useCallback, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useConfig } from "wagmi";
import {
  sendTransaction,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { erc20Abi } from "viem";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { deposit } from "../utils/deposit";

export const Deposit = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce } =
    useAppContext();
  const config = useConfig();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeposit = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !signature || !nonce)
        return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, depositAmount);

      const txData = await deposit(
        { signature, nonce, address: walletAddress, chainId },
        [selectedToken.erc20TokenAddress],
        [amountInWei.toString()],
      );

      const approveHash = await writeContract(config, {
        abi: erc20Abi,
        address: selectedToken.erc20TokenAddress as `0x${string}`,
        functionName: "approve",
        args: [txData.to as `0x${string}`, amountInWei],
        chainId,
      });
      await waitForTransactionReceipt(config, { hash: approveHash });

      const depositHash = await sendTransaction(config, {
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: txData.value ? BigInt(txData.value) : undefined,
        chainId,
      });
      await waitForTransactionReceipt(config, { hash: depositHash });
      await refreshBalances();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Deposit failed";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [
    config,
    depositAmount,
    selectedToken,
    refreshBalances,
    chainId,
    walletAddress,
    signature,
    nonce,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = useMemo(
    () => !walletAddress || !selectedToken || !depositAmount || isProcessing,
    [walletAddress, selectedToken, depositAmount, isProcessing],
  );

  return (
    <div>
      <form className="rounded-lg" onSubmit={handleSubmit}>
        <TokenAmountInput
          buttonWrapperStyles="!mb-0"
          tokenAmount={depositAmount}
          setTokenAmount={setDepositAmount}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
        />
        <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-[#272B30]" />
        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleDeposit}
            className={`w-[90%] ml-[5%] mb-3 md:mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-[#4d32fa] duration-200"
                : "bg-[#37363d] text-[#848688] cursor-not-allowed"
            } `}
          >
            {isProcessing ? (
              <div className="mx-[5%] flex items-center justify-center gap-x-2">
                <span>Depositing</span> <Spinner />
              </div>
            ) : (
              <span>Deposit</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
