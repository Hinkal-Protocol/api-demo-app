import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { useAppContext } from "../AppContext";
import { ReceiveVaultRecord } from "../types";
import { copyToClipboard } from "../utils/copyToClipboard";
import { getFriendlyErrorMessage } from "../utils/errors";
import { createReceiveAddress } from "../utils/receiveVault";
import { networkRegistry } from "../constants/chain.constants";
import { BRIDGE_DESTINATION_CHAIN_IDS } from "../constants/bridge.constants";

const getChainName = (chainId: number): string =>
  networkRegistry[chainId]?.name ?? String(chainId);

export const DepositAddress = () => {
  const { sessionId, privateKey, walletAddress } = useAppContext();

  const [selectedChainId, setSelectedChainId] = useState<number>(
    BRIDGE_DESTINATION_CHAIN_IDS[0],
  );
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

      if (!sessionId || !privateKey) {
        setRecord(undefined);
        setError(undefined);
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const claimed = await createReceiveAddress(
          { sessionId, privateKey },
          selectedChainId,
          forceFresh,
        );
        if (requestIdRef.current !== requestId) return;
        setRecord(claimed);
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
    [sessionId, privateKey, selectedChainId],
  );

  // A deposit address belongs to one network, so drop it on chain change.
  useEffect(() => {
    requestIdRef.current += 1;
    setRecord(undefined);
    setError(undefined);
    setIsLoading(false);
  }, [selectedChainId]);

  const handlePrimaryClick = useCallback(() => {
    try {
      if (!record) {
        handOutAddress(false);
        return;
      }
      copyToClipboard(record.vaultAddress);
      toast.success("Deposit address copied to clipboard");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Failed to copy the address"));
    }
  }, [record, handOutAddress]);

  const isDisabled = !walletAddress || !sessionId || isLoading;

  return (
    <div className="text-white">
      <div className="w-[96%] mx-auto mb-4">
        <label
          htmlFor="depositAddressChain"
          className="text-white text-[14px] font-[300]"
        >
          Chain
        </label>
        <select
          id="depositAddressChain"
          className="bg-hinkal-blue-900 h-10 w-full rounded-lg px-3 text-[14px] outline-none text-white mt-1"
          value={selectedChainId}
          disabled={isLoading}
          onChange={(e) => setSelectedChainId(Number(e.target.value))}
        >
          {BRIDGE_DESTINATION_CHAIN_IDS.map((id) => (
            <option key={id} value={id}>
              {getChainName(id)}
            </option>
          ))}
        </select>
      </div>

      <div className="w-[96%] mx-auto mb-4">
        <label
          htmlFor="depositAddress"
          className="text-white text-[14px] font-[300]"
        >
          Deposit address
        </label>
        <input
          id="depositAddress"
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
          Use it as the recipient of a private bridge to{" "}
          {getChainName(selectedChainId)}: what arrives is shielded into this
          account's private balance there. EVM chains share one address.
        </p>
      </div>

      <div className="w-[90%] mx-auto mb-4 mt-[20px] h-[1px] bg-hinkal-blue-900" />
      <div className="border-solid">
        <button
          type="button"
          disabled={isDisabled}
          onClick={handlePrimaryClick}
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
            <span>{record ? "Copy address" : "Generate deposit address"}</span>
          )}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => handOutAddress(true)}
          className="w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none border border-hinkal-blue-900 text-white hover:bg-hinkal-blue-900 transition-all duration-300 disabled:cursor-not-allowed disabled:text-hinkal-gray-200"
        >
          Generate new address
        </button>
      </div>
    </div>
  );
};
