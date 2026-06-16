import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { EnclaveSessionAuthMode } from "./auth";
import { hmacGetHeader, hmacPostHeader, sessionBodyParams, sessionQueryParams } from "./hmac";
import type { Auth, EnclaveTxAuthFields, TxSessionAuth } from "./types";
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

const buildTokenAmountsBase = (
  nonce: string,
  sessionId: string,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) => ({
  nonce,
  sessionId,
  chainId: BigInt(params.chainId),
  tokenAmounts: toTokenAmountValues(normalizeTokenAmountPairs(params.tokenAddresses, params.amounts)),
});

export const buildAuthPost = async (
  session: TxSessionAuth,
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
    const body = { ...sessionBodyParams(session, chainId), ...txData };
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
  const body = { ...authFields, chainId, ...txData };
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
    (nonce) => buildTokenAmountsBase(nonce, sessionId, params),
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
  signEnclaveTypedData(sessionId, signer, "Transfer", params.chainId, (nonce) => ({
    ...buildTokenAmountsBase(nonce, sessionId, params),
    recipient: params.recipient,
  }));

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
  signEnclaveTypedData(sessionId, signer, "Withdraw", params.chainId, (nonce) => ({
    ...buildTokenAmountsBase(nonce, sessionId, params),
    recipient: params.recipient,
  }));

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
  signEnclaveTypedData(sessionId, signer, "Swap", params.chainId, (nonce) =>
    buildTokenAmountsBase(nonce, sessionId, params),
  );

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

type QueryParamValue = string | string[];

const appendQueryParams = (
  search: URLSearchParams,
  params: Record<string, QueryParamValue>,
): void => {
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.append(key, value);
    }
  }
};

export const buildAuthGet = async (
  auth: Auth,
  params: Record<string, QueryParamValue> = {},
): Promise<{
  queryString: string;
  headers: Record<string, string>;
  requestNonce: string;
}> => {
  const base = sessionQueryParams(auth, auth.chainId);
  const search = new URLSearchParams();
  appendQueryParams(search, { ...base, ...params });
  const queryString = search.toString();
  return {
    queryString,
    requestNonce: base.nonce,
    headers: await hmacGetHeader(auth, queryString),
  };
};
