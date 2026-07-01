import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { EnclaveSessionAuthMode } from "./auth";
import { requestSignatureGetHeader, requestSignaturePostHeader, sessionBodyParams, sessionQueryParams } from "./request-signature";
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
        ...(await requestSignaturePostHeader(session, body)),
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
  const value = buildMessage(nonce);
  const signature = await signer.signTypedData(
    getEnclaveTypedDataDomain(chainId),
    getTypesForPrimary(primaryType, value),
    value,
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

export const buildDepositForOtherAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[]; recipient: string },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "DepositForOther",
    params.chainId,
    (nonce) => ({
      ...buildTokenAmountsBase(nonce, sessionId, params),
      recipientInfo: params.recipient,
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
    feeToken?: string;
    feeStructure?: { feeToken: string; flatFee: string; variableRate: string };
  },
) =>
  signEnclaveTypedData(sessionId, signer, "Transfer", params.chainId, (nonce) => {
    const value: Record<string, unknown> = {
      ...buildTokenAmountsBase(nonce, sessionId, params),
      recipient: params.recipient,
    };

    if (params.feeToken) {
      value.feeToken = ethers.getAddress(params.feeToken);
    }
    if (params.feeStructure) {
      value.feeStructure = {
        feeToken: ethers.getAddress(params.feeStructure.feeToken),
        flatFee: BigInt(params.feeStructure.flatFee),
        variableRate: BigInt(params.feeStructure.variableRate),
      };
    }

    return value;
  });

export const buildWithdrawAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
    feeToken?: string;
    feeStructure?: { feeToken: string; flatFee: string; variableRate: string };
  },
) =>
  signEnclaveTypedData(sessionId, signer, "Withdraw", params.chainId, (nonce) => {
    const value: Record<string, unknown> = {
      ...buildTokenAmountsBase(nonce, sessionId, params),
      recipient: params.recipient,
    };

    if (params.feeToken) {
      value.feeToken = ethers.getAddress(params.feeToken);
    }
    if (params.feeStructure) {
      value.feeStructure = {
        feeToken: ethers.getAddress(params.feeStructure.feeToken),
        flatFee: BigInt(params.feeStructure.flatFee),
        variableRate: BigInt(params.feeStructure.variableRate),
      };
    }

    return value;
  });

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
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    externalActionId: string;
    swapData: string;
    feeToken?: string;
    feeStructure?: { feeToken: string; flatFee: string; variableRate: string };
  },
) =>
  signEnclaveTypedData(sessionId, signer, "Swap", params.chainId, (nonce) => {
    const value: Record<string, unknown> = {
      ...buildTokenAmountsBase(nonce, sessionId, params),
      externalActionId: params.externalActionId,
      swapData: params.swapData,
    };

    if (params.feeToken) {
      value.feeToken = ethers.getAddress(params.feeToken);
    }
    if (params.feeStructure) {
      value.feeStructure = {
        feeToken: ethers.getAddress(params.feeStructure.feeToken),
        flatFee: BigInt(params.feeStructure.flatFee),
        variableRate: BigInt(params.feeStructure.variableRate),
      };
    }

    return value;
  });

export const buildDepositAndWithdrawAuthFields = (
  sessionId: string,
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipients: Recipient[];
    feeToken?: string;
    txCompletionTime?: number;
  },
) =>
  signEnclaveTypedData(
    sessionId,
    signer,
    "PrivateSend",
    params.chainId,
    (nonce) => {
      const value: Record<string, unknown> = {
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
      };

      if (params.feeToken) {
        value.feeToken = ethers.getAddress(params.feeToken);
      }
      if (params.txCompletionTime !== undefined) {
        value.txCompletionTime = BigInt(params.txCompletionTime);
      }

      return value;
    },
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
    headers: await requestSignatureGetHeader(auth, queryString),
  };
};
