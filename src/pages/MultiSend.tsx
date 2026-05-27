import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { getERC20Token, getERC20TokenBySymbol } from "../utils/tokens.utils";
import { RecipientInputRow } from "../utils/recipientInfoRow";
import {
  depositAndWithdraw,
  OrderStatus,
  TERMINAL_ORDER_STATUSES,
  TX_COMPLETION_TIME_OPTIONS,
  TxCompletionTimeLabel,
  getOrderStatus,
  Recipient,
  resolveTxCompletionTime,
} from "../utils/multiSend";
import { approveErc20, broadcastDepositTx, getEthersSigner } from "../utils/ethers-wallet";
import { approveAndBroadcastTronSerializedTx } from "../utils/tron-wallet";
import { broadcastSolanaTransaction } from "../utils/solana-wallet";
import { buildSolanaPrivateSendAuthFields } from "../utils/solana-auth";
import { buildTronPrivateSendAuthFields } from "../utils/tron-auth";
import { ButtonGroupWithLabel } from "../utils/buttonGroupWithLabel";

const NON_NATIVE_GAS_TOKENS = ["USDC", "USDT", "DAI"];
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const waitForOrderTerminal = async (
  orderId: string,
): Promise<OrderStatus> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await getOrderStatus(orderId);
    if (TERMINAL_ORDER_STATUSES.has(data.status)) {
      if (data.status === OrderStatus.Failed) {
        throw new Error("Order failed");
      }
      return data.status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Order status poll timed out");
};

const emptyRecipient = (): Recipient => ({ address: "", amount: "" });

const TX_COMPLETION_TIME_LABELS = TX_COMPLETION_TIME_OPTIONS.map(
  (o) => o.label,
);

const DEFAULT_TX_COMPLETION_TIME_LABEL: TxCompletionTimeLabel = "30 min";

export const MultiSend = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce, hasWriteAccess, isTron, isSolana, solanaProvider } =
    useAppContext();

  const allowedTokens = useMemo<ERC20Token[]>(() => {
    if (!chainId) return [];
    const nativeToken = getERC20Token(zeroAddress, chainId);
    const stablecoins = NON_NATIVE_GAS_TOKENS.map((symbol) =>
      getERC20TokenBySymbol(symbol, chainId),
    ).filter((token): token is ERC20Token => token !== undefined);
    return nativeToken ? [nativeToken, ...stablecoins] : stablecoins;
  }, [chainId]);

  const [selectedToken, setSelectedToken] = useState<ERC20Token | undefined>(
    undefined,
  );
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient()]);
  const [txCompletionTimeLabel, setTxCompletionTimeLabel] =
    useState<TxCompletionTimeLabel>(DEFAULT_TX_COMPLETION_TIME_LABEL);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!chainId) {
      setSelectedToken(undefined);
      return;
    }
    if (selectedToken) {
      const stillValid = allowedTokens.some(
        (t) =>
          t.erc20TokenAddress.toLowerCase() ===
          selectedToken.erc20TokenAddress.toLowerCase(),
      );
      if (!stillValid) setSelectedToken(allowedTokens[0]);
    } else if (allowedTokens.length > 0) {
      setSelectedToken(allowedTokens[0]);
    }
  }, [chainId, allowedTokens, selectedToken]);

  const updateRecipient = (
    index: number,
    field: keyof Recipient,
    value: string,
  ) => {
    setRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const addRecipient = () =>
    setRecipients((prev) => [...prev, emptyRecipient()]);

  const removeRecipient = (index: number) =>
    setRecipients((prev) => prev.filter((_, i) => i !== index));

  const handleAmountChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (/^[0-9]*[.]?[0-9]*$/.test(event.target.value)) {
      updateRecipient(index, "amount", event.target.value);
    }
  };

  const handleMultiSend = useCallback(async () => {
    try {
      if (
        !chainId ||
        !selectedToken ||
        !walletAddress ||
        !signature ||
        !nonce
      )
        return;
      setIsProcessing(true);

      const signer = isTron || isSolana ? null : await getEthersSigner();

      const recipientsWei: Recipient[] = recipients.map((r) => ({
        address: r.address,
        amount: getAmountInWei(selectedToken, r.amount).toString(),
      }));

      const delaySeconds = TX_COMPLETION_TIME_OPTIONS.find(
        (o) => o.label === txCompletionTimeLabel,
      )!.delaySeconds;
      const txCompletionTime = delaySeconds > 0 ? resolveTxCompletionTime(delaySeconds) : undefined;

      const buildReadOnlyAuth = isSolana && solanaProvider
        ? () => buildSolanaPrivateSendAuthFields(solanaProvider, chainId, selectedToken.erc20TokenAddress, recipientsWei)
        : isTron
        ? () => buildTronPrivateSendAuthFields(chainId, selectedToken.erc20TokenAddress, recipientsWei)
        : undefined;

      console.time("[MultiSend] POST /private-send");
      const order = await depositAndWithdraw(
        signer,
        { signature, nonce, hasWriteAccess },
        walletAddress,
        chainId,
        selectedToken.erc20TokenAddress,
        recipientsWei,
        txCompletionTime,
        buildReadOnlyAuth,
      );
      console.timeEnd("[MultiSend] POST /private-send");
      console.log("[MultiSend] order:", { orderId: order.orderId, amountIn: order.amountIn, fee: order.fee });

      const isNative =
        selectedToken.erc20TokenAddress.toLowerCase() === zeroAddress;

      if (isSolana) {
        if (!solanaProvider) throw new Error("Solana provider not set");
        console.time("[MultiSend] broadcast (Solana)");
        await broadcastSolanaTransaction(solanaProvider, order.serializedTx);
        console.timeEnd("[MultiSend] broadcast (Solana)");
      } else if (isTron) {
        console.time("[MultiSend] broadcast (Tron)");
        await approveAndBroadcastTronSerializedTx(
          order.serializedTx,
          isNative ? null : order.approvalAddress,
          BigInt(order.amountIn),
          selectedToken.erc20TokenAddress,
          walletAddress,
        );
        console.timeEnd("[MultiSend] broadcast (Tron)");
      } else {
        if (!isNative && order.approvalAddress) {
          console.time("[MultiSend] ERC20 approve");
          await approveErc20(
            signer!,
            selectedToken.erc20TokenAddress,
            order.approvalAddress,
            BigInt(order.amountIn),
          );
          console.timeEnd("[MultiSend] ERC20 approve");
        }
        console.time("[MultiSend] broadcast deposit tx");
        await broadcastDepositTx(signer!, order.serializedTx);
        console.timeEnd("[MultiSend] broadcast deposit tx");
      }

      console.time("[MultiSend] poll until scheduled");
      await waitForOrderTerminal(order.orderId);
      console.timeEnd("[MultiSend] poll until scheduled");

      toast.success("Multi send scheduled");
      setRecipients([emptyRecipient()]);
      await refreshBalances();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Multi send failed";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    chainId,
    selectedToken,
    walletAddress,
    recipients,
    refreshBalances,
    signature,
    nonce,
    hasWriteAccess,
    txCompletionTimeLabel,
    isSolana,
    solanaProvider,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = useMemo(
    () =>
      !walletAddress ||
      !selectedToken ||
      isProcessing ||
      recipients.some((r) => !r.address || !r.amount),
    [walletAddress, selectedToken, isProcessing, recipients],
  );

  return (
    <div className="text-white">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 w-[96%] mx-auto mb-4">
          <SelectToken
            swapToken={selectedToken}
            onTokenChange={(_prev, cur) => setSelectedToken(cur)}
            disabled={isProcessing}
            tokenFilter={(token) =>
              allowedTokens.some(
                (allowed) =>
                  allowed.erc20TokenAddress.toLowerCase() ===
                  token.erc20TokenAddress.toLowerCase(),
              )
            }
          />
        </div>

        {recipients.map((recipient, index) => (
          <RecipientInputRow
            key={index}
            addressValue={recipient.address}
            amountValue={recipient.amount}
            onAddressChange={(e) =>
              updateRecipient(index, "address", e.target.value)
            }
            onAmountChange={(e) => handleAmountChange(index, e)}
            disabled={isProcessing}
            onRemove={
              recipients.length > 1 ? () => removeRecipient(index) : undefined
            }
          />
        ))}

        <div className="w-[96%] mx-auto mb-4">
          <button
            type="button"
            onClick={addRecipient}
            disabled={isProcessing}
            className="text-sm text-[#9ca3af] hover:text-white disabled:opacity-40 duration-200"
          >
            + Add recipient
          </button>
        </div>

        <ButtonGroupWithLabel
          label="Completion time"
          options={TX_COMPLETION_TIME_LABELS}
          selected={txCompletionTimeLabel}
          onSelect={(option) =>
            setTxCompletionTimeLabel(option as TxCompletionTimeLabel)
          }
          disabled={isProcessing}
          showInfo={false}
        />

        <div className="border-solid">
          <button
            type="submit"
            disabled={isDisabled}
            onClick={handleMultiSend}
            className={`w-[90%] mb-3 mx-[5%] rounded-lg h-10 text-sm font-semibold outline-none ${
              !isDisabled
                ? "bg-primary text-white hover:bg-[#4d32fa] duration-200"
                : "bg-[#37363d] text-[#848688] cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-x-2">
                <span>Sending</span> <Spinner />
              </div>
            ) : (
              <span>Send</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
