import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { deposit, depositForOther } from "../utils/deposit";
import { getFriendlyErrorMessage } from "../utils/errors";
import { approveErc20, getEthersSigner, requireEvmSigner, sendTx } from "../utils/ethers-wallet";
import { isValidPrivateAddress, isValidRecipientAddress } from "../utils/recipientAddress";
import { approveAndBroadcastTronDepositTx } from "../utils/tron-wallet";
import { broadcastSolanaTransaction } from "../utils/solana-wallet";

export const Deposit = () => {
  const {
    walletAddress,
    refreshBalancesSoon,
    chainId,
    sessionId,
    privateKey,
    authMode,
    isTron,
    isSolana,
    solanaProvider,
    walletBalances,
    isWalletBalancesLoading,
    refreshWalletBalances,
  } = useAppContext();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const tokenFilter = useCallback(
    (token: ERC20Token) =>
      (walletBalances[token.erc20TokenAddress.toLowerCase()] ?? 0n) > 0n,
    [walletBalances],
  );

  const handleReset = () => {
    setSelectedToken(undefined);
    setDepositAmount("");
    setRecipientAddress("");
  };

  useEffect(() => {
    if (!chainId) return;
    setSelectedToken(undefined);
    setDepositAmount("");
    setRecipientAddress("");
  }, [chainId]);

  const handleDeposit = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !sessionId || !privateKey)
        return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, depositAmount);
      const session = { sessionId, authMode, privateKey };
      const wallet = {
        signer: isTron || isSolana ? null : await getEthersSigner(chainId),
        solanaProvider: isSolana ? solanaProvider : undefined,
      };
      const tokenAddr = selectedToken.erc20TokenAddress;
      const amountStr = amountInWei.toString();
      const recipient = recipientAddress.trim();

      const depositFn = recipient
        ? (w: typeof wallet, s: typeof session, cid: number, tokens: string[], amounts: string[]) =>
            depositForOther(w, s, cid, tokens, amounts, recipient)
        : deposit;

      if (isSolana) {
        if (!wallet.solanaProvider) throw new Error("Solana provider not set");
        const serializedTx = await depositFn(wallet, session, chainId, [tokenAddr], [amountStr]);
        await broadcastSolanaTransaction(wallet.solanaProvider, serializedTx as string);
      } else if (isTron) {
        const txData = await depositFn(wallet, session, chainId, [tokenAddr], [amountStr]);
        await approveAndBroadcastTronDepositTx(
          txData,
          amountInWei,
          selectedToken.erc20TokenAddress,
          walletAddress,
        );
      } else {
        const signer = requireEvmSigner(wallet.signer);
        const txData = await depositFn(wallet, session, chainId, [tokenAddr], [amountStr]);
        if (selectedToken.erc20TokenAddress !== zeroAddress) {
          await approveErc20(
            signer,
            selectedToken.erc20TokenAddress,
            (txData as { to: string }).to,
            amountInWei,
          );
        }
        await sendTx(signer, {
          to: (txData as { to: string; data: string; value?: string }).to,
          data: (txData as { to: string; data: string; value?: string }).data,
          value: (txData as { value?: string }).value
            ? BigInt((txData as { value?: string }).value!)
            : undefined,
        });
      }
      toast.success("Deposit confirmed");
      handleReset();
      refreshBalancesSoon();
      refreshWalletBalances();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Deposit failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    depositAmount,
    recipientAddress,
    selectedToken,
    refreshBalancesSoon,
    refreshWalletBalances,
    chainId,
    walletAddress,
    sessionId,
    privateKey,
    authMode,
    isSolana,
    isTron,
    solanaProvider,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isRecipientValid = useMemo(() => {
    const trimmed = recipientAddress.trim();
    if (!trimmed) return true; // empty means deposit to self
    return isValidPrivateAddress(trimmed) || isValidRecipientAddress(trimmed, isSolana, isTron, false);
  }, [recipientAddress, isSolana, isTron]);

  const exceedsBalance = useMemo(() => {
    if (!selectedToken || !depositAmount || isProcessing) return false;
    try {
      const amountInWei = getAmountInWei(selectedToken, depositAmount);
      const balance =
        walletBalances[selectedToken.erc20TokenAddress.toLowerCase()] ?? 0n;
      return amountInWei > balance;
    } catch {
      return false;
    }
  }, [selectedToken, depositAmount, walletBalances, isProcessing]);

  const isDisabled = useMemo(
    () =>
      !walletAddress ||
      !selectedToken ||
      !depositAmount ||
      isProcessing ||
      exceedsBalance ||
      !isRecipientValid,
    [walletAddress, selectedToken, depositAmount, isProcessing, exceedsBalance, isRecipientValid],
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
          withWalletBalance
          tokenFilter={tokenFilter}
          optionBalances={walletBalances}
          isTokensLoading={isWalletBalancesLoading}
        />
        {exceedsBalance && (
          <p className="w-[90%] mx-auto mt-2 text-sm text-red-500">
            Insufficient balance
          </p>
        )}
        <div className="mt-4">
          <label
            htmlFor="depositRecipient"
            className="text-white pl-[5%] text-[14px] font-[300]"
          >
            Recipient address <span className="text-hinkal-gray-200">(optional — leave empty to deposit to yourself)</span>
          </label>
          <input
            id="depositRecipient"
            type="text"
            placeholder="Public address or private address"
            className="bg-hinkal-blue-900 h-10 w-[90%] rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
            disabled={isProcessing}
            onChange={(e) => setRecipientAddress(e.target.value)}
            value={recipientAddress}
          />
          {recipientAddress.trim() && !isRecipientValid && (
            <p className="text-hinkal-red-100 text-[13px] pl-[5%] mt-1">
              Invalid address
            </p>
          )}
        </div>
        <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-hinkal-blue-900" />
        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleDeposit}
            className={`w-[90%] ml-[5%] mb-3 md:mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
                : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
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
