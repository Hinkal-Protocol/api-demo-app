import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { EnclaveSessionAuthMode } from "./auth";
import { hmacPostHeader, sessionBodyParams } from "./hmac";
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

export const buildAuthPost = async (
  session: TxSessionAuth,
  address: string,
  chainId: number,
  txData: Record<string, unknown>,
  buildTypedDataAuth: () => Promise<EnclaveTxAuthFields>,
): Promise<{
  body: Record<string, unknown>;
  bodyJson: string;
  headers: Record<string, string>;
  requestNonce: string;
}> => {
  if (session.authMode === EnclaveSessionAuthMode.Normal) {
    const body = { ...sessionBodyParams(session, address, chainId), ...txData };
    const bodyJson = JSON.stringify(body);
    return {
      body,
      bodyJson,
      headers: {
        "Content-Type": "application/json",
        ...(await hmacPostHeader(session, body)),
      },
      requestNonce: body.nonce,
    };
  }

  const authFields = await buildTypedDataAuth();
  const body = { ...authFields, address, chainId, ...txData };
  const bodyJson = JSON.stringify(body);
  return {
    body,
    bodyJson,
    headers: { "Content-Type": "application/json" },
    requestNonce: authFields.nonce,
  };
};

const signEnclaveTypedData = async (
  sessionId: string,
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
    sessionId,
    signature,
    nonce,
    timestamp: Date.now(),
  };
};

export const buildDepositAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  primaryType: "Deposit" | "ProoflessDeposit",
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    primaryType,
    params.chainId,
    (nonce) => ({
      nonce,
      sessionId,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
    }),
  );

export const buildTransferAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "Transfer",
    params.chainId,
    (nonce) => ({
      nonce,
      sessionId,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
      recipient: params.recipient,
    }),
  );

export const buildWithdrawAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "Withdraw",
    params.chainId,
    (nonce) => ({
      nonce,
      sessionId,
      chainId: BigInt(params.chainId),
      tokenAmounts: toTokenAmountValues(
        normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
      ),
      recipient: params.recipient,
    }),
  );

export const buildWithdrawStuckUtxosAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipientAddress: string;
  },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "WithdrawStuckUtxos",
    params.chainId,
    (nonce) => ({
      nonce,
      sessionId,
      chainId: BigInt(params.chainId),
      tokenAddress: ethers.getAddress(params.tokenAddress),
      recipient: ethers.getAddress(params.recipientAddress),
    }),
  );

export const buildSwapAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(sessionId, signer, "Swap", params.chainId, (nonce) => ({
    nonce,
    sessionId,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildDepositAndWithdrawAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipients: Recipient[];
  },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "PrivateSend",
    params.chainId,
    (nonce) => ({
      nonce,
      sessionId,
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
