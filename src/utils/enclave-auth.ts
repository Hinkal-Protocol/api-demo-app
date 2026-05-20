import { ethers } from "ethers";
import {
  ENCLAVE_TRANSACTION_NAMES,
  type EnclaveTransactionName,
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { buildSignMessage } from "./auth";
import type { EnclaveAuthFields } from "./types";

export const generateNonce = (): string => crypto.randomUUID();

type TokenAmountPair = { token: string; amount: string };

const normalizeTokenAmountPairs = (
  tokenAddresses: string[],
  amounts: string[],
): TokenAmountPair[] => {
  if (tokenAddresses.length !== amounts.length) {
    throw new Error("tokenAddresses and amounts must have the same length");
  }
  return tokenAddresses.map((token, index) => ({
    token,
    amount: amounts[index],
  }));
};

const toTokenAmountValues = (pairs: TokenAmountPair[]) =>
  pairs.map(({ token, amount }) => ({
    token,
    amount: BigInt(amount),
  }));

/** Personal message signature for getter routes (balance, fees, swap quote, etc.). */
export const buildEnclaveAuthFields = async (
  signer: ethers.Signer,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(buildSignMessage(nonce));
  return { signature, nonce };
};

const signEnclaveTypedData = async (
  signer: ethers.Signer,
  primaryType: EnclaveTypedDataPrimaryType,
  chainId: number,
  buildMessage: (nonce: string) => Record<string, unknown>,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const signature = await signer.signTypedData(
    getEnclaveTypedDataDomain(chainId),
    getTypesForPrimary(primaryType),
    buildMessage(nonce),
  );
  return { signature, nonce };
};

export const buildTokenDepositAuthFields = (
  signer: ethers.Signer,
  transactionName: EnclaveTransactionName,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, "TokenDeposit", params.chainId, (nonce) => ({
    transaction: transactionName,
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildTokenTransferAuthFields = (
  signer: ethers.Signer,
  transactionName: EnclaveTransactionName,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(signer, "TokenTransfer", params.chainId, (nonce) => ({
    transaction: transactionName,
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
    recipient: params.recipient,
  }));

export const buildTokenSwapAuthFields = (
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, "TokenSwap", params.chainId, (nonce) => ({
    transaction: ENCLAVE_TRANSACTION_NAMES.swap,
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildDepositAndWithdrawAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipientAddress: string;
    amount: string;
  },
) =>
  signEnclaveTypedData(signer, "DepositAndWithdraw", params.chainId, (nonce) => ({
    transaction: ENCLAVE_TRANSACTION_NAMES.depositAndWithdraw,
    nonce,
    chainId: BigInt(params.chainId),
    tokenAddress: params.tokenAddress,
    recipients: [
      {
        recipient: params.recipientAddress,
        amount: BigInt(params.amount),
      },
    ],
  }));
