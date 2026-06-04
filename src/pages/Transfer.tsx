import { SyntheticEvent, useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { ERC20Token } from "../types";
import {
  getAmountInToken,
  getAmountInWei,
  getTokenBalanceWei,
} from "../utils/amount.utils";
import { getFeeAmount } from "../utils/fees";
import { useTransactFee } from "../hooks/useTransactFee";
import { getFriendlyErrorMessage } from "../utils/errors";
import { transfer } from "../utils/transfer";
import { getEthersSigner } from "../utils/ethers-wallet";
import { buildSolanaTransferAuthFields } from "../utils/solana-auth";
import { buildTronTransferAuthFields } from "../utils/tron-auth";

export const Transfer = () => {
  const {
    walletAddress,
    refreshBalancesSoon,
    chainId,
    signature,
    nonce,
    hasWriteAccess,
    isTron,
    isSolana,
    solanaProvider,
    balances,
  } = useAppContext();
  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );

  const tokenFilter = useMemo(() => {
    const owned = new Set(balances.map((b) => b.tokenAddress.toLowerCase()));
    return (token: ERC20Token) =>
      owned.has(token.erc20TokenAddress.toLowerCase());
  }, [balances]);

  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferAddress, setTransferAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const amountWei = useMemo(() => {
    if (!selectedToken || !transferAmount) return 0n;
    try {
      return getAmountInWei(selectedToken, transferAmount);
    } catch {
      return 0n;
    }
  }, [selectedToken, transferAmount]);

  const { feeStructure, isFeeLoading } = useTransactFee({
    token: selectedToken,
    amountWei,
  });

  const feeAmount = getFeeAmount(feeStructure);

  const feeDisplay =
    selectedToken && feeStructure
      ? `${Number(getAmountInToken(selectedToken, feeAmount)).toFixed(6)} ${
          selectedToken.symbol
        }`
      : null;

  const hasInsufficientFunds = useMemo(() => {
    if (!selectedToken || amountWei <= 0n) return false;
    return getTokenBalanceWei(balances, selectedToken) < amountWei + feeAmount;
  }, [selectedToken, amountWei, balances, feeAmount]);

  const handleReset = () => {
    setSelectedToken(undefined);
    setTransferAmount("");
    setTransferAddress("");
  };

  const handleTransfer = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !signature || !nonce)
        return;
      if (!feeStructure) return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, transferAmount);
      const tokenAddress = selectedToken.erc20TokenAddress;

      const signer = isTron || isSolana ? null : await getEthersSigner();
      const amountStr = amountInWei.toString();
      const buildReadOnlyAuth =
        isSolana && solanaProvider
          ? () =>
              buildSolanaTransferAuthFields(
                solanaProvider,
                chainId,
                [tokenAddress],
                [amountStr],
                transferAddress,
              )
          : isTron
          ? () =>
              buildTronTransferAuthFields(
                chainId,
                [tokenAddress],
                [amountStr],
                transferAddress,
              )
          : undefined;
      await transfer(
        signer,
        { signature, nonce, hasWriteAccess },
        walletAddress,
        chainId,
        [tokenAddress],
        [amountStr],
        transferAddress,
        tokenAddress,
        feeStructure,
        buildReadOnlyAuth,
      );

      toast.success("Transfer confirmed");
      handleReset();
      refreshBalancesSoon();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Transfer failed"));
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
    feeStructure,
    refreshBalancesSoon,
    hasWriteAccess,
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
      isProcessing ||
      isFeeLoading ||
      !feeStructure ||
      hasInsufficientFunds,
    [
      walletAddress,
      selectedToken,
      transferAmount,
      transferAddress,
      isProcessing,
      isFeeLoading,
      feeStructure,
      hasInsufficientFunds,
    ],
  );

  return (
    <form className="rounded-lg" onSubmit={handleSubmit}>
      <TokenAmountInput
        tokenAmount={transferAmount}
        setTokenAmount={setTransferAmount}
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
        tokenFilter={tokenFilter}
        withShieldedBalance
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
          className="bg-hinkal-blue-900 h-10 w-[90%] rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
          disabled={isProcessing}
          onChange={setTransferAddressHandler}
          value={transferAddress}
        />
        <br />
      </div>
      <div className="px-[5%] mb-2 text-[13px] mt-1.5">
        {isFeeLoading ? (
          <span className="text-hinkal-gray-100">Calculating fee…</span>
        ) : (
          feeDisplay && (
            <span className="text-hinkal-gray-100">
              Network fee: {feeDisplay}
            </span>
          )
        )}
        {hasInsufficientFunds && (
          <p className="text-hinkal-red-100">
            Insufficient balance for amount + fee
          </p>
        )}
      </div>
      <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-hinkal-blue-900" />
      <div className=" border-solid ">
        <button
          type="submit"
          disabled={isDisabled}
          onClick={handleTransfer}
          className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
            !isDisabled
              ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
              : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
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
