import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { useAppContext } from "../AppContext";
import { getFriendlyErrorMessage } from "../utils/errors";
import { getEthersSigner } from "../utils/ethers-wallet";
import { copyToClipboard } from "../utils/copyToClipboard";
import {
  getRecipientAddressError,
  isValidRecipientAddress,
} from "../utils/recipientAddress";
import {
  BoundReceiveRecord,
  createBoundReceiveAddress,
} from "../utils/receiveAddressBound";

export const BoundReceive = () => {
  const { walletAddress, chainId, sessionId, privateKey, authMode } =
    useAppContext();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [record, setRecord] = useState<BoundReceiveRecord | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setRecipientAddress("");
    setRecord(undefined);
  }, [chainId]);

  const isRecipientAddressValid = useMemo(
    () => isValidRecipientAddress(recipientAddress, false, false),
    [recipientAddress],
  );

  const handleCreate = useCallback(async () => {
    try {
      if (!chainId || !walletAddress || !sessionId || !privateKey) return;
      setIsProcessing(true);
      const wallet = { signer: await getEthersSigner(chainId) };
      const session = { sessionId, authMode, privateKey };
      setRecord(
        await createBoundReceiveAddress(
          wallet,
          session,
          chainId,
          recipientAddress,
        ),
      );
      toast.success("Bound receive address created");
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, "Create bound receive address failed"),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    walletAddress,
    sessionId,
    privateKey,
    authMode,
    recipientAddress,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = !walletAddress || !isRecipientAddressValid || isProcessing;

  return (
    <div>
      <form className="rounded-lg" onSubmit={handleSubmit}>
        <div className="text-white">
          <label
            htmlFor="recipientAddressBoundReceive"
            className="text-white pl-[5%] text-[14px] font-[300]"
          >
            Withdraw recipient{" "}
          </label>
          <br />
          <input
            id="recipientAddressBoundReceive"
            type="text"
            placeholder="Funds sent to the address below go here"
            className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-4 pl-2 outline-none placeholder:text-[13.5px] mt-1"
            disabled={isProcessing}
            onChange={(event) => setRecipientAddress(event.target.value)}
            value={recipientAddress}
          />
          {recipientAddress && !isRecipientAddressValid && walletAddress && (
            <p className="text-hinkal-red-100 text-[13px] pl-[5%] mt-1">
              {getRecipientAddressError(false, false, false)}
            </p>
          )}
        </div>
        {record && (
          <div className="px-[5%] mb-2 text-[13px] text-hinkal-gray-100 break-all">
            <p>Send tokens to:</p>
            <button
              type="button"
              className="text-white text-left"
              onClick={() => {
                copyToClipboard(record.vaultAddress);
                toast.success("Copied");
              }}
            >
              {record.vaultAddress}
            </button>
            <p>
              Expires: {new Date(Number(record.expiry) * 1000).toLocaleString()}
            </p>
          </div>
        )}
        <div className="w-[90%] mx-auto mb-4 mt-2 h-[1px] bg-hinkal-blue-900" />
        <button
          type="submit"
          disabled={isDisabled}
          onClick={handleCreate}
          className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 mt-3 text-sm font-semibold outline-none ${
            !isDisabled
              ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
              : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
          } `}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-x-2">
              <span>Creating</span> <Spinner />
            </div>
          ) : (
            <span>Create bound address</span>
          )}
        </button>
      </form>
    </div>
  );
};
