import { buildAuthGet, buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { resolvePrivateSendBridgeAuth } from "./resolve-tx-auth";
import {
  isScheduledTxTerminal,
  OrderStatus,
  type DepositAndWithdrawOrder,
  type OrderStatusResponse,
  type Recipient,
  type ScheduledTransactionItem,
} from "./multiSend";
import type { Auth, TxSessionAuth, TxWallet } from "./types";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60_000;

export type PrivateSendBridgeQuote = {
  quote: string;
  expectedAmounts: string[];
};

export const getPrivateSendBridgeQuote = async (
  auth: Auth,
  inputTokenAddress: string,
  destinationChainId: number,
  outputTokenAddress: string,
  recipients: Recipient[],
  slippagePercentage?: number,
  txCompletionTime?: number
): Promise<PrivateSendBridgeQuote> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(
    auth,
    "/get-private-send-bridge-quote",
    {
      destinationChainId: String(destinationChainId),
      inputTokenAddress,
      outputTokenAddress,
      recipientAddresses: recipients.map((r) => r.address),
      amounts: recipients.map((r) => r.amount),
      ...(slippagePercentage !== undefined && {
        slippagePercentage: String(slippagePercentage),
      }),
      ...(txCompletionTime !== undefined && {
        txCompletionTime: String(txCompletionTime),
      }),
    }
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & PrivateSendBridgeQuote) | { error?: string }
  >(`/get-private-send-bridge-quote?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Bridge quote fetch failed"
    );
  }

  return { quote: data.quote, expectedAmounts: data.expectedAmounts };
};

export const privateSendBridge = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  destinationChainId: number,
  destinationTokenAddress: string,
  recipients: Recipient[],
  quote: string
): Promise<DepositAndWithdrawOrder> => {
  const txParams = {
    tokenAddress,
    destinationChainId,
    destinationTokenAddress,
    recipients,
    quote,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/private-send-bridge",
    txParams,
    () =>
      resolvePrivateSendBridgeAuth(wallet, session.sessionId, {
        chainId,
        ...txParams,
      })
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & DepositAndWithdrawOrder) | { error?: string }
  >("/private-send-bridge", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "privateSendBridge failed"
    );
  }

  return {
    orderId: data.orderId,
    serializedTx: data.serializedTx,
    amountIn: data.amountIn,
    amountOut: data.amountOut,
    fee: data.fee,
    approvalAddress: data.approvalAddress,
  };
};

export const getBridgeOrderStatus = async (
  auth: Auth,
  orderId: string
): Promise<OrderStatusResponse> => {
  const { queryString, headers, requestNonce } = await buildAuthGet(
    auth,
    "/private-send-bridge/:orderId"
  );

  const { res, data } = await enclaveFetch<
    OrderStatusResponse & { error?: string }
  >(`/private-send-bridge/${orderId}?${queryString}`, requestNonce, {
    headers,
  });

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Order status fetch failed");
  }

  return data;
};

export const waitForScheduledTxsComplete = async (
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
