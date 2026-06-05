import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { InfoPanel } from "../components/InfoPanel";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { SwapInputTokensButton } from "../components/swap/SwapInputTokensButton";
import { SwapSettings } from "../components/swap/SwapSettings";
import { useAppContext } from "../AppContext";
import { getAmountInToken } from "../utils/amount.utils";
import { ERC20Token } from "../types";
import { getSwapData, executeSwap, type SwapData } from "../utils/swap";
import { getEthersSigner } from "../utils/ethers-wallet";

export const Swap = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce, hasWriteAccess } =
    useAppContext();
  const [inSwapAmount, setInSwapAmount] = useState("");
  const [inSwapToken, setInSwapToken] = useState<ERC20Token | undefined>();
  const [outSwapToken, setOutSwapToken] = useState<ERC20Token | undefined>();
  const [priceDetailsShown, setPriceDetailsShown] = useState(false);
  const [relayerInfoShown, setRelayerInfoShown] = useState(false);

  const [quotedData, setQuotedData] = useState<SwapData | undefined>();
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState("0.10");

  useEffect(() => {
    setQuotedData(undefined);

    if (
      !chainId ||
      !walletAddress ||
      !signature ||
      !nonce ||
      !inSwapToken ||
      !outSwapToken ||
      !inSwapAmount ||
      Number(inSwapAmount) <= 0
    )
      return;

    const auth = { signature, nonce, address: walletAddress, chainId };
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
          toast.error(
            err instanceof Error ? err.message : "Quote fetch failed",
          );
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
    signature,
    nonce,
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

  const handleSwap = useCallback(async () => {
    if (
      !isReadyForSwap ||
      !inSwapToken ||
      !outSwapToken ||
      !quotedData ||
      !signature ||
      !nonce ||
      !walletAddress ||
      !chainId
    )
      return;

    try {
      setIsProcessing(true);
      const getterAuth = { signature, nonce, address: walletAddress, chainId };
      const signer = await getEthersSigner(chainId);
      await executeSwap(
        signer,
        { signature, nonce, hasWriteAccess },
        walletAddress,
        getterAuth,
        inSwapToken,
        outSwapToken,
        inSwapAmount,
        quotedData,
      );
      setInSwapAmount("");
      await refreshBalances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsProcessing(false);
    }
  }, [
    isReadyForSwap,
    inSwapToken,
    outSwapToken,
    quotedData,
    signature,
    nonce,
    walletAddress,
    chainId,
    inSwapAmount,
    refreshBalances,
    hasWriteAccess,
  ]);

  const setTokenAmountHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
    setValue: (value: string) => void,
  ) => {
    if (/^[0-9]*[.]?[0-9]*$/.test(event.target.value)) {
      setValue(event.target.value);
    }
  };

  const swapButtonText = () => {
    if (!walletAddress) return "Connect Wallet";
    if (!inSwapToken || !outSwapToken) return "Select a token";
    if (!inSwapAmount || Number(inSwapAmount) === 0) return "Enter an amount";
    if (isPriceLoading) return "Fetching price";
    return isReadyForSwap ? "Swap" : "Enter an amount";
  };

  const handleSubmit = (e: SyntheticEvent) => e.preventDefault();

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
        <div className="flex items-center justify-center bg-[#272B30] w-[96%] mx-auto rounded-xl py-5">
          <input
            type="text"
            placeholder="0"
            className="w-[96%] grow bg-transparent rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] text-white text-4xl placeholder:text-4xl"
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
              />
            </div>
          </div>
        </div>
        <SwapInputTokensButton
          onClick={() => {
            setInSwapToken(outSwapToken);
            setOutSwapToken(inSwapToken);
          }}
        />
        <div className="bg-[#272B30] flex w-[96%] mx-auto rounded-xl py-5">
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
            className="bg-[#272B30] w-[96%] mx-auto rounded-xl py-5"
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
              <i
                className={`bi bi-chevron-${
                  priceDetailsShown ? "up" : "down"
                } font-bold`}
              />
            </div>
          </div>
        )}
      </div>
      <div className="w-[90%] mx-auto mb-4 mt-[20px] h-[1px] bg-[#272B30]" />
      <div className="border-solid">
        <button
          type="button"
          disabled={swapButtonText() !== "Swap" || isProcessing}
          onClick={handleSwap}
          className={`w-[90%] ml-[5%] mb-3 md:mx-[5%] rounded-lg h-10 mt-3 text-sm font-semibold outline-none ${
            swapButtonText() === "Swap" && !isProcessing
              ? "bg-primary text-white hover:bg-[#4d32fa] duration-200"
              : "bg-[#37363d] text-[#848688] cursor-not-allowed"
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
