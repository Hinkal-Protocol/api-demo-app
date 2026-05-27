import { ethers } from "ethers";
import {
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import { generateNonce } from "./enclave-auth";
import { getTronWeb } from "./tron-wallet";
import type { EnclaveAuthFields } from "./types";
import type { Recipient } from "./multiSend";

const signTypedData = async (
  primaryType: Parameters<typeof getTypesForPrimary>[0],
  chainId: number,
  buildValue: (nonce: string) => Record<string, unknown>,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const domain = getEnclaveTypedDataDomain(chainId);
  const types = getTypesForPrimary(primaryType);
  const value = buildValue(nonce);

  const tw = getTronWeb();
  // tronWeb.trx.signTypedData requires { domain, types, message, primaryType }
  const typedData = {
    domain,
    types: { EIP712Domain: [], ...types },
    message: value,
    primaryType,
  };
  const signature: string = await tw.trx.signTypedData(typedData);
  return { signature, nonce };
};

export const buildTronDepositAuthFields = (
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveAuthFields> =>
  signTypedData("Deposit", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
  }));

export const buildTronTransferAuthFields = (
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveAuthFields> =>
  signTypedData("Transfer", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronWithdrawAuthFields = (
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveAuthFields> =>
  signTypedData("Withdraw", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAmounts: tokenAddresses.map((token, i) => ({
      token: ethers.getAddress(token),
      amount: BigInt(amounts[i]),
    })).sort((a, b) => a.token.localeCompare(b.token)),
    recipient,
  }));

export const buildTronPrivateSendAuthFields = (
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
): Promise<EnclaveAuthFields> =>
  signTypedData("PrivateSend", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAddress: ethers.getAddress(tokenAddress),
    recipients: [...recipients]
      .map(({ address, amount }) => ({
        recipient: ethers.getAddress(address),
        amount: BigInt(amount),
      }))
      .sort((a, b) => a.recipient.localeCompare(b.recipient)),
  }));

export const buildTronWithdrawStuckUtxosAuthFields = (
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveAuthFields> =>
  signTypedData("WithdrawStuckUtxos", chainId, (nonce) => ({
    nonce,
    chainId: BigInt(chainId),
    tokenAddress: ethers.getAddress(tokenAddress),
    recipient: ethers.getAddress(recipientAddress),
  }));
