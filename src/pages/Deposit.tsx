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
import { deposit } from "../utils/deposit";
import { approveErc20, getEthersSigner, sendTx } from "../utils/ethers-wallet";
import { approveAndBroadcastTronDepositTx } from "../utils/tron-wallet";
import { broadcastSolanaTransaction } from "../utils/solana-wallet";
import { getPublicBalances } from "../utils/public-balances";
import { buildSolanaDepositAuthFields } from "../utils/solana-auth";
import { buildTronDepositAuthFields } from "../utils/tron-auth";

export const Deposit = () => {
  const {
    walletAddress,
    refreshBalances,
    chainId,
    signature,
    nonce,
    hasWriteAccess,
    isTron,
    isSolana,
    solanaProvider,
    erc20List,
    walletType,
  } = useAppContext();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined
  );
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ownedTokens, setOwnedTokens] = useState<Set<string>>(new Set());
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  useEffect(() => {
    if (!walletAddress || !chainId || !walletType || erc20List.length === 0) {
      setOwnedTokens(new Set());
      setIsLoadingTokens(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTokens(true);
    getPublicBalances(erc20List, walletAddress, chainId, walletType)
      .then((balances) => {
        if (cancelled) return;
        setOwnedTokens(
          new Set(
            balances
              .filter((b) => b.balance > 0n)
              .map((b) => b.token.erc20TokenAddress.toLowerCase())
          )
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTokens(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, chainId, walletType, erc20List]);

  const tokenFilter = useCallback(
    (token: ERC20Token) =>
      ownedTokens.has(token.erc20TokenAddress.toLowerCase()),
    [ownedTokens]
  );

  const handleReset = () => {
    setSelectedToken(undefined);
    setDepositAmount("");
  };

  const handleDeposit = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !walletAddress || !signature || !nonce)
        return;
      setIsProcessing(true);

      const amountInWei = getAmountInWei(selectedToken, depositAmount);
      const session = { signature, nonce, hasWriteAccess };

      if (isSolana) {
        if (!solanaProvider) throw new Error("Solana provider not set");
        const tokenAddr = selectedToken.erc20TokenAddress;
        const amountStr = amountInWei.toString();
        const buildReadOnlyAuth = () =>
          buildSolanaDepositAuthFields(
            solanaProvider,
            chainId,
            [tokenAddr],
            [amountStr]
          );
        const serializedTx = await deposit(
          null,
          session,
          walletAddress,
          chainId,
          [tokenAddr],
          [amountStr],
          buildReadOnlyAuth
        );
        await broadcastSolanaTransaction(
          solanaProvider,
          serializedTx as string
        );
      } else if (isTron) {
        const tokenAddr = selectedToken.erc20TokenAddress;
        const amountStr = amountInWei.toString();
        const buildReadOnlyAuth = () =>
          buildTronDepositAuthFields(chainId, [tokenAddr], [amountStr]);
        const txData = await deposit(
          null,
          session,
          walletAddress,
          chainId,
          [tokenAddr],
          [amountStr],
          buildReadOnlyAuth
        );
        await approveAndBroadcastTronDepositTx(
          txData,
          amountInWei,
          selectedToken.erc20TokenAddress,
          walletAddress
        );
      } else {
        const signer = await getEthersSigner();
        const txData = await deposit(
          signer,
          session,
          walletAddress,
          chainId,
          [selectedToken.erc20TokenAddress],
          [amountInWei.toString()]
        );
        if (selectedToken.erc20TokenAddress !== zeroAddress) {
          await approveErc20(
            signer,
            selectedToken.erc20TokenAddress,
            (txData as { to: string }).to,
            amountInWei
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
      await refreshBalances();
      handleReset();
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
    [walletAddress, selectedToken, depositAmount, isProcessing]
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
          isTokensLoading={isLoadingTokens}
        />
        <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-hinkal-blue-900" />
        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleDeposit}
            className={`w-[90%] ml-[5%] mb-3 md:mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-hinkal-purple-200 duration-200"
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
