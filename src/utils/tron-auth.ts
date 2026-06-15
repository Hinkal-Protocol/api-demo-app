import { ethers } from "ethers";
import {
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { getTronWeb, tronBase58ToHex } from "./tron-wallet";
import type { EnclaveTxAuthFields, TxSessionAuth } from "./types";
import type { Recipient } from "./multiSend";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serializeBigInts = (obj: any): any => {
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serializeBigInts(v)]));
  return obj;
};

const signTypedData = async (
  session: TxSessionAuth,
  primaryType: Parameters<typeof getTypesForPrimary>[0],
  chainId: number,
  buildValue: (nonce: string) => Record<string, unknown>,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const domain = getEnclaveTypedDataDomain(chainId);
  const types = getTypesForPrimary(primaryType);
  const value = buildValue(nonce);

  const tw = getTronWeb();
  const serializedDomain = serializeBigInts(domain);
  const serializedMessage = serializeBigInts(value);
  const signature = await tw.trx._signTypedData(serializedDomain, types, serializedMessage);
  return { sessionId: session.sessionId, signature, nonce, timestamp: Date.now() };
};

export const buildTronDepositAuthFields = (
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> =>
  signTypedData(session, "Deposit", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
  }));

export const buildTronTransferAuthFields = (
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(session, "Transfer", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronWithdrawAuthFields = (
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(session, "Withdraw", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronPrivateSendAuthFields = (
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
): Promise<EnclaveTxAuthFields> =>
  signTypedData(session, "PrivateSend", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAddress: ethers.getAddress(tokenAddress),
    recipients: [...recipients]
      .map(({ address, amount }) => ({
        recipient: ethers.getAddress(tronBase58ToHex(address)),
        amount: BigInt(amount),
      }))
      .sort((a, b) => a.recipient.localeCompare(b.recipient)),
  }));

export const buildTronWithdrawStuckUtxosAuthFields = (
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(session, "WithdrawStuckUtxos", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAddress: ethers.getAddress(tokenAddress),
    recipient: ethers.getAddress(recipientAddress),
  }));
