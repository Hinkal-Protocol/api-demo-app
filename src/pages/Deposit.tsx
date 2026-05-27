import { SyntheticEvent, useCallback, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { deposit } from "../utils/deposit";
import { approveErc20, getEthersSigner, sendTx } from "../utils/ethers-wallet";
import { approveAndBroadcastTronDepositTx } from "../utils/tron-wallet";

export const Deposit = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce, hasWriteAccess, isTron } =
    useAppContext();

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
      const session = { signature, nonce, hasWriteAccess };

      if (isTron) {
        const txData = await deposit(
          null,
          session,
          walletAddress,
          chainId,
          [selectedToken.erc20TokenAddress],
          [amountInWei.toString()],
        );
        await approveAndBroadcastTronDepositTx(
          txData,
          amountInWei,
          selectedToken.erc20TokenAddress,
          walletAddress,
        );
      } else {
        const signer = await getEthersSigner();
        const txData = await deposit(
          signer,
          session,
          walletAddress,
          chainId,
          [selectedToken.erc20TokenAddress],
          [amountInWei.toString()],
        );
        if (selectedToken.erc20TokenAddress !== zeroAddress) {
          await approveErc20(signer, selectedToken.erc20TokenAddress, txData.to, amountInWei);
        }
        await sendTx(signer, {
          to: txData.to,
          data: txData.data,
          value: txData.value ? BigInt(txData.value) : undefined,
        });
      }
      await refreshBalances();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Deposit failed";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [
    depositAmount,
    selectedToken,
    refreshBalances,
    chainId,
    walletAddress,
    signature,
    nonce,
    hasWriteAccess,
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
