import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { buildEnclaveSignMessage, EnclaveSessionAccess } from "./auth";
import type { EnclaveAuthFields, TxSessionAuth } from "./types";

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

export const resolveTxAuthFields = async (
  session: TxSessionAuth,
  buildTypedAuth: () => Promise<EnclaveAuthFields>,
): Promise<EnclaveAuthFields> => {
  if (session.hasWriteAccess) {
    return { signature: session.signature, nonce: session.nonce };
  }
  return buildTypedAuth();
};

/** Personal message signature for getter routes (balance, fees, swap quote, etc.). */
export const buildEnclaveAuthFields = async (
  signer: ethers.Signer,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(nonce, EnclaveSessionAccess.Read),
  );
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

export const buildDepositAuthFields = (
  signer: ethers.Signer,
  primaryType: "Deposit" | "ProoflessDeposit",
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, primaryType, params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildTransferAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(signer, "Transfer", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
    recipient: params.recipient,
  }));

export const buildWithdrawAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(signer, "Withdraw", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
    recipient: params.recipient,
  }));

export const buildSwapAuthFields = (
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, "Swap", params.chainId, (nonce) => ({
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
  signEnclaveTypedData(
    signer,
    "DepositAndWithdraw",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAddress: params.tokenAddress,
      recipients: [
        {
          recipient: params.recipientAddress,
          amount: BigInt(params.amount),
        },
      ],
    }),
  );
