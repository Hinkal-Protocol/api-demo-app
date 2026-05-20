import { SyntheticEvent, useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { ExternalActionId, getFeeStructure } from "../utils/fees";
import { transfer } from "../utils/transfer";
import { getEthersSigner } from "../utils/ethers-wallet";

export const Transfer = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce } =
    useAppContext();
  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferAddress, setTransferAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTransfer = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !signature || !nonce)
        return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, transferAmount);
      const auth = { signature, nonce, address: walletAddress, chainId };
      const tokenAddress = selectedToken.erc20TokenAddress;

      const feeStructure = await getFeeStructure(
        auth,
        tokenAddress,
        [tokenAddress],
        ExternalActionId.Transact,
      );

      const signer = await getEthersSigner();
      await transfer(
        signer,
        walletAddress,
        chainId,
        [tokenAddress],
        [amountInWei.toString()],
        transferAddress,
        tokenAddress,
        feeStructure,
      );

      await refreshBalances();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transfer failed";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    selectedToken,
    walletAddress,
    signature,
    nonce,
    transferAmount,
    transferAddress,
    refreshBalances,
  ]);

  const setTransferAddressHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setTransferAddress(event.target.value);
  };

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = useMemo(
    () =>
      !walletAddress ||
      !selectedToken ||
      !transferAmount ||
      !transferAddress ||
      isProcessing,
    [
      walletAddress,
      selectedToken,
      transferAmount,
      transferAddress,
      isProcessing,
    ],
  );

  return (
    <form className="rounded-lg" onSubmit={handleSubmit}>
      <TokenAmountInput
        tokenAmount={transferAmount}
        setTokenAmount={setTransferAmount}
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
      />
      <div className="mt-[-3%]">
        <label
          htmlFor="recipentAddress"
          className="text-white pl-[5%] text-[14px] font-[300]"
        >
          Recipient address
        </label>
        <input
          type="text"
          placeholder="Please paste address here"
          className="bg-[#272B30] h-10 w-[90%] rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
          disabled={isProcessing}
          onChange={setTransferAddressHandler}
          value={transferAddress}
        />
        <br />
      </div>
      <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-[#272B30]" />
      <div className=" border-solid ">
        <button
          type="submit"
          disabled={isDisabled}
          onClick={handleTransfer}
          className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
            !isDisabled
              ? "bg-primary text-white hover:bg-[#4d32fa] duration-200"
              : "bg-[#37363d] text-[#848688] cursor-not-allowed"
          } `}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-x-2">
              <span>Transferring</span> <Spinner />{" "}
            </div>
          ) : (
            <span>Transfer</span>
          )}
        </button>
      </div>
    </form>
  );
};
