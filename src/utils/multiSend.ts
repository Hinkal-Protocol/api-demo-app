import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import { buildDepositAndWithdrawAuthFields } from "./enclave-auth";

export enum OrderStatus {
  AwaitingDeposit = "AwaitingDeposit",
  DepositConfirmed = "DepositConfirmed",
  WithdrawScheduled = "WithdrawScheduled",
  Failed = "Failed",
  Expired = "Expired",
}

export type DepositAndWithdrawOrder = {
  orderId: string;
  serializedTx: string;
  amountIn: string;
  amountOut: string;
  fee: string;
};

export const depositAndWithdraw = async (
  signer: ethers.Signer,
  account: string,
  chainId: number,
  tokenAddress: string,
  amount: string,
  recipientAddress: string,
  feeToken?: string,
): Promise<DepositAndWithdrawOrder> => {
  const authFields = await buildDepositAndWithdrawAuthFields(signer, {
    chainId,
    tokenAddress,
    recipientAddress,
    amount,
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddress,
    amount,
    recipientAddress,
    feeToken,
  };

  const res = await fetch(`${API_BASE_URL}/deposit-and-withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | ({ success: true } & DepositAndWithdrawOrder)
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "depositAndWithdraw failed",
    );
  }

  return {
    orderId: data.orderId,
    serializedTx: data.serializedTx,
    amountIn: data.amountIn,
    amountOut: data.amountOut,
    fee: data.fee,
  };
};

export type OrderStatusResponse = {
  success: boolean;
  status: OrderStatus;
  txHash: string | null;
  scheduleId: string | null;
  failureReason: string | null;
};

export const getOrderStatus = async (
  orderId: string,
): Promise<OrderStatusResponse> => {
  const res = await fetch(`${API_BASE_URL}/deposit-and-withdraw/${orderId}`);
  const data = (await res.json()) as OrderStatusResponse & { error?: string };

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Order status fetch failed");
  }

  return data;
};
