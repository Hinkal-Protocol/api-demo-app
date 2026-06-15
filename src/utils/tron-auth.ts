import { ethers } from "ethers";
import {
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { getTronWeb, tronBase58ToHex } from "./tron-wallet";
import type { EnclaveTxAuthFields } from "./types";
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
  sessionId: string,
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
  return { sessionId, signature, nonce, timestamp: Date.now() };
};

export const buildTronDepositAuthFields = (
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> =>
  signTypedData(sessionId, "Deposit", chainId, (nonce) => ({
    nonce,
    sessionId,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
  }));

export const buildTronTransferAuthFields = (
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(sessionId, "Transfer", chainId, (nonce) => ({
    nonce,
    sessionId,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronWithdrawAuthFields = (
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(sessionId, "Withdraw", chainId, (nonce) => ({
    nonce,
    sessionId,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronPrivateSendAuthFields = (
  sessionId: string,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
): Promise<EnclaveTxAuthFields> =>
  signTypedData(sessionId, "PrivateSend", chainId, (nonce) => ({
    nonce,
    sessionId,
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
  sessionId: string,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  signTypedData(sessionId, "WithdrawStuckUtxos", chainId, (nonce) => ({
    nonce,
    sessionId,
    chainId: BigInt(chainId),
    tokenAddress: ethers.getAddress(tokenAddress),
    recipient: ethers.getAddress(recipientAddress),
  }));
