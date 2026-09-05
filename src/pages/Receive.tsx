import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { useAppContext } from "../AppContext";
import { ERC20Token, ReceiveVaultRecord } from "../types";
import { getAmountInToken } from "../utils/amount.utils";
import { copyToClipboard } from "../utils/copyToClipboard";
import { getFriendlyErrorMessage } from "../utils/errors";
import { createReceiveAddress } from "../utils/receiveVault";
import { shortenAddress } from "../utils/shortenAddress";

const formatExpiry = (expiry: string) =>
  new Date(Number(expiry) * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const Receive = () => {
  const {
    chainId,
    sessionId,
    privateKey,
    walletAddress,
    receiveVaultEntries,
    refreshReceiveVaultAccount,
  } = useAppContext();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );
  const [record, setRecord] = useState<ReceiveVaultRecord | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSelectedToken(undefined);
  }, [chainId, walletAddress]);

  useEffect(() => {
    if (!selectedToken || !chainId || !sessionId || !privateKey) {
      setRecord(undefined);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setRecord(undefined);
    setError(undefined);

    createReceiveAddress(
      { sessionId, privateKey },
      chainId,
      selectedToken.erc20TokenAddress,
    )
      .then((claimed) => {
        if (cancelled) return;
        setRecord(claimed);
        refreshReceiveVaultAccount();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            getFriendlyErrorMessage(err, "Could not create a deposit address"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedToken,
    chainId,
    sessionId,
    privateKey,
    refreshReceiveVaultAccount,
  ]);

  const handleCopyAddress = useCallback(() => {
    try {
      if (!record) return;
      copyToClipboard(record.vaultAddress);
      toast.success("Deposit address copied to clipboard");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Failed to copy the address"));
    }
  }, [record]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const feeDisplay = useMemo(
    () =>
      record && selectedToken
        ? `${Number(getAmountInToken(selectedToken, record.maxFlatFee)).toFixed(
            6,
          )} ${selectedToken.symbol}`
        : null,
    [record, selectedToken],
  );

  const isDisabled = useMemo(
    () => !walletAddress || !record || isLoading,
    [walletAddress, record, isLoading],
  );

  return (
    <div className="text-white">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col w-[96%] mx-auto mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-white text-[14px] font-[300]">Token</span>
          </div>
          <div className="flex items-center gap-2">
            <SelectToken
              swapToken={selectedToken}
              onTokenChange={(_prev, cur) => setSelectedToken(cur)}
              disabled={!walletAddress || isLoading}
            />
          </div>
        </div>

        <div className="w-[96%] mx-auto mb-4">
          <label
            htmlFor="receiveAddress"
            className="text-white text-[14px] font-[300]"
          >
            Deposit address
          </label>
          <input
            id="receiveAddress"
            type="text"
            readOnly
            placeholder="Select a token to get an address"
            className="bg-hinkal-blue-900 h-10 w-full rounded-lg text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
            value={record?.vaultAddress ?? ""}
          />
          {error && (
            <p className="text-hinkal-red-100 text-[13px] mt-1">{error}</p>
          )}
        </div>

        <div className="w-[96%] mx-auto mb-4 text-[12px] text-hinkal-gray-100">
          {feeDisplay && record && (
            <>
              <p>Network fee: up to {feeDisplay}</p>
              <p>Address expires: {formatExpiry(record.expiry)}</p>
            </>
          )}
          <p className="mt-1">
            Send {selectedToken?.symbol ?? "assets"} to this address the way you
            would to any other wallet: what arrives is shielded into your
            private balance. Anything else sent here can only be recovered to a
            wallet you choose, from Stuck Balances.
          </p>
        </div>

        <div className="w-[90%] mx-auto mb-4 mt-[20px] h-[1px] bg-hinkal-blue-900" />
        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleCopyAddress}
            className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
                : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-x-2">
                <span>Creating address</span> <Spinner />
              </div>
            ) : (
              <span>Copy address</span>
            )}
          </button>
        </div>
      </form>

      {receiveVaultEntries.length > 0 && (
        <div className="w-[90%] mx-[5%] mt-2 p-3 rounded-lg bg-hinkal-blue-900 text-sm">
          <p className="font-semibold mb-2">Your deposit addresses</p>
          {receiveVaultEntries.map((entry) => (
            <p
              key={`${entry.record.vaultAddress}-${entry.token.erc20TokenAddress}`}
              className="text-hinkal-gray-200"
            >
              {entry.token.symbol}: {shortenAddress(entry.record.vaultAddress)}{" "}
              (expires {formatExpiry(entry.record.expiry)})
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
