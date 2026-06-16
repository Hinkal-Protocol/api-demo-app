import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { SwapInputTokensButton } from "../components/swap/SwapInputTokensButton";
import { SwapSettings } from "../components/swap/SwapSettings";
import { useAppContext } from "../AppContext";
import {
  getAmountInToken,
  getAmountInWei,
  getTokenBalanceDisplay,
  getTokenBalanceWei,
} from "../utils/amount.utils";
import { ERC20Token } from "../types";
import {
  getSwapData,
  executeSwap,
  HINKAL_SWAP_VARIABLE_RATE,
  type SwapData,
} from "../utils/swap";
import { FeeStructure, getFeeAmount, getFeeStructure } from "../utils/fees";
import { getFriendlyErrorMessage } from "../utils/errors";
import { getEthersSigner } from "../utils/ethers-wallet";

export const Swap = () => {
  const {
    walletAddress,
    refreshBalancesSoon,
    chainId,
    clientSecret,
    sessionId,
    authMode,
    isSolana,
    solanaProvider,
    balances,
  } = useAppContext();
  const [inSwapAmount, setInSwapAmount] = useState("");
  const [inSwapToken, setInSwapToken] = useState<ERC20Token | undefined>();
  const [outSwapToken, setOutSwapToken] = useState<ERC20Token | undefined>();
  const [priceDetailsShown, setPriceDetailsShown] = useState(false);
  const [relayerInfoShown, setRelayerInfoShown] = useState(false);

  const [quotedData, setQuotedData] = useState<SwapData | undefined>();
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState("0.30");

  const inTokenFilter = useMemo(() => {
    const owned = new Set(balances.map((b) => b.tokenAddress.toLowerCase()));
    return (token: ERC20Token) =>
      owned.has(token.erc20TokenAddress.toLowerCase());
  }, [balances]);

  const inSwapBalanceDisplay = useMemo(
    () => (inSwapToken ? getTokenBalanceDisplay(balances, inSwapToken) : null),
    [balances, inSwapToken],
  );

  const [feeStructure, setFeeStructure] = useState<FeeStructure | undefined>();
  const [isFeeLoading, setIsFeeLoading] = useState(false);

  useEffect(() => {
    if (
      !quotedData ||
      !inSwapToken ||
      !outSwapToken ||
      !chainId ||
      !walletAddress ||
      !clientSecret ||
      !sessionId
    ) {
      setFeeStructure(undefined);
      setIsFeeLoading(false);
      return;
    }

    let cancelled = false;
    setIsFeeLoading(true);
    const auth = { sessionId, clientSecret, chainId };
    const feeToken = isSolana
      ? outSwapToken.erc20TokenAddress
      : inSwapToken.erc20TokenAddress;
    const inWei = (() => {
      try {
        return getAmountInWei(inSwapToken, inSwapAmount);
      } catch {
        return 0n;
      }
    })();
    getFeeStructure(
      auth,
      feeToken,
      [inSwapToken.erc20TokenAddress, outSwapToken.erc20TokenAddress],
      quotedData.externalActionId,
      HINKAL_SWAP_VARIABLE_RATE.toString(),
      isSolana ? [inWei, -BigInt(quotedData.outSwapAmount)] : undefined,
      isSolana ? inSwapToken.erc20TokenAddress : undefined,
    )
      .then((fee) => {
        if (!cancelled) setFeeStructure(fee);
      })
      .catch(() => {
        if (!cancelled) setFeeStructure(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsFeeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    quotedData,
    inSwapToken,
    outSwapToken,
    inSwapAmount,
    chainId,
    walletAddress,
    clientSecret,
    sessionId,
    isSolana,
  ]);

  const feeAmount = getFeeAmount(feeStructure);
  const feeToken = isSolana ? outSwapToken : inSwapToken;
  const feeDisplay =
    feeToken && feeStructure
      ? `${Number(getAmountInToken(feeToken, feeAmount)).toFixed(6)} ${
          feeToken.symbol
        }`
      : null;

  const inAmountWei = useMemo(() => {
    if (!inSwapToken || !inSwapAmount) return 0n;
    try {
      return getAmountInWei(inSwapToken, inSwapAmount);
    } catch {
      return 0n;
    }
  }, [inSwapToken, inSwapAmount]);

  const hasInsufficientFunds = useMemo(() => {
    if (!inSwapToken || inAmountWei <= 0n) return false;
    const required = inAmountWei + (isSolana ? 0n : feeAmount);
    return getTokenBalanceWei(balances, inSwapToken) < required;
  }, [inSwapToken, inAmountWei, isSolana, feeAmount, balances]);

  useEffect(() => {
    setQuotedData(undefined);

    if (
      !chainId ||
      !walletAddress ||
      !clientSecret ||
      !sessionId ||
      !inSwapToken ||
      !outSwapToken ||
      !inSwapAmount ||
      Number(inSwapAmount) <= 0
    )
      return;

    const auth = { sessionId, clientSecret, chainId };
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsPriceLoading(true);
        const result = await getSwapData(
          auth,
          inSwapToken.erc20TokenAddress,
          outSwapToken.erc20TokenAddress,
          inSwapAmount,
          parseFloat(slippageTolerance),
        );
        if (!cancelled) {
          setQuotedData(result);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(getFriendlyErrorMessage(err, "Quote fetch failed"));
        }
      } finally {
        if (!cancelled) setIsPriceLoading(false);
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    chainId,
    walletAddress,
    clientSecret,
    sessionId,
    inSwapToken,
    outSwapToken,
    inSwapAmount,
    slippageTolerance,
  ]);

  const outSwapAmount = useMemo(
    () =>
      outSwapToken && quotedData
        ? getAmountInToken(outSwapToken, quotedData.outSwapAmount)
        : "",
    [outSwapToken, quotedData],
  );

  const isReadyForSwap = useMemo(
    () =>
      !!inSwapAmount &&
      Number(inSwapAmount) > 0 &&
      !!inSwapToken &&
      !!outSwapToken &&
      !!quotedData,
    [inSwapAmount, inSwapToken, outSwapToken, quotedData],
  );

  const handleReset = () => {
    setInSwapAmount("");
    setQuotedData(undefined);
  };

  useEffect(() => {
    if (!chainId) return;
    setInSwapAmount("");
    setInSwapToken(undefined);
    setOutSwapToken(undefined);
    setQuotedData(undefined);
  }, [chainId]);

  const handleSwap = useCallback(async () => {
    if (
      !isReadyForSwap ||
      !inSwapToken ||
      !outSwapToken ||
      !quotedData ||
      !clientSecret ||
      !sessionId ||
      !walletAddress ||
      !chainId
    )
      return;

    try {
      setIsProcessing(true);
      const getterAuth = { sessionId, clientSecret, chainId };
      const wallet = {
        signer: isSolana ? null : await getEthersSigner(chainId),
        solanaProvider: isSolana ? solanaProvider : undefined,
      };
      await executeSwap(
        wallet,
        { sessionId, authMode, clientSecret },
        getterAuth,
        inSwapToken,
        outSwapToken,
        inSwapAmount,
        quotedData,
      );
      toast.success("Swap confirmed");
      handleReset();
      refreshBalancesSoon();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Swap failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    isReadyForSwap,
    inSwapToken,
    outSwapToken,
    quotedData,
    clientSecret,
    sessionId,
    walletAddress,
    chainId,
    inSwapAmount,
    refreshBalancesSoon,
    authMode,
  ]);

  const setTokenAmountHandler = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>,
      setValue: (value: string) => void,
    ) => {
      if (/^[0-9]*[.]?[0-9]*$/.test(event.target.value)) {
        setValue(event.target.value);
      }
    },
    [],
  );

  const swapButtonText = useCallback(() => {
    if (!walletAddress) return "Connect Wallet";
    if (!inSwapToken || !outSwapToken) return "Select a token";
    if (!inSwapAmount || Number(inSwapAmount) === 0) return "Enter an amount";
    if (isPriceLoading) return "Fetching price";
    if (isFeeLoading) return "Calculating fee";
    if (hasInsufficientFunds) return "Insufficient balance";
    return isReadyForSwap ? "Swap" : "Enter an amount";
  }, [
    walletAddress,
    inSwapToken,
    outSwapToken,
    inSwapAmount,
    isPriceLoading,
    isFeeLoading,
    hasInsufficientFunds,
    isReadyForSwap,
  ]);

  const handleSubmit = useCallback(
    (e: SyntheticEvent) => e.preventDefault(),
    [],
  );

  return (
    <form onSubmit={handleSubmit} className="text-white">
      <div className="flex mx-[4%] justify-between items-center text-xl font-[500] my-4">
        <p>Swap</p>
        <SwapSettings
          slippageTolerance={slippageTolerance}
          setSlippageTollerance={setSlippageTolerance}
        />
      </div>
      <div className="flex flex-col gap-y-1 mb-4">
        <div className="flex items-center justify-center bg-hinkal-blue-900 w-[96%] mx-auto rounded-xl py-5">
          <input
            type="text"
            placeholder="0"
            className="w-[96%] grow bg-transparent rounded-lg ml-[5%] text-[20px] pl-2 outline-none placeholder:text-[20px] text-white text-4xl placeholder:text-4xl"
            disabled={isProcessing}
            onChange={(event) => setTokenAmountHandler(event, setInSwapAmount)}
            value={inSwapAmount}
          />
          <div className="flex items-center grow gap-2 h-full min-w-fit">
            <div className="flex flex-col gap-2 items-end justify-end grow max-w-fit">
              <SelectToken
                swapToken={inSwapToken}
                onTokenChange={(prev, cur) => {
                  setInSwapToken(cur);
                  if (
                    outSwapToken?.erc20TokenAddress === cur?.erc20TokenAddress
                  )
                    setOutSwapToken(prev);
                }}
                disabled={isProcessing}
                tokenFilter={inTokenFilter}
              />
              {inSwapBalanceDisplay && (
                <span className="text-hinkal-white-100 text-[12px] mr-[15px]">
                  Balance: {inSwapBalanceDisplay}
                </span>
              )}
            </div>
          </div>
        </div>
        <SwapInputTokensButton
          onClick={() => {
            setInSwapToken(outSwapToken);
            setOutSwapToken(inSwapToken);
          }}
        />
        <div className="bg-hinkal-blue-900 flex w-[96%] mx-auto rounded-xl py-5">
          <input
            type="text"
            placeholder="0"
            className="w-full grow bg-transparent rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] text-white text-4xl placeholder:text-4xl"
            disabled
            value={
              outSwapAmount === undefined || outSwapAmount.length === 0
                ? "0"
                : Number(outSwapAmount).toFixed(4)
            }
          />
          <div className="flex flex-col gap-2 items-end justify-end grow min-w-fit">
            <SelectToken
              swapToken={outSwapToken}
              onTokenChange={(prev, cur) => {
                setOutSwapToken(cur);
                if (inSwapToken?.erc20TokenAddress === cur?.erc20TokenAddress)
                  setInSwapToken(prev);
              }}
              disabled={isProcessing}
            />
          </div>
        </div>
        {(isReadyForSwap || isPriceLoading) && (
          <div
            onClick={() => setPriceDetailsShown((prev) => !prev)}
            className="bg-hinkal-blue-900 w-[96%] mx-auto rounded-xl py-5"
          >
            <div className="flex justify-between items-center mr-[6%]">
              <div className="mx-[6%] flex items-center gap-x-2">
                {isPriceLoading ? (
                  <div className="flex items-center gap-x-2">
                    <Spinner /> <span>Fetching best price</span>
                  </div>
                ) : (
                  <span>
                    1 {outSwapToken?.symbol} ={" "}
                    {(Number(inSwapAmount) / Number(outSwapAmount)).toFixed(6)}{" "}
                    {inSwapToken?.symbol}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {feeDisplay && (
          <div className="w-[96%] mx-auto px-[2%] text-[12px] text-hinkal-gray-100">
            Network fee: {feeDisplay}
          </div>
        )}
      </div>
      <div className="w-[90%] mx-auto mb-4 mt-[20px] h-[1px] bg-hinkal-blue-900" />
      <div className="border-solid">
        <button
          type="button"
          disabled={swapButtonText() !== "Swap" || isProcessing}
          onClick={handleSwap}
          className={`w-[90%] ml-[5%] mb-3 md:mx-[5%] rounded-lg h-10 mt-3 text-sm font-semibold outline-none ${
            swapButtonText() === "Swap" && !isProcessing
              ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
              : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <div className="mx-[5%] flex items-center justify-center gap-x-2">
              <span>Swapping</span> <Spinner />
            </div>
          ) : (
            <span>{swapButtonText()}</span>
          )}
        </button>
      </div>
    </form>
  );
};
