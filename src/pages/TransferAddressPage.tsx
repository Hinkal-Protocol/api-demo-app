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
  ReceiveAddressRecord,
  RefundToChainStuck,
  createTransferAddress,
  createTransferAddressWithApiKey,
  createReceiveAddress,
  fetchReceiveAddresses,
  fetchRefundToStuckBalances,
  recoverReceiveVault,
} from "../utils/transferAddress";
import { formatUnits } from "ethers";
import { zeroAddress } from "../constants";
import {
  getSolanaBalance,
  isSolanaChain,
  SOLANA_NATIVE_ADDRESS,
} from "../utils/solana-wallet";
import { isTronChain } from "../utils/tron-wallet";
import { fetchStuckBalances } from "../utils/balance";
import { recoverStuckBalance } from "../utils/withdraw";
import type { TokenBalance } from "../types";
import type { ReceiveVaultNetwork } from "../utils/types";

// Bridge destinations with their native token and USDC/USDT, as the token registry spells them.
const SLIPPAGE_OPTIONS = ["0.5", "1", "2", "3", "5"];

const BRIDGE_DESTINATIONS: {
  chainId: number;
  name: string;
  tokens: { symbol: string; address: string }[];
}[] = [
  {
    chainId: 1,
    name: "Ethereum",
    tokens: [
      { symbol: "ETH", address: zeroAddress },
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    ],
  },
  {
    chainId: 8453,
    name: "Base",
    tokens: [
      { symbol: "ETH", address: zeroAddress },
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    ],
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    tokens: [
      { symbol: "ETH", address: zeroAddress },
      { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" },
    ],
  },
  {
    chainId: 137,
    name: "Polygon",
    tokens: [
      { symbol: "POL", address: zeroAddress },
      { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    ],
  },
  {
    chainId: 56,
    name: "BNB Chain",
    tokens: [
      { symbol: "BNB", address: zeroAddress },
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
    ],
  },
  {
    chainId: 501,
    name: "Solana",
    tokens: [
      { symbol: "SOL", address: "11111111111111111111111111111111" },
      {
        symbol: "USDC",
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
    ],
  },
  {
    chainId: 728126428,
    name: "Tron",
    tokens: [{ symbol: "USDT", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }],
  },
];

export const TransferAddressPage = () => {
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
  const [refundTo, setRefundTo] = useState("");
  // The API-key route needs no wallet, so its network is picked here.
  const [apiKeyNetwork, setApiKeyNetwork] = useState<ReceiveVaultNetwork>("evm");
  const [acceptedChainIds, setAcceptedChainIds] = useState<number[]>([]);
  const [destinationChainId, setDestinationChainId] = useState("");
  const [destinationTokenAddress, setDestinationTokenAddress] = useState("");
  const [slippagePercentage, setSlippagePercentage] = useState("");
  const [record, setRecord] = useState<ReceiveAddressRecord | undefined>();
  const [isTransfer, setIsTransfer] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recoverToken, setRecoverToken] = useState("");
  const [recoverRecipient, setRecoverRecipient] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [addresses, setAddresses] = useState<ReceiveAddressRecord[]>([]);
  // Native balance per vault (EVM and Solana); Tron is not read.
  const [vaultBalances, setVaultBalances] = useState<Record<string, bigint>>(
    {},
  );
  const [bridgeRefunds, setBridgeRefunds] = useState<TokenBalance[]>([]);
  const [refundRecipient, setRefundRecipient] = useState("");
  const [recoveringRefund, setRecoveringRefund] = useState<
    string | undefined
  >();
  const [stuckRefundTo, setStuckRefundTo] = useState("");
  const [refundToStuck, setRefundToStuck] = useState<
    RefundToChainStuck[] | undefined
  >();
  const [isLoadingStuck, setIsLoadingStuck] = useState(false);

  useEffect(() => {
    setRecipientAddress("");
    setRefundTo("");
    setDestinationChainId("");
    setDestinationTokenAddress("");
    setSlippagePercentage("");
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
      const entries = await fetchReceiveAddresses({
        sessionId,
        privateKey,
        chainId,
      });
      setAddresses(entries);
      if (isTron) return;
      const provider = isSolana
        ? undefined
        : (await getEthersSigner(chainId))?.provider;
      if (!isSolana && !provider) return;
      const balances = await Promise.all(
        entries.map((entry) =>
          isSolana
            ? getSolanaBalance(entry.vaultAddress)
            : provider!.getBalance(entry.vaultAddress),
        ),
      );
      setVaultBalances(
        Object.fromEntries(
          entries.map((entry, i) => [entry.vaultAddress, balances[i]]),
        ),
      );
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, "Fetch receive addresses failed"),
      );
    }
  }, [chainId, sessionId, privateKey, isTron, isSolana]);

  useEffect(() => {
    setAddresses([]);
    setVaultBalances({});
    void loadAddresses();
  }, [loadAddresses]);

  const loadBridgeRefunds = useCallback(async () => {
    try {
      if (!chainId || !sessionId || !privateKey) return;
      const stuck = await fetchStuckBalances({
        sessionId,
        privateKey,
        chainId,
      });
      setBridgeRefunds(
        stuck.flatMap(({ sources, ...balance }) =>
          sources
            .filter(({ kind }) => kind === "bridge")
            .map(({ amount }) => ({ ...balance, balance: amount })),
        ),
      );
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Fetch bridge refunds failed"));
    }
  }, [chainId, sessionId, privateKey]);

  const handleRecoverRefund = useCallback(
    async (tokenAddress: string) => {
      try {
        if (!chainId || !sessionId || !privateKey) return;
        setRecoveringRefund(tokenAddress);
        const { recoveredAmount } = await recoverStuckBalance(
          await getWallet(),
          { sessionId, authMode, privateKey },
          chainId,
          {
            tokenAddress,
            recipientAddress: refundRecipient.trim(),
            kind: "bridge",
          },
        );
        toast.success(`Recovered ${recoveredAmount}`);
        void loadBridgeRefunds();
      } catch (err) {
        toast.error(
          getFriendlyErrorMessage(err, "Recover bridge refund failed"),
        );
      } finally {
        setRecoveringRefund(undefined);
      }
    },
    [
      chainId,
      sessionId,
      privateKey,
      authMode,
      refundRecipient,
      getWallet,
      loadBridgeRefunds,
    ],
  );

  const bridge = useMemo(
    () =>
      destinationChainId
        ? {
            destinationChainId: Number(destinationChainId),
            destinationTokenAddress: destinationTokenAddress.trim(),
            ...(slippagePercentage && { slippagePercentage }),
          }
        : undefined,
    [destinationChainId, destinationTokenAddress, slippagePercentage],
  );
  // A bridged payment lands on the destination chain, so the recipient is in that chain's format.
  const recipientIsSolana = bridge
    ? isSolanaChain(bridge.destinationChainId)
    : isSolana;
  const recipientIsTron = bridge
    ? isTronChain(bridge.destinationChainId)
    : isTron;

  const isRecipientAddressValid = useMemo(
    () =>
      isValidRecipientAddress(
        recipientAddress,
        recipientIsSolana,
        recipientIsTron,
      ),
    [recipientAddress, recipientIsSolana, recipientIsTron],
  );

  const handleCreate = useCallback(async () => {
    try {
      if (!chainId || !walletAddress || !sessionId || !privateKey) return;
      setIsProcessing(true);
      const session = { sessionId, authMode, privateKey };
      const created = await createTransferAddress(
        await getWallet(),
        session,
        chainId,
        recipientAddress,
        bridge,
      );
      // The create response has no payout terms; show the ones just signed until the list reloads.
      setRecord({ ...created, recipientAddress, ...bridge });
      setAcceptedChainIds([]);
      setIsTransfer(true);
      toast.success("Transfer address created");
      void loadAddresses();
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, "Create transfer address failed"),
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
    bridge,
    getWallet,
    loadAddresses,
  ]);

  // Without a bridge the recipient is paid on the vault's network, so it is in that network's format.
  const isApiKeyRecipientValid = useMemo(
    () =>
      isValidRecipientAddress(
        recipientAddress,
        bridge ? isSolanaChain(bridge.destinationChainId) : apiKeyNetwork === "solana",
        bridge ? isTronChain(bridge.destinationChainId) : apiKeyNetwork === "tron",
      ),
    [recipientAddress, bridge, apiKeyNetwork],
  );

  const handleCreateWithApiKey = useCallback(async () => {
    try {
      setIsProcessing(true);
      const created = await createTransferAddressWithApiKey(
        apiKeyNetwork,
        recipientAddress.trim(),
        refundTo.trim(),
        bridge,
      );
      setRecord(created.record);
      setAcceptedChainIds(created.acceptedChainIds);
      setIsTransfer(true);
      toast.success("Transfer address created (API key)");
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, "Create transfer address failed"),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [apiKeyNetwork, recipientAddress, refundTo, bridge]);

  const handleLoadRefundToStuck = useCallback(async () => {
    try {
      setIsLoadingStuck(true);
      setRefundToStuck(await fetchRefundToStuckBalances(stuckRefundTo.trim()));
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Fetch stuck balances failed"));
    } finally {
      setIsLoadingStuck(false);
    }
  }, [stuckRefundTo]);

  const handleCreateNormal = useCallback(async () => {
    try {
      if (!chainId || !walletAddress || !sessionId || !privateKey) return;
      setIsProcessing(true);
      setRecord(
        await createReceiveAddress(
          { sessionId, authMode, privateKey },
          chainId,
        ),
      );
      setIsTransfer(false);
      toast.success("Normal receive address created");
      void loadAddresses();
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, "Create receive address failed"),
      );
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
  }, [
    record,
    chainId,
    sessionId,
    privateKey,
    authMode,
    recoverToken,
    recoverRecipient,
    getWallet,
    loadAddresses,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled =
    !walletAddress ||
    !isRecipientAddressValid ||
    (!!bridge && !bridge.destinationTokenAddress) ||
    isProcessing;

  return (
    <div>
      <form className="rounded-lg" onSubmit={handleSubmit}>
        <div className="text-white">
          <label
            htmlFor="recipientAddressTransferAddress"
            className="text-white pl-[5%] text-[14px] font-[300]"
          >
            Withdraw recipient{" "}
          </label>
          <br />
          <input
            id="recipientAddressTransferAddress"
            type="text"
            placeholder="Funds sent to the address below go here"
            className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-4 pl-2 outline-none placeholder:text-[13.5px] mt-1"
            disabled={isProcessing}
            onChange={(event) => setRecipientAddress(event.target.value)}
            value={recipientAddress}
          />
          {recipientAddress && !isRecipientAddressValid && walletAddress && (
            <p className="text-hinkal-red-100 text-[13px] pl-[5%] mt-1">
              {getRecipientAddressError(
                recipientIsTron,
                recipientIsSolana,
                false,
              )}
            </p>
          )}
          <p className="text-white pl-[5%] text-[14px] font-[300]">
            Bridge each payment (optional)
          </p>
          <select
            className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none text-[13.5px] mt-1"
            disabled={isProcessing}
            onChange={(event) => {
              setDestinationChainId(event.target.value);
              const destination = BRIDGE_DESTINATIONS.find(
                ({ chainId: id }) => String(id) === event.target.value,
              );
              setDestinationTokenAddress(
                destination?.tokens.at(-1)?.address ?? "",
              );
            }}
            value={destinationChainId}
          >
            <option value="">No bridge — withdraw on this chain</option>
            {BRIDGE_DESTINATIONS.map(({ chainId: id, name }) => (
              <option key={id} value={id}>
                {name} ({id})
              </option>
            ))}
          </select>
          {destinationChainId && (
            <>
              <select
                className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none text-[13.5px]"
                disabled={isProcessing}
                onChange={(event) =>
                  setDestinationTokenAddress(event.target.value)
                }
                value={destinationTokenAddress}
              >
                {BRIDGE_DESTINATIONS.find(
                  ({ chainId: id }) => String(id) === destinationChainId,
                )?.tokens.map(({ symbol, address }) => (
                  <option key={address} value={address}>
                    {symbol}
                  </option>
                ))}
              </select>
              <select
                className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-4 pl-2 outline-none text-[13.5px]"
                disabled={isProcessing}
                onChange={(event) => setSlippagePercentage(event.target.value)}
                value={slippagePercentage}
              >
                <option value="">Slippage: route default</option>
                {SLIPPAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Slippage: {option}%
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {record && (
          <div className="px-[5%] mb-2 text-[13px] text-hinkal-gray-100 break-all">
            <p>
              {isTransfer ? "Transfer address" : "Normal address"} — send tokens
              to:
            </p>
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
            {record.recipientAddress && (
              <>
                <p>Pays out to: {record.recipientAddress}</p>
                {record.destinationChainId !== undefined && (
                  <p>
                    Bridged to chain {record.destinationChainId}, token{" "}
                    {record.destinationTokenAddress}
                  </p>
                )}
                <p className="text-yellow-400">
                  Tell the sender exactly which chain to send on: each payment
                  is paid out on the chain it is sent on.
                </p>
              </>
            )}
          </div>
        )}
        {/* {record && (
          <div className="mt-2">
            <p className="text-white pl-[5%] text-[14px] font-[300]">
              Recover funds sitting in this address
            </p>
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
        )} */}
        <div className="w-[90%] mx-auto mb-4 mt-2 h-[1px] bg-hinkal-blue-900" />
        {/* <button
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
            <span>Create transfer address</span>
          )}
        </button> */}
        <select
          className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none text-[13.5px] text-white"
          disabled={isProcessing}
          onChange={(event) =>
            setApiKeyNetwork(event.target.value as ReceiveVaultNetwork)
          }
          value={apiKeyNetwork}
        >
          <option value="evm">Network for API key route: EVM</option>
          <option value="solana">Network for API key route: Solana</option>
          <option value="tron">Network for API key route: Tron</option>
        </select>
        <input
          type="text"
          placeholder="Refund to (address on this network) — API key route"
          className="bg-hinkal-blue-900 h-10 w-[90%] ml-[5%] rounded-lg mb-3 pl-2 outline-none placeholder:text-[13.5px] text-white"
          disabled={isProcessing}
          onChange={(event) => setRefundTo(event.target.value)}
          value={refundTo}
        />
        <button
          type="button"
          disabled={
            !isApiKeyRecipientValid ||
            (!!bridge && !bridge.destinationTokenAddress) ||
            !refundTo.trim() ||
            isProcessing
          }
          onClick={handleCreateWithApiKey}
          className="w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200 disabled:cursor-not-allowed"
        >
          Create transfer address (API key, no signature)
        </button>
        {acceptedChainIds.length > 0 && (
          <p className="px-[5%] mb-3 text-[13px] text-hinkal-gray-100">
            API key address accepts payments on chains:{" "}
            {acceptedChainIds.join(", ")}
          </p>
        )}
        <div className="px-[5%] mt-2 mb-4 text-[13px] text-hinkal-gray-100">
          <p className="text-white text-[14px] font-[300] mb-1">
            Stuck funds for a refundTo (API key)
          </p>
          <input
            type="text"
            placeholder="Refund to address"
            className="bg-hinkal-blue-900 h-10 w-full rounded-lg mb-2 pl-2 outline-none placeholder:text-[13.5px] text-white"
            disabled={isLoadingStuck}
            onChange={(event) => setStuckRefundTo(event.target.value)}
            value={stuckRefundTo}
          />
          <button
            type="button"
            disabled={!stuckRefundTo.trim() || isLoadingStuck}
            onClick={() => void handleLoadRefundToStuck()}
            className="w-full rounded-lg h-10 mb-2 text-sm font-semibold outline-none bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200 disabled:cursor-not-allowed"
          >
            {isLoadingStuck ? "Checking every chain…" : "Check stuck funds"}
          </button>
          {refundToStuck?.length === 0 && <p>Nothing stuck.</p>}
          {refundToStuck?.map(({ chainId: id, balances, error }) => (
            <div key={id} className="rounded-lg p-2 mb-1 bg-hinkal-blue-900 break-all">
              <p className="text-white">Chain {id}</p>
              {error && <p className="text-hinkal-red-100">Scan failed: {error}</p>}
              {balances.map(({ tokenAddress, balance, sources }) => (
                <p key={tokenAddress}>
                  {balance} · {tokenAddress} (
                  {sources.map(({ kind, amount }) => `${kind} ${amount}`).join(", ")})
                </p>
              ))}
            </div>
          ))}
        </div>
        {/* <button
          type="button"
          disabled={!walletAddress || isProcessing}
          onClick={handleCreateNormal}
          className="w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200 disabled:cursor-not-allowed"
        >
          Create normal address
        </button> */}
        {addresses.length > 0 && (
          <div className="px-[5%] mt-2 mb-4 text-[13px] text-hinkal-gray-100">
            <div className="flex justify-between mb-1">
              <p className="text-white text-[14px] font-[300]">
                My deposit addresses
              </p>
              <button
                type="button"
                className="text-white"
                onClick={() => void loadAddresses()}
              >
                Refresh
              </button>
            </div>
            {addresses.map((entry) => (
              <button
                type="button"
                key={entry.vaultAddress}
                onClick={() => {
                  setRecord(entry);
                  setIsTransfer(!!entry.recipientAddress);
                  setRecoverToken(
                    isSolana ? SOLANA_NATIVE_ADDRESS : zeroAddress,
                  );
                }}
                className={`w-full text-left break-all rounded-lg p-2 mb-1 bg-hinkal-blue-900 ${
                  record?.vaultAddress === entry.vaultAddress
                    ? "text-white"
                    : ""
                }`}
              >
                {entry.recipientAddress ? "transfer" : "normal"} ·{" "}
                {entry.vaultAddress}
                {entry.recipientAddress && ` → ${entry.recipientAddress}`}
                {entry.destinationChainId !== undefined &&
                  ` (bridge to chain ${entry.destinationChainId})`}
                {entry.vaultAddress in vaultBalances &&
                  ` · ${formatUnits(
                    vaultBalances[entry.vaultAddress],
                    isSolana ? 9 : 18,
                  )} native`}
              </button>
            ))}
          </div>
        )}
        {/* <div className="px-[5%] mt-2 mb-4 text-[13px] text-hinkal-gray-100">
          <div className="flex justify-between mb-1">
            <p className="text-white text-[14px] font-[300]">
              Bridge refunds (temporary wallet / NEAR)
            </p>
            <button
              type="button"
              className="text-white"
              onClick={() => void loadBridgeRefunds()}
            >
              Refresh
            </button>
          </div>
          <input
            type="text"
            placeholder="Recover to (address on this chain)"
            className="bg-hinkal-blue-900 h-10 w-full rounded-lg mb-2 pl-2 outline-none placeholder:text-[13.5px] text-white"
            onChange={(event) => setRefundRecipient(event.target.value)}
            value={refundRecipient}
          />
          {bridgeRefunds.length === 0 && <p>None found — press Refresh.</p>}
          {bridgeRefunds.map((refund) => (
            <button
              type="button"
              key={refund.tokenAddress}
              disabled={!refundRecipient.trim() || !!recoveringRefund}
              onClick={() => void handleRecoverRefund(refund.tokenAddress)}
              className="w-full text-left break-all rounded-lg p-2 mb-1 bg-hinkal-blue-900 text-white disabled:text-hinkal-gray-200"
            >
              {recoveringRefund === refund.tokenAddress
                ? "Recovering… "
                : "Recover "}
              {refund.balance} · {refund.tokenAddress}
            </button>
          ))}
        </div> */}
      </form>
    </div>
  );
};
