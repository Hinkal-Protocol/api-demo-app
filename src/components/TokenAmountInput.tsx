import { Listbox, Transition } from "@headlessui/react";
import { Fragment, SetStateAction, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Spinner } from "./Spinner";
import VectorDown from "../assets/VectorDown.svg";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getTokenBalanceDisplay } from "../utils/amount.utils";
import { getErc20Balance, getNativeBalance } from "../utils/ethers-wallet";
import {
  getTronErc20Balance,
  getTronNativeBalance,
  isTronChain,
} from "../utils/tron-wallet";
import {
  getSolanaNativeBalance,
  getSolanaTokenBalance,
  isSolanaChain,
  SOLANA_NATIVE_ADDRESS,
} from "../utils/solana-wallet";

interface TokenAmountInputInterface {
  buttonWrapperStyles?: string;
  tokenAmount: string;
  setTokenAmount: (param: SetStateAction<string>) => void;
  selectedToken: ERC20Token | undefined;
  setSelectedToken: (param: SetStateAction<ERC20Token | undefined>) => void;
  withWalletBalance?: boolean;
  withShieldedBalance?: boolean;
  tokenFilter?: (token: ERC20Token) => boolean;
  isTokensLoading?: boolean;
}

export const TokenAmountInput = ({
  buttonWrapperStyles,
  tokenAmount,
  setTokenAmount,
  selectedToken,
  setSelectedToken,
  withWalletBalance = false,
  withShieldedBalance = false,
  tokenFilter,
  isTokensLoading = false,
}: TokenAmountInputInterface) => {
  const { erc20List, walletAddress, chainId, balances } = useAppContext();
  const [walletBalanceDisplay, setWalletBalanceDisplay] = useState<
    string | null
  >(null);

  const filteredTokens = useMemo(
    () => (tokenFilter ? erc20List.filter(tokenFilter) : erc20List),
    [erc20List, tokenFilter]
  );

  useEffect(() => {
    if (filteredTokens.length === 0) {
      setSelectedToken(undefined);
      return;
    }
    setSelectedToken((prev) =>
      prev &&
      filteredTokens.some((t) => t.erc20TokenAddress === prev.erc20TokenAddress)
        ? prev
        : filteredTokens[0]
    );
  }, [filteredTokens, setSelectedToken]);

  const shieldedBalanceDisplay = useMemo(
    () =>
      selectedToken ? getTokenBalanceDisplay(balances, selectedToken) : null,
    [balances, selectedToken]
  );

  const isNative =
    selectedToken?.erc20TokenAddress.toLowerCase() === zeroAddress;

  useEffect(() => {
    let cancelled = false;

    const loadBalance = async () => {
      if (!walletAddress || !selectedToken || !chainId) {
        setWalletBalanceDisplay(null);
        return;
      }

      try {
        const isTron = isTronChain(chainId);
        const isSolanaNet = isSolanaChain(chainId);
        const solanaIsNative =
          selectedToken.erc20TokenAddress === SOLANA_NATIVE_ADDRESS;
        const balance = isTron
          ? isNative
            ? await getTronNativeBalance(walletAddress)
            : await getTronErc20Balance(
                selectedToken.erc20TokenAddress,
                walletAddress
              )
          : isSolanaNet
          ? solanaIsNative
            ? await getSolanaNativeBalance(walletAddress)
            : await getSolanaTokenBalance(
                selectedToken.erc20TokenAddress,
                walletAddress
              )
          : isNative
          ? await getNativeBalance(chainId, walletAddress)
          : await getErc20Balance(
              chainId,
              selectedToken.erc20TokenAddress,
              walletAddress
            );

        if (!cancelled) {
          setWalletBalanceDisplay(
            `${Number(
              ethers.formatUnits(balance, selectedToken.decimals)
            ).toFixed(4)} ${selectedToken.symbol}`
          );
        }
      } catch {
        if (!cancelled) setWalletBalanceDisplay(null);
      }
    };

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, selectedToken, chainId, isNative]);

  const setTokenAmountHandler = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const regExp = /^[0-9]*[.]?[0-9]*$/;
    if (regExp.test(event.target.value)) {
      setTokenAmount(event.target.value);
    }
  };

  return (
    <div className="flex flex-col item-center justify-center">
      {withWalletBalance && (
        <div className="flex justify-between items-center pl-[5%] pr-[5%]">
          <label className="text-white text-[14px] font-[300]">Token</label>
          {walletBalanceDisplay && (
            <span className="text-hinkal-gray-100 text-[12px]">
              Wallet: {walletBalanceDisplay}
            </span>
          )}
        </div>
      )}
      {withShieldedBalance && (
        <div className="flex justify-between items-center pl-[5%] pr-[5%]">
          <label className="text-white text-[14px] font-[300]">Token</label>
          {shieldedBalanceDisplay && (
            <span className="text-hinkal-gray-100 text-[12px]">
              Balance: {shieldedBalanceDisplay}
            </span>
          )}
        </div>
      )}
      <div
        className={`flex justify-center mt-1 mb-8 ${buttonWrapperStyles} w-[90%] mx-auto relative`}
      >
        <Listbox
          disabled={false}
          value={selectedToken}
          onChange={setSelectedToken}
          as="div"
          className="flex flex-col relative w-[50%] min-[375px]:w-[40%] lg:w-[35%]"
        >
          {({ open }) => (
            <>
              <Listbox.Button
                className={`h-10 px-2 md:px-0 text-white bg-hinkal-blue-900 rounded-l-lg ${
                  open ? "rounded-l-[0px] rounded-tl-lg" : ""
                } outline-none flex items-center justify-center gap-x-2 w-full ${
                  true ? "cursor-pointer" : "cursor-not-allowed"
                } `}
              >
                {selectedToken ? (
                  <>
                    {selectedToken.logoURI && (
                      <img
                        src={selectedToken.logoURI}
                        alt={selectedToken.symbol}
                        className="w-[26px]"
                      />
                    )}
                    <span>{selectedToken.symbol}</span>
                  </>
                ) : isTokensLoading ? (
                  <span className="flex items-center gap-x-1 text-hinkal-gray-100 text-sm">
                    <Spinner /> Loading
                  </span>
                ) : (
                  <span className="text-hinkal-gray-100 text-sm">
                    {walletAddress ? "Select token" : "Connect to select"}
                  </span>
                )}
                {!open ? (
                  <VectorDown />
                ) : (
                  <div className="rotate-180">
                    <VectorDown />
                  </div>
                )}
              </Listbox.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0 -translate-y-2"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 -translate-y-2"
              >
                <Listbox.Options className="absolute w-full top-10 text-white flex flex-col bg-hinkal-blue-900 rounded-b-lg z-20 max-h-80 overflow-y-auto">
                  {isTokensLoading ? (
                    <div className="flex items-center justify-center gap-x-2 py-3 text-sm text-hinkal-gray-100">
                      <Spinner /> <span>Loading tokens</span>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="py-3 text-center text-sm text-hinkal-gray-100">
                      No tokens available
                    </div>
                  ) : (
                    filteredTokens.map((token, index) => (
                      <Listbox.Option
                        key={token.name + token.erc20TokenAddress}
                        value={token}
                        className={`cursor-pointer py-2 flex items-center gap-x-2 pl-[8px] ${
                          token?.name === selectedToken?.name
                            ? "bg-hinkal-gray-300"
                            : ""
                        } ${
                          index === filteredTokens.length - 1
                            ? " rounded-b-lg"
                            : ""
                        }  `}
                      >
                        <img
                          src={token?.logoURI}
                          alt="tokenIcon"
                          className="w-[26px]"
                        />{" "}
                        <span>{token?.symbol}</span>
                      </Listbox.Option>
                    ))
                  )}
                </Listbox.Options>
              </Transition>
            </>
          )}
        </Listbox>
        <input
          autoComplete="off"
          type="text"
          id="totalAmount"
          placeholder="Token amount"
          className={`bg-hinkal-blue-900 h-10 w-[50%] min-[375px]:w-[60%] lg:w-[65%] text-white text-[14px] rounded-r-lg pl-[15px] outline-none ${
            true ? "" : "cursor-not-allowed"
          } `}
          disabled={false}
          onChange={(event) => setTokenAmountHandler(event)}
          value={tokenAmount}
        />
      </div>
    </div>
  );
};
