import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { TokenAmountInput } from "../components/TokenAmountInput";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInToken, getAmountInWei } from "../utils/amount.utils";
import { getFriendlyErrorMessage } from "../utils/errors";
import { getERC20Registry } from "../constants/token-data";
import { networkRegistry } from "../constants/chain.constants";
import { BRIDGE_DESTINATION_CHAIN_IDS } from "../constants/bridge.constants";
import {
  formatScheduledTxStatus,
  Recipient,
  ScheduledTransactionItem,
} from "../utils/multiSend";
import {
  getPrivateSendBridgeQuote,
  privateSendBridge,
  PrivateSendBridgeQuote,
  waitForScheduledTxsComplete,
} from "../utils/privateSendBridge";
import { createReceiveAddress } from "../utils/receiveVault";
import type { Auth } from "../utils/types";
import {
  approveErc20,
  broadcastDepositTx,
  getEthersSigner,
  requireEvmSigner,
} from "../utils/ethers-wallet";
import { approveAndBroadcastTronSerializedTx } from "../utils/tron-wallet";
import { broadcastSolanaTransaction } from "../utils/solana-wallet";

// The server checks the order against the quoted recipients, so keep them together.
type QuotedBridge = PrivateSendBridgeQuote & { recipients: Recipient[] };

type BridgeOutcome = {
  orderId: string;
  recipientAddress: string;
  expectedAmount: string;
  destinationToken: ERC20Token;
};

const getChainName = (chainId: number): string =>
  networkRegistry[chainId]?.name ?? String(chainId);

const selectClassName =
  "bg-hinkal-blue-900 h-10 rounded-lg px-3 text-[14px] outline-none text-white flex-1";

export const PrivateBridge = () => {
  const {
    walletAddress,
    refreshBalancesSoon,
    chainId,
    sessionId,
    privateKey,
    authMode,
    isTron,
    isSolana,
    solanaProvider,
  } = useAppContext();

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined
  );
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [destinationChainId, setDestinationChainId] = useState<number>(
    BRIDGE_DESTINATION_CHAIN_IDS[0]
  );
  const [destinationTokenAddress, setDestinationTokenAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("");
  const [quote, setQuote] = useState<QuotedBridge | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outcome, setOutcome] = useState<BridgeOutcome | undefined>(undefined);
  const [scheduledStatuses, setScheduledStatuses] = useState<
    ScheduledTransactionItem[]
  >([]);

  const destinationTokens = useMemo(
    () => getERC20Registry(destinationChainId) ?? [],
    [destinationChainId]
  );
  const destinationToken = useMemo(
    () =>
      destinationTokens.find(
        (t) =>
          t.erc20TokenAddress.toLowerCase() ===
          destinationTokenAddress.toLowerCase()
      ),
    [destinationTokens, destinationTokenAddress]
  );

  const amountWei = useMemo(() => {
    if (!selectedToken || !bridgeAmount) return 0n;
    try {
      return getAmountInWei(selectedToken, bridgeAmount);
    } catch {
      return 0n;
    }
  }, [selectedToken, bridgeAmount]);

  useEffect(() => {
    if (!chainId) return;
    setSelectedToken(undefined);
    setBridgeAmount("");
    setOutcome(undefined);
  }, [chainId]);

  // Default to the same token on the destination chain (USDC -> USDC), else USDC.
  useEffect(() => {
    const preferred =
      destinationTokens.find((t) => t.symbol === selectedToken?.symbol) ??
      destinationTokens.find((t) => t.symbol === "USDC") ??
      destinationTokens[0];
    setDestinationTokenAddress(preferred?.erc20TokenAddress ?? "");
  }, [destinationTokens, selectedToken?.symbol]);

  // Any input change invalidates the quote.
  useEffect(() => {
    setQuote(null);
  }, [
    chainId,
    selectedToken,
    amountWei,
    destinationTokenAddress,
    recipientAddress,
    slippage,
  ]);

  const handleGetQuote = useCallback(async () => {
    try {
      if (
        !chainId ||
        !selectedToken ||
        !destinationToken ||
        !sessionId ||
        !privateKey
      )
        return;
      setIsQuoting(true);

      const auth: Auth = { sessionId, privateKey, chainId };
      // Empty recipient = bridge into your own deposit address on the destination chain.
      const recipient =
        recipientAddress.trim() ||
        (
          await createReceiveAddress(
            { sessionId, privateKey },
            destinationToken.chainId
          )
        ).vaultAddress;
      const recipients = [{ address: recipient, amount: amountWei.toString() }];

      const result = await getPrivateSendBridgeQuote(
        auth,
        selectedToken.erc20TokenAddress,
        destinationToken.chainId,
        destinationToken.erc20TokenAddress,
        recipients,
        slippage ? Number(slippage) : undefined
      );
      setQuote({ ...result, recipients });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Bridge quote failed"));
    } finally {
      setIsQuoting(false);
    }
  }, [
    chainId,
    selectedToken,
    destinationToken,
    sessionId,
    privateKey,
    amountWei,
    recipientAddress,
    slippage,
  ]);

  const handleBridge = useCallback(async () => {
    try {
      if (
        !chainId ||
        !selectedToken ||
        !destinationToken ||
        !walletAddress ||
        !sessionId ||
        !privateKey ||
        !quote
      )
        return;
      setIsProcessing(true);
      setOutcome(undefined);
      setScheduledStatuses([]);

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
        destinationToken.chainId,
        destinationToken.erc20TokenAddress,
        quote.recipients,
        quote.quote
      );
      setOutcome({
        orderId: order.orderId,
        recipientAddress: quote.recipients[0].address,
        expectedAmount: quote.expectedAmounts[0],
        destinationToken,
      });

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
          walletAddress
        );
      } else {
        const signer = requireEvmSigner(wallet.signer);
        if (!isNative && order.approvalAddress) {
          await approveErc20(
            signer,
            selectedToken.erc20TokenAddress,
            order.approvalAddress,
            BigInt(order.amountIn)
          );
        }
        await broadcastDepositTx(signer, order.serializedTx);
      }

      await waitForScheduledTxsComplete(
        { sessionId, privateKey, chainId },
        order.orderId,
        setScheduledStatuses
      );

      toast.success("Bridge completed");
      setBridgeAmount("");
      setQuote(null);
      refreshBalancesSoon();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Bridge failed"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    selectedToken,
    destinationToken,
    walletAddress,
    sessionId,
    privateKey,
    authMode,
    isTron,
    isSolana,
    solanaProvider,
    quote,
    refreshBalancesSoon,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isBusy = isQuoting || isProcessing;
  const inputsIncomplete =
    !walletAddress || !selectedToken || !destinationToken || amountWei <= 0n;
  const quoteDisabled = inputsIncomplete || isBusy;
  const bridgeDisabled = inputsIncomplete || isBusy || !quote;

  const buttonClass = (disabled: boolean) =>
    `w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
      !disabled
        ? "bg-primary text-white hover:bg-hinkal-purple-200 transition-all duration-300"
        : "bg-hinkal-blue-900 text-hinkal-gray-200 cursor-not-allowed"
    }`;

  return (
    <form className="rounded-lg text-white" onSubmit={handleSubmit}>
      <TokenAmountInput
        tokenAmount={bridgeAmount}
        setTokenAmount={setBridgeAmount}
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
      />
      <div className="mt-[-3%] mb-4">
        <label className="text-white pl-[5%] text-[14px] font-[300]">To</label>
        <div className="flex gap-2 w-[90%] mx-auto mt-1">
          <select
            className={selectClassName}
            value={destinationChainId}
            disabled={isBusy}
            onChange={(e) => setDestinationChainId(Number(e.target.value))}
          >
            {BRIDGE_DESTINATION_CHAIN_IDS.map((id) => (
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
      <div className="mb-4">
        <label
          htmlFor="bridgeRecipientAddress"
          className="text-white pl-[5%] text-[14px] font-[300]"
        >
          Recipient deposit address (optional)
        </label>
        <input
          id="bridgeRecipientAddress"
          type="text"
          placeholder={`Deposit address on ${getChainName(
            destinationChainId
          )}, empty = your own`}
          className="bg-hinkal-blue-900 h-10 w-[90%] rounded-lg ml-[5%] text-[16px] pl-2 outline-none placeholder:text-[13.5px] mt-1 text-white"
          disabled={isBusy}
          onChange={(e) => setRecipientAddress(e.target.value)}
          value={recipientAddress}
        />
      </div>
      <div className="flex items-center justify-between w-[90%] mx-auto">
        <label
          htmlFor="bridgeSlippage"
          className="text-white text-[14px] font-[300]"
        >
          Slippage % (optional)
        </label>
        <input
          id="bridgeSlippage"
          type="text"
          placeholder="auto"
          className="bg-hinkal-blue-900 h-10 rounded-lg px-3 text-[14px] outline-none text-white w-24"
          disabled={isBusy}
          onChange={(e) => {
            if (/^[0-9]*[.]?[0-9]*$/.test(e.target.value))
              setSlippage(e.target.value);
          }}
          value={slippage}
        />
      </div>

      {outcome && (
        <div className="w-[90%] mx-auto mt-4 p-3 rounded-lg bg-hinkal-blue-900 text-sm break-all">
          <p className="mb-1">Order: {outcome.orderId}</p>
          <p className="text-hinkal-gray-200">
            Recipient {outcome.recipientAddress} receives ~
            {getAmountInToken(
              outcome.destinationToken,
              BigInt(outcome.expectedAmount)
            )}{" "}
            {outcome.destinationToken.symbol} on{" "}
            {getChainName(outcome.destinationToken.chainId)}
          </p>
          {scheduledStatuses.map((tx, i) => (
            <p key={i} className="text-hinkal-gray-200">
              Leg {i + 1}: {formatScheduledTxStatus(tx.status)}
              {tx.txHash ? ` (${tx.txHash})` : ""}
            </p>
          ))}
        </div>
      )}

      <div className="w-[90%] mx-auto mb-6 mt-6 h-[1px] bg-hinkal-blue-900" />
      {quote && destinationToken && (
        <div className="w-[90%] mx-[5%] mb-3 p-3 rounded-lg bg-hinkal-blue-900 text-sm break-all">
          <p className="font-semibold mb-1">Quote (valid ~5 min)</p>
          <p className="text-hinkal-gray-200">
            {quote.recipients[0].address} receives ~
            {getAmountInToken(
              destinationToken,
              BigInt(quote.expectedAmounts[0])
            )}{" "}
            {destinationToken.symbol}
          </p>
        </div>
      )}
      <div className=" border-solid ">
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
              <span>Bridging</span> <Spinner />{" "}
            </div>
          ) : (
            <span>Bridge</span>
          )}
        </button>
      </div>
    </form>
  );
};
