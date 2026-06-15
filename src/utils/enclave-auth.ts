import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import type { EnclaveTxAuthFields, TxSessionAuth } from "./types";
import { Recipient } from "./multiSend";

type TokenAmountPair = { token: string; amount: string };

const normalizeTokenAmountPairs = (
  tokenAddresses: string[],
  amounts: string[],
): TokenAmountPair[] => {
  if (tokenAddresses.length !== amounts.length) {
    throw new Error("tokenAddresses and amounts must have the same length");
  }
  return tokenAddresses
    .map((token, index) => ({
      token: ethers.getAddress(token),
      amount: amounts[index],
    }))
    .sort((a, b) => a.token.localeCompare(b.token));
};

const toTokenAmountValues = (pairs: TokenAmountPair[]) =>
  pairs.map(({ token, amount }) => ({
    token,
    amount: BigInt(amount),
  }));

export const resolveTxAuthFields = async (
  session: TxSessionAuth,
  buildTypedAuth: () => Promise<EnclaveTxAuthFields>,
): Promise<EnclaveTxAuthFields> => {
  if (session.hasWriteAccess) {
    return {
      signature: session.signature,
      sessionId: session.sessionId,
      nonce: crypto.randomUUID(),
      timestamp: Date.now(),
    };
  }
  return buildTypedAuth();
};

/** Personal message signature for getter routes (balance, fees, swap quote, etc.). */
export const buildEnclaveAuthFields = async (
  signer: ethers.Signer,
): Promise<EnclaveTxAuthFields> => {
  const sessionId = crypto.randomUUID();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(sessionId, EnclaveSessionAccess.Read),
  );
  return {
    signature,
    sessionId,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  };
};

const signEnclaveTypedData = async (
  session: TxSessionAuth,
  signer: ethers.Signer,
  primaryType: EnclaveTypedDataPrimaryType,
  chainId: number,
  buildMessage: (nonce: string) => Record<string, unknown>,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const signature = await signer.signTypedData(
    getEnclaveTypedDataDomain(chainId),
    getTypesForPrimary(primaryType),
    buildMessage(nonce),
  );
  return {
    sessionId: session.sessionId,
    signature,
    nonce,
    timestamp: Date.now(),
  };
};

export const buildDepositAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  primaryType: "Deposit" | "ProoflessDeposit",
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(
    session,
    signer,
    primaryType,
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
    }),
  );

export const buildTransferAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(
    session,
    signer,
    "Transfer",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
      recipient: params.recipient,
    }),
  );

export const buildWithdrawAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(
    session,
    signer,
    "Withdraw",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
      recipient: params.recipient,
    }),
  );

export const buildWithdrawStuckUtxosAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipientAddress: string;
  },
) =>
  signEnclaveTypedData(
    session,
    signer,
    "WithdrawStuckUtxos",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAddress: ethers.getAddress(params.tokenAddress),
      recipient: ethers.getAddress(params.recipientAddress),
    }),
  );

export const buildSwapAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(session, signer, "Swap", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildDepositAndWithdrawAuthFields = (
  session: TxSessionAuth,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipients: Recipient[];
  },
) =>
  signEnclaveTypedData(
    session,
    signer,
    "PrivateSend",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAddress: params.tokenAddress,
      // Must match the server's normalizeDepositAndWithdrawRecipients:
      // checksum each address, then sort by it (enclaveTypedData.ts).
      recipients: params.recipients
        .map(({ address, amount }) => ({
          recipient: ethers.getAddress(address),
          amount: BigInt(amount),
        }))
        .sort((a, b) => a.recipient.localeCompare(b.recipient)),
    }),
  );
