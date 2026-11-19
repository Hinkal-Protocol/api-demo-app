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
  createReceiveAddress,
  fetchReceiveAddresses,
  recoverReceiveVault,
} from "../utils/receiveAddressBound";
import { formatUnits } from "ethers";
import { zeroAddress } from "../constants";
import { getSolanaBalance, SOLANA_NATIVE_ADDRESS } from "../utils/solana-wallet";

export const BoundReceive = () => {
  const {
    walletAddress,
    chainId,
    sessionId,
    privateKey,
    authMode,
    isSolana,
    isTron,
    solanaProvider,
  } = useAppContext();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [record, setRecord] = useState<BoundReceiveRecord | undefined>();
  const [isBound, setIsBound] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recoverToken, setRecoverToken] = useState("");
  const [recoverRecipient, setRecoverRecipient] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [addresses, setAddresses] = useState<BoundReceiveRecord[]>([]);
  // Native balance per vault (EVM and Solana); Tron is not read.
  const [vaultBalances, setVaultBalances] = useState<Record<string, bigint>>({});

  useEffect(() => {
    setRecipientAddress("");
    setRecord(undefined);
    setRecoverToken(isSolana ? SOLANA_NATIVE_ADDRESS : zeroAddress);
    setRecoverRecipient("");
  }, [chainId, isSolana]);

  const getWallet = useCallback(
    async () => ({
      signer: isTron || isSolana ? null : await getEthersSigner(chainId),
      solanaProvider: isSolana ? solanaProvider : undefined,
    }),
    [chainId, isTron, isSolana, solanaProvider],
  );

  const loadAddresses = useCallback(async () => {
    try {
      if (!chainId || !sessionId || !privateKey) return;
      const entries = await fetchReceiveAddresses({ sessionId, privateKey, chainId });
      setAddresses(entries);
      if (isTron) return;
      const provider = isSolana ? undefined : (await getEthersSigner(chainId))?.provider;
      if (!isSolana && !provider) return;
      const balances = await Promise.all(
        entries.map((entry) =>
          isSolana ? getSolanaBalance(entry.vaultAddress) : provider!.getBalance(entry.vaultAddress),
        ),
      );
      setVaultBalances(Object.fromEntries(entries.map((entry, i) => [entry.vaultAddress, balances[i]])));
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Fetch receive addresses failed"));
    }
  }, [chainId, sessionId, privateKey, isTron, isSolana]);

  useEffect(() => {
    setAddresses([]);
    setVaultBalances({});
    void loadAddresses();
  }, [loadAddresses]);

  const isRecipientAddressValid = useMemo(
    () => isValidRecipientAddress(recipientAddress, isSolana, isTron),
    [recipientAddress, isSolana, isTron],
  );

  const handleCreate = useCallback(async () => {
    try {
      if (!chainId || !walletAddress || !sessionId || !privateKey) return;
      setIsProcessing(true);
      const session = { sessionId, authMode, privateKey };
      setRecord(
        await createBoundReceiveAddress(
          await getWallet(),
          session,
          chainId,
          recipientAddress,
        ),
      );
      setIsBound(true);
      toast.success("Bound receive address created");
      void loadAddresses();
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
    getWallet,
    loadAddresses,
  ]);

  const handleCreateNormal = useCallback(async () => {
    try {
      if (!chainId || !walletAddress || !sessionId || !privateKey) return;
      setIsProcessing(true);
      setRecord(await createReceiveAddress({ sessionId, authMode, privateKey }, chainId));
      setIsBound(false);
      toast.success("Normal receive address created");
      void loadAddresses();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Create receive address failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [chainId, walletAddress, sessionId, privateKey, authMode, loadAddresses]);

  const handleRecover = useCallback(async () => {
    try {
      if (!record || !chainId || !sessionId || !privateKey) return;
      setIsRecovering(true);
      const txHash = await recoverReceiveVault(
        await getWallet(),
        { sessionId, authMode, privateKey },
        chainId,
        record.vaultAddress,
        recoverToken,
        recoverRecipient,
      );
      toast.success(`Recover sent: ${txHash}`);
      void loadAddresses();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Recover failed"));
    } finally {
      setIsRecovering(false);
    }
  }, [record, chainId, sessionId, privateKey, authMode, recoverToken, recoverRecipient, getWallet, loadAddresses]);

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
              {getRecipientAddressError(isTron, isSolana, false)}
            </p>
          )}
        </div>
        {record && (
          <div className="px-[5%] mb-2 text-[13px] text-hinkal-gray-100 break-all">
            <p>{isBound ? "Bound address" : "Normal address"} — send tokens to:</p>
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
        {record && (
          <div className="mt-2">
            <p className="text-white pl-[5%] text-[14px] font-[300]">Recover funds sitting in this address</p>
            <input
              type="text"
              placeholder="Token address"
              className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
              disabled={isRecovering}
              onChange={(event) => setRecoverToken(event.target.value)}
              value={recoverToken}
            />
            <input
              type="text"
              placeholder="Recover to"
              className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
              disabled={isRecovering}
              onChange={(event) => setRecoverRecipient(event.target.value)}
              value={recoverRecipient}
            />
            <button
              type="button"
              disabled={isRecovering || !recoverToken || !recoverRecipient}
              onClick={handleRecover}
              className="w-[90%] mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200 disabled:cursor-not-allowed"
            >
              {isRecovering ? "Recovering…" : "Recover"}
            </button>
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
        <button
          type="button"
          disabled={!walletAddress || isProcessing}
          onClick={handleCreateNormal}
          className="w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200 disabled:cursor-not-allowed"
        >
          Create normal (unbound) address
        </button>
        {addresses.length > 0 && (
          <div className="px-[5%] mt-2 mb-4 text-[13px] text-hinkal-gray-100">
            <div className="flex justify-between mb-1">
              <p className="text-white text-[14px] font-[300]">My deposit addresses</p>
              <button type="button" className="text-white" onClick={() => void loadAddresses()}>
                Refresh
              </button>
            </div>
            {addresses.map((entry) => (
              <button
                type="button"
                key={entry.vaultAddress}
                onClick={() => {
                  setRecord(entry);
                  setIsBound(!!entry.createBlockedUtxos);
                  setRecoverToken(isSolana ? SOLANA_NATIVE_ADDRESS : zeroAddress);
                }}
                className={`w-full text-left break-all rounded-lg p-2 mb-1 bg-hinkal-blue-900 ${
                  record?.vaultAddress === entry.vaultAddress ? "text-white" : ""
                }`}
              >
                {entry.createBlockedUtxos ? "bound" : "normal"} · {entry.vaultAddress}
                {entry.vaultAddress in vaultBalances &&
                  ` · ${formatUnits(vaultBalances[entry.vaultAddress], isSolana ? 9 : 18)} native`}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};
