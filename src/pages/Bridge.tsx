import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { getFriendlyErrorMessage } from "../utils/errors";
import { getERC20Registry } from "../constants/token-data";
import { chainIds, networkRegistry } from "../constants/chain.constants";
import { RecipientInputRow } from "../utils/recipientInfoRow";
import {
  formatScheduledTxStatus,
  isScheduledTxTerminal,
  OrderStatus,
  Recipient,
  resolveTxCompletionTime,
  ScheduledTransactionItem,
  TX_COMPLETION_TIME_OPTIONS,
  TxCompletionTimeLabel,
} from "../utils/multiSend";
import {
  getBridgeOrderStatus,
  getPrivateSendBridgeQuote,
  privateSendBridge,
  PrivateSendBridgeQuote,
} from "../utils/privateSendBridge";
import type { Auth } from "../utils/types";
import {
  approveErc20,
  broadcastDepositTx,
  getEthersSigner,
  requireEvmSigner,
} from "../utils/ethers-wallet";
import {
  approveAndBroadcastTronSerializedTx,
  isTronChain,
} from "../utils/tron-wallet";
import {
  broadcastSolanaTransaction,
  isSolanaChain,
} from "../utils/solana-wallet";
import { ButtonGroupWithLabel } from "../utils/buttonGroupWithLabel";
import {
  getRecipientAddressError,
  isValidRecipientAddress,
} from "../utils/recipientAddress";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const DESTINATION_CHAIN_IDS = [
  chainIds.ethMainnet,
  chainIds.arbMainnet,
  chainIds.optimism,
  chainIds.polygon,
  chainIds.base,
  chainIds.solanaMainnet,
  chainIds.tronMainnet,
];

const getChainName = (chainId: number): string =>
  networkRegistry[chainId]?.name ??
  (chainId === chainIds.solanaMainnet
    ? "Solana"
    : chainId === chainIds.tronMainnet
    ? "Tron"
    : String(chainId));

const waitForScheduledTxsComplete = async (
  auth: Auth,
  orderId: string,
  onUpdate: (txs: ScheduledTransactionItem[]) => void,
): Promise<void> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await getBridgeOrderStatus(auth, orderId);
    if (data.status === OrderStatus.Failed) {
      throw new Error("Order failed");
    }
    const txs = data.scheduledTransactions ?? [];
    onUpdate(txs);
    if (
      data.status === OrderStatus.Scheduled &&
      txs.length > 0 &&
      txs.every((tx) => isScheduledTxTerminal(tx.status))
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Order status poll timed out");
};

const emptyRecipient = (): Recipient => ({ address: "", amount: "" });

const TX_COMPLETION_TIME_LABELS = TX_COMPLETION_TIME_OPTIONS.map(
  (o) => o.label,
);

const selectClassName =
  "bg-hinkal-blue-900 h-10 rounded-lg px-3 text-[14px] outline-none text-white flex-1";

export const Bridge = () => {
  const {
    walletAddress,
    refreshBalances,
    chainId,
    sessionId,
    privateKey,
    authMode,
    isTron,
    isSolana,
    solanaProvider,
  } = useAppContext();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>();
  const [destinationChainId, setDestinationChainId] = useState<number>(
    chainIds.base,
  );
  const [destinationTokenAddress, setDestinationTokenAddress] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient()]);
  const [slippage, setSlippage] = useState("");
  const [txCompletionTimeLabel, setTxCompletionTimeLabel] =
    useState<TxCompletionTimeLabel>("Instant");
  const [quote, setQuote] = useState<PrivateSendBridgeQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [scheduledStatuses, setScheduledStatuses] = useState<
    ScheduledTransactionItem[]
  >([]);

  const destinationTokens = useMemo(
    () => getERC20Registry(destinationChainId) ?? [],
    [destinationChainId],
  );
  const destinationToken = useMemo(
    () =>
      destinationTokens.find(
        (t) =>
          t.erc20TokenAddress.toLowerCase() ===
          destinationTokenAddress.toLowerCase(),
      ),
    [destinationTokens, destinationTokenAddress],
  );

  useEffect(() => {
    setSelectedToken(undefined);
  }, [chainId]);

  useEffect(() => {
    const usdc = destinationTokens.find((t) => t.symbol === "USDC");
    setDestinationTokenAddress(
      (usdc ?? destinationTokens[0])?.erc20TokenAddress ?? "",
    );
  }, [destinationTokens]);

  // Any input change invalidates the quote: the server checks it against the signed request.
  useEffect(() => {
    setQuote(null);
  }, [
    selectedToken,
    destinationChainId,
    destinationTokenAddress,
    recipients,
    slippage,
    txCompletionTimeLabel,
  ]);

  const updateRecipient = useCallback(
    (index: number, field: keyof Recipient, value: string) => {
      setRecipients((prev) =>
        prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const handleAmountChange = useCallback(
    (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      if (/^[0-9]*[.]?[0-9]*$/.test(event.target.value)) {
        updateRecipient(index, "amount", event.target.value);
      }
    },
    [updateRecipient],
  );

  const recipientsWei = useCallback(
    (): Recipient[] =>
      selectedToken
        ? recipients.map((r) => ({
            address: r.address.trim(),
            amount: getAmountInWei(selectedToken, r.amount).toString(),
          }))
        : [],
    [recipients, selectedToken],
  );

  const txCompletionTime = useMemo(() => {
    const delaySeconds = TX_COMPLETION_TIME_OPTIONS.find(
      (o) => o.label === txCompletionTimeLabel,
    )!.delaySeconds;
    return delaySeconds > 0 ? delaySeconds : undefined;
  }, [txCompletionTimeLabel]);

  const handleGetQuote = useCallback(async () => {
    try {
      if (!chainId || !selectedToken || !sessionId || !privateKey) return;
      setIsQuoting(true);
      const auth: Auth = { sessionId, privateKey, chainId };
      const result = await getPrivateSendBridgeQuote(
        auth,
        selectedToken.erc20TokenAddress,
        destinationChainId,
        destinationTokenAddress,
        recipientsWei(),
        slippage ? Number(slippage) : undefined,
        txCompletionTime !== undefined
          ? resolveTxCompletionTime(txCompletionTime)
          : undefined,
      );
      setQuote(result);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Bridge quote failed"));
    } finally {
      setIsQuoting(false);
    }
  }, [
    chainId,
    selectedToken,
    sessionId,
    privateKey,
    destinationChainId,
    destinationTokenAddress,
    recipientsWei,
    slippage,
    txCompletionTime,
  ]);

  const handleBridge = useCallback(async () => {
    try {
      if (
        !chainId ||
        !selectedToken ||
        !walletAddress ||
        !sessionId ||
        !privateKey ||
        !quote
      )
        return;
      setIsProcessing(true);
      setScheduledStatuses([]);
      setOrderId(null);

      const wallet = {
        signer: isTron || isSolana ? null : await getEthersSigner(chainId),
        solanaProvider: isSolana ? solanaProvider : undefined,
      };
      const session = { sessionId, authMode, privateKey };

      const order = await privateSendBridge(
        wallet,
        session,
        chainId,
        selectedToken.erc20TokenAddress,
        destinationChainId,
        destinationTokenAddress,
        recipientsWei(),
        quote.quote,
      );
      setOrderId(order.orderId);

      const isNative =
        selectedToken.erc20TokenAddress.toLowerCase() === zeroAddress;

      if (isSolana) {
        if (!solanaProvider) throw new Error("Solana provider not set");
        await broadcastSolanaTransaction(solanaProvider, order.serializedTx);
      } else if (isTron) {
        await approveAndBroadcastTronSerializedTx(
          order.serializedTx,
          isNative ? null : order.approvalAddress,
          BigInt(order.amountIn),
          selectedToken.erc20TokenAddress,
          walletAddress,
        );
      } else {
        const signer = requireEvmSigner(wallet.signer);
        if (!isNative && order.approvalAddress) {
          await approveErc20(
            signer,
            selectedToken.erc20TokenAddress,
            order.approvalAddress,
            BigInt(order.amountIn),
          );
        }
        await broadcastDepositTx(signer, order.serializedTx);
      }

      const auth: Auth = { sessionId, privateKey, chainId };
      await waitForScheduledTxsComplete(
        auth,
        order.orderId,
        setScheduledStatuses,
      );

      toast.success("Bridge completed");
      await refreshBalances();
      setQuote(null);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Bridge failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    selectedToken,
    walletAddress,
    sessionId,
    privateKey,
    quote,
    isTron,
    isSolana,
    solanaProvider,
    authMode,
    destinationChainId,
    destinationTokenAddress,
    recipientsWei,
    refreshBalances,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const destinationIsSolana = isSolanaChain(destinationChainId);
  const destinationIsTron = isTronChain(destinationChainId);

  const hasInvalidRecipient = useMemo(
    () =>
      recipients.some(
        (r) =>
          r.address &&
          !isValidRecipientAddress(
            r.address,
            destinationIsSolana,
            destinationIsTron,
          ),
      ),
    [recipients, destinationIsSolana, destinationIsTron],
  );

  const inputsIncomplete =
    !walletAddress ||
    !selectedToken ||
    !destinationTokenAddress ||
    hasInvalidRecipient ||
    recipients.some((r) => !r.address || !r.amount || Number(r.amount) <= 0);

  const isBusy = isQuoting || isProcessing;
  const quoteDisabled = inputsIncomplete || isBusy;
  const bridgeDisabled = inputsIncomplete || isBusy || !quote;

  const buttonClass = (disabled: boolean) =>
    `w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
      !disabled
        ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
        : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
    }`;

  return (
    <div className="text-white">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col w-[96%] mx-auto mb-4">
          <span className="text-white text-[14px] font-[300] mb-1">
            From ({chainId ? getChainName(chainId) : "-"})
          </span>
          <SelectToken
            swapToken={selectedToken}
            onTokenChange={(_prev, cur) => setSelectedToken(cur)}
            disabled={isBusy}
          />
        </div>

        <div className="flex flex-col w-[96%] mx-auto mb-4">
          <span className="text-white text-[14px] font-[300] mb-1">To</span>
          <div className="flex gap-2">
            <select
              className={selectClassName}
              value={destinationChainId}
              disabled={isBusy}
              onChange={(e) => setDestinationChainId(Number(e.target.value))}
            >
              {DESTINATION_CHAIN_IDS.map((id) => (
                <option key={id} value={id}>
                  {getChainName(id)}
                </option>
              ))}
            </select>
            <select
              className={selectClassName}
              value={destinationTokenAddress}
              disabled={isBusy}
              onChange={(e) => setDestinationTokenAddress(e.target.value)}
            >
              {destinationTokens.map((t) => (
                <option key={t.erc20TokenAddress} value={t.erc20TokenAddress}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {recipients.map((recipient, index) => (
          <RecipientInputRow
            key={index}
            addressValue={recipient.address}
            amountValue={recipient.amount}
            addressPlaceholder={`Recipient on ${getChainName(destinationChainId)}`}
            onAddressChange={(e) =>
              updateRecipient(index, "address", e.target.value)
            }
            onAmountChange={(e) => handleAmountChange(index, e)}
            disabled={isBusy}
            onRemove={
              recipients.length > 1
                ? () =>
                    setRecipients((prev) => prev.filter((_, i) => i !== index))
                : undefined
            }
          />
        ))}

        <div className="w-[96%] mx-auto mb-4">
          <button
            type="button"
            onClick={() => setRecipients((prev) => [...prev, emptyRecipient()])}
            disabled={isBusy}
            className="text-sm text-hinkal-gray-100 hover:text-white disabled:opacity-40 transition-colors duration-300"
          >
            + Add recipient
          </button>
          {hasInvalidRecipient && walletAddress && (
            <p className="text-hinkal-red-100 text-[13px] mt-2">
              {getRecipientAddressError(
                destinationIsTron,
                destinationIsSolana,
                false,
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 w-[96%] mx-auto mb-4">
          <span className="text-white text-[14px] font-[300]">
            Slippage % (optional)
          </span>
          <input
            type="text"
            placeholder="auto"
            className="bg-hinkal-blue-900 h-10 rounded-lg px-3 text-[14px] outline-none text-white w-24"
            value={slippage}
            disabled={isBusy}
            onChange={(e) => {
              if (/^[0-9]*[.]?[0-9]*$/.test(e.target.value))
                setSlippage(e.target.value);
            }}
          />
        </div>

        <ButtonGroupWithLabel
          label="Completion time"
          options={TX_COMPLETION_TIME_LABELS}
          selected={txCompletionTimeLabel}
          onSelect={(option) =>
            setTxCompletionTimeLabel(option as TxCompletionTimeLabel)
          }
          disabled={isBusy}
          showInfo={false}
        />

        {quote && (
          <div className="w-[90%] mx-[5%] mb-3 p-3 rounded-lg bg-hinkal-blue-900 text-sm">
            <p className="font-semibold mb-1">Quote (valid ~5 min)</p>
            {quote.expectedAmounts.map((amount, i) => (
              <p key={i} className="text-hinkal-gray-200">
                Recipient {i + 1} receives ~
                {destinationToken
                  ? `${ethers.formatUnits(amount, destinationToken.decimals)} ${
                      destinationToken.symbol
                    }`
                  : amount}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={quoteDisabled}
          onClick={handleGetQuote}
          className={buttonClass(quoteDisabled)}
        >
          {isQuoting ? (
            <div className="flex items-center justify-center gap-x-2">
              <span>Fetching quote</span> <Spinner />
            </div>
          ) : (
            <span>{quote ? "Refresh quote" : "Get quote"}</span>
          )}
        </button>

        <button
          type="submit"
          disabled={bridgeDisabled}
          onClick={handleBridge}
          className={buttonClass(bridgeDisabled)}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-x-2">
              <span>Bridging</span> <Spinner />
            </div>
          ) : (
            <span>Bridge</span>
          )}
        </button>
      </form>

      {(orderId || scheduledStatuses.length > 0) && (
        <div className="w-[90%] mx-[5%] mt-2 p-3 rounded-lg bg-hinkal-blue-900 text-sm break-all">
          {orderId && <p className="mb-2">Order: {orderId}</p>}
          {scheduledStatuses.map((tx, i) => (
            <p key={i} className="text-hinkal-gray-200">
              Leg {i + 1}: {formatScheduledTxStatus(tx.status)}
              {tx.txHash ? ` (${tx.txHash})` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
