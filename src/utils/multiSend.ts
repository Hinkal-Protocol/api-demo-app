import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { resolvePrivateSendAuth } from "./resolve-tx-auth";
import type { TxSessionAuth, TxWallet } from "./types";

export enum OrderStatus {
  Processing = "processing",
  Failed = "failed",
  Scheduled = "scheduled",
}

export const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.Failed,
  OrderStatus.Scheduled,
]);

const SCHEDULED_TX_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  waiting_for_relayer: "Processing",
  sent_on_chain: "Confirming",
  completed: "Completed",
  failed: "Failed",
};

export const formatScheduledTxStatus = (status: string): string =>
  SCHEDULED_TX_STATUS_LABELS[status] ?? status;

export const isScheduledTxTerminal = (status: string): boolean =>
  status === "completed" || status === "failed";

export type ScheduledTransactionItem = {
  status: string;
  scheduledTime: string;
  txHash: string | null;
};

export type Recipient = { address: string; amount: string };

export const TX_COMPLETION_TIME_OPTIONS = [
  { label: "Instant", delaySeconds: 0 },
  { label: "15 min", delaySeconds: 15 * 60 },
  { label: "30 min", delaySeconds: 30 * 60 },
  { label: "60 min", delaySeconds: 60 * 60 },
] as const;

export type TxCompletionTimeLabel =
  (typeof TX_COMPLETION_TIME_OPTIONS)[number]["label"];

export const getCurrentTimeInSeconds = () => Math.floor(Date.now() / 1000);

export const resolveTxCompletionTime = (delaySeconds: number): number =>
  getCurrentTimeInSeconds() + delaySeconds;

export type DepositAndWithdrawOrder = {
  orderId: string;
  serializedTx: string;
  amountIn: string;
  amountOut: string;
  fee: string;
  approvalAddress: string | null;
};

export const depositAndWithdraw = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  txCompletionTime?: number,
): Promise<DepositAndWithdrawOrder> => {
  const txParams = {
    tokenAddress,
    recipients,
    ...(txCompletionTime !== undefined && { txCompletionTime }),
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txParams,
    () =>
      resolvePrivateSendAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddress,
        recipients,
      ),
  );

  const { res, data } = await enclaveFetch<
    | ({ success: true } & DepositAndWithdrawOrder)
    | { error?: string }
  >("/private-send", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "privateSend failed");
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

export type OrderStatusResponse = {
  success: boolean;
  status: OrderStatus;
  scheduledTransactions?: ScheduledTransactionItem[];
};

export const getOrderStatus = async (
  orderId: string,
): Promise<OrderStatusResponse> => {
  const { res, data } = await enclaveFetch<
    OrderStatusResponse & { error?: string }
  >(`/private-send/${orderId}`);

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Order status fetch failed");
  }

  return data;
};
