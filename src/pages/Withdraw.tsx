import { SyntheticEvent, useCallback, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
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
import { withdraw } from "../utils/withdraw";
import { getEthersSigner } from "../utils/ethers-wallet";
import { buildSolanaWithdrawAuthFields } from "../utils/solana-auth";
import { buildTronWithdrawAuthFields } from "../utils/tron-auth";

export const Withdraw = () => {
  const {
    walletAddress,
    refreshBalances,
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
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRelayerOff, setIsRelayerOff] = useState(false);

  const amountWei = useMemo(() => {
    if (!selectedToken || !withdrawAmount) return 0n;
    try {
      return getAmountInWei(selectedToken, withdrawAmount);
    } catch {
      return 0n;
    }
  }, [selectedToken, withdrawAmount]);

  const { feeStructure, isFeeLoading } = useTransactFee({
    token: selectedToken,
    amountWei,
    enabled: !isRelayerOff,
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
    setWithdrawAmount("");
    setRecipientAddress("");
    setIsRelayerOff(false);
  };

  const handleWithdraw = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !signature || !nonce)
        return;
      if (!isRelayerOff && !feeStructure) return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, withdrawAmount);
      const tokenAddress = selectedToken.erc20TokenAddress;

      const signer = isTron || isSolana ? null : await getEthersSigner(chainId);
      const amountStr = amountInWei.toString();
      const buildReadOnlyAuth =
        isSolana && solanaProvider
          ? () =>
              buildSolanaWithdrawAuthFields(
                solanaProvider,
                chainId,
                [tokenAddress],
                [amountStr],
                recipientAddress,
              )
          : isTron
          ? () =>
              buildTronWithdrawAuthFields(
                chainId,
                [tokenAddress],
                [amountStr],
                recipientAddress,
              )
          : undefined;
      await withdraw(
        signer,
        { signature, nonce, hasWriteAccess },
        walletAddress,
        chainId,
        [tokenAddress],
        [amountStr],
        recipientAddress,
        isRelayerOff,
        tokenAddress,
        feeStructure,
        buildReadOnlyAuth,
      );

      toast.success("Withdraw confirmed");
      handleReset();
      refreshBalancesSoon();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Withdraw failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    selectedToken,
    walletAddress,
    signature,
    nonce,
    withdrawAmount,
    recipientAddress,
    isRelayerOff,
    feeStructure,
    refreshBalances,
    refreshBalancesSoon,
    hasWriteAccess,
  ]);

  const setRecipientAddressHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRecipientAddress(event.target.value);
  };

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = useMemo(
    () =>
      !walletAddress ||
      !selectedToken ||
      !withdrawAmount ||
      !recipientAddress ||
      isProcessing ||
      isFeeLoading ||
      hasInsufficientFunds ||
      (!isRelayerOff && !feeStructure),
    [
      walletAddress,
      selectedToken,
      withdrawAmount,
      recipientAddress,
      isProcessing,
      isFeeLoading,
      hasInsufficientFunds,
      isRelayerOff,
      feeStructure,
    ],
  );

  return (
    <div>
      <form className="rounded-lg" onSubmit={handleSubmit}>
        <TokenAmountInput
          tokenAmount={withdrawAmount}
          setTokenAmount={setWithdrawAmount}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          tokenFilter={tokenFilter}
          withShieldedBalance
        />
        <div className="mt-[-15px] text-white">
          <label
            htmlFor="recipentAddressWithdraw"
            className="text-white pl-[5%] text-[14px] font-[300]"
          >
            Recipient address{" "}
          </label>
          <br />
          <input
            type="text"
            placeholder="Please paste address here"
            className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-4 pl-2 outline-none placeholder:text-[13.5px] mt-1"
            disabled={isProcessing}
            onChange={setRecipientAddressHandler}
            value={recipientAddress}
          />
        </div>
        <div className="flex items-center gap-x-2 pl-[5%] mb-4">
          <input
            type="checkbox"
            id="relayerOff"
            checked={isRelayerOff}
            onChange={(e) => setIsRelayerOff(e.target.checked)}
            disabled={isProcessing}
            className="cursor-pointer"
          />
          <label
            htmlFor="relayerOff"
            className="text-white text-[14px] font-[300] cursor-pointer"
          >
            Withdraw without relayer
          </label>
        </div>
        <div className="px-[5%] mb-2 text-[13px]">
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
        <div className="w-[90%] mx-auto mb-4 mt-2 h-[1px] bg-hinkal-blue-900" />
        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleWithdraw}
            className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 mt-3 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
                : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
            } `}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-x-2">
                <span>Withdrawing</span> <Spinner />
              </div>
            ) : (
              <span>Withdraw</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
