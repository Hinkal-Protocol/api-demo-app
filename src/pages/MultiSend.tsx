import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import { Spinner } from "../components/Spinner";
import { SelectToken } from "../components/swap/SelectToken";
import { useAppContext } from "../AppContext";
import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import { getAmountInWei } from "../utils/amount.utils";
import { getERC20Token, getERC20TokenBySymbol } from "../utils/tokens.utils";
import {
  SCHEDULE_OPTIONS,
  ScheduleOption,
} from "../constants/schedule.constants";
import { ButtonGroupWithLabel } from "../utils/buttonGroupWithLabel";
import { RecipientInputRow } from "../utils/recipientInfoRow";
import {
  depositAndWithdraw,
  OrderStatus,
  getOrderStatus,
} from "../utils/multiSend";
import { approveErc20, getEthersSigner, sendTx } from "../utils/ethers-wallet";

const NON_NATIVE_GAS_TOKENS = ["USDC", "USDT", "DAI"];
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const waitForOrderTerminal = async (
  orderId: string,
): Promise<OrderStatus> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await getOrderStatus(orderId);
    if (
      data.status === OrderStatus.WithdrawScheduled ||
      data.status === OrderStatus.Failed ||
      data.status === OrderStatus.Expired
    ) {
      if (data.status === OrderStatus.Failed) {
        throw new Error(data.failureReason ?? "Order failed");
      }
      return data.status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Order status poll timed out");
};

export const MultiSend = () => {
  const { walletAddress, refreshBalances, chainId, signature, nonce, hasWriteAccess } =
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
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [recipientAmount, setRecipientAmount] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleOption>("instantly");
  const [intervalBetweenTxs, setIntervalBetweenTxs] =
    useState<ScheduleOption>("instantly");
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

  const setAmountHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
    setValue: (value: string) => void,
  ) => {
    if (/^[0-9]*[.]?[0-9]*$/.test(event.target.value)) {
      setValue(event.target.value);
    }
  };

  const handleMultiSend = useCallback(async () => {
    try {
      if (
        !chainId ||
        !selectedToken ||
        !walletAddress ||
        !signature ||
        !nonce ||
        !recipientAddress ||
        !recipientAmount
      )
        return;
      setIsProcessing(true);

      const signer = await getEthersSigner();
      const amountWei = getAmountInWei(selectedToken, recipientAmount);

      const order = await depositAndWithdraw(
        signer,
        { signature, nonce, hasWriteAccess },
        walletAddress,
        chainId,
        selectedToken.erc20TokenAddress,
        amountWei.toString(),
        recipientAddress,
      );

      const rlpHex = `0x${Buffer.from(order.serializedTx, "base64").toString(
        "hex",
      )}`;
      const parsedTx = ethers.Transaction.from(rlpHex);
      if (!parsedTx.to) throw new Error("Order tx missing recipient");

      const amountIn = BigInt(order.amountIn);
      const isNative =
        selectedToken.erc20TokenAddress.toLowerCase() === zeroAddress;

      if (!isNative) {
        await approveErc20(
          signer,
          selectedToken.erc20TokenAddress,
          parsedTx.to,
          amountIn,
        );
      }

      await sendTx(signer, {
        to: parsedTx.to,
        data: parsedTx.data ?? "0x",
        value:
          parsedTx.value !== undefined && parsedTx.value !== null
            ? BigInt(parsedTx.value)
            : undefined,
      });

      await waitForOrderTerminal(order.orderId);

      toast.success("Multi send scheduled");
      setRecipientAddress("");
      setRecipientAmount("");
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
    signature,
    nonce,
    hasWriteAccess,
    recipientAddress,
    recipientAmount,
    refreshBalances,
  ]);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const isDisabled = useMemo(
    () =>
      !walletAddress ||
      !selectedToken ||
      !recipientAddress ||
      !recipientAmount ||
      isProcessing,
    [
      walletAddress,
      selectedToken,
      recipientAddress,
      recipientAmount,
      isProcessing,
    ],
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

        <RecipientInputRow
          addressValue={recipientAddress}
          amountValue={recipientAmount}
          onAddressChange={(e) => setRecipientAddress(e.target.value)}
          onAmountChange={(event) => setAmountHandler(event, setRecipientAmount)}
          disabled={isProcessing}
        />

        <ButtonGroupWithLabel
          label="Schedule Transfer"
          options={SCHEDULE_OPTIONS}
          selected={schedule}
          onSelect={(option) => setSchedule(option as ScheduleOption)}
          disabled={isProcessing}
        />

        <ButtonGroupWithLabel
          label="Interval Between Transactions"
          options={SCHEDULE_OPTIONS}
          selected={intervalBetweenTxs}
          onSelect={(option) => setIntervalBetweenTxs(option as ScheduleOption)}
          disabled={isProcessing}
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
