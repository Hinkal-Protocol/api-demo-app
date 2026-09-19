import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { useAppContext } from "../AppContext";
import { ReceiveVaultRecord } from "../types";
import { copyToClipboard } from "../utils/copyToClipboard";
import { getFriendlyErrorMessage } from "../utils/errors";
import { createReceiveAddress } from "../utils/receiveVault";

export const Receive = () => {
  const {
    chainId,
    sessionId,
    privateKey,
    walletAddress,
    refreshReceiveVaultAccount,
  } = useAppContext();

  const [record, setRecord] = useState<ReceiveVaultRecord | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // A stale response must not overwrite a newer one when the chain changes or
  // the user asks for a fresh address while a request is still in flight.
  const requestIdRef = useRef(0);

  const handOutAddress = useCallback(
    async (forceFresh: boolean) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      if (!chainId || !sessionId || !privateKey) {
        setRecord(undefined);
        setError(undefined);
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const claimed = await createReceiveAddress(
          { sessionId, privateKey },
          chainId,
          forceFresh,
        );
        if (requestIdRef.current !== requestId) return;
        setRecord(claimed);
        refreshReceiveVaultAccount();
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setRecord(undefined);
        setError(
          getFriendlyErrorMessage(err, "Could not create a deposit address"),
        );
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [chainId, sessionId, privateKey, refreshReceiveVaultAccount],
  );

  useEffect(() => {
    setRecord(undefined);
    handOutAddress(false);
  }, [handOutAddress]);

  const handleCopyAddress = useCallback(() => {
    try {
      if (!record) return;
      copyToClipboard(record.vaultAddress);
      toast.success("Deposit address copied to clipboard");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Failed to copy the address"));
    }
  }, [record]);

  const isDisabled = !walletAddress || !record || isLoading;

  return (
    <div className="text-white">
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
          placeholder={isLoading ? "Creating address…" : "No deposit address"}
          className="bg-hinkal-blue-900 h-10 w-full rounded-lg text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
          value={record?.vaultAddress ?? ""}
        />
        {error && (
          <p className="text-hinkal-red-100 text-[13px] mt-1">{error}</p>
        )}
      </div>

      <div className="w-[96%] mx-auto mb-4 text-[12px] text-hinkal-gray-100">
        <p>
          Send any supported token to this address on any supported chain, the
          way you would to any other wallet: what arrives is shielded into your
          private balance. Anything else sent here can only be recovered to a
          wallet you choose, from Stuck Balances.
        </p>
      </div>

      <div className="w-[90%] mx-auto mb-4 mt-[20px] h-[1px] bg-hinkal-blue-900" />
      <div className="border-solid">
        <button
          type="button"
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
        <button
          type="button"
          disabled={!walletAddress || isLoading}
          onClick={() => handOutAddress(true)}
          className="w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none border border-hinkal-blue-900 text-white hover:bg-hinkal-blue-900 transition-all duration-300 disabled:cursor-not-allowed disabled:text-hinkal-gray-200"
        >
          Generate new address
        </button>
      </div>
    </div>
  );
};
