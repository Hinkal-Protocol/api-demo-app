import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import {
  buildWithdrawAuthFields,
  buildWithdrawStuckUtxosAuthFields,
  resolveTxAuthFields,
} from "./enclave-auth";
import type { TxSessionAuth } from "./types";
import { FeeStructure } from "./fees";

export const withdraw = async (
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  isRelayerOff?: boolean,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (!signer) throw new Error("EVM signer required for withdraw without write-access session");
    return buildWithdrawAuthFields(signer, { chainId, tokenAddresses, amounts, recipient: recipientAddress });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
    recipientAddress,
    isRelayerOff,
    feeToken,
    feeStructure,
  };

  const res = await fetch(`${API_BASE_URL}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; txHash: string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Withdraw failed");
  }

  return data.txHash;
};

export const withdrawStuckUtxos = async (
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<string[]> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (!signer) throw new Error("EVM signer required for withdrawStuckUtxos without write-access session");
    return buildWithdrawStuckUtxosAuthFields(signer, { chainId, tokenAddress, recipientAddress });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddress,
    recipientAddress,
  };

  const res = await fetch(`${API_BASE_URL}/withdraw-stuck-utxos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; txHashes: string[] }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Withdraw stuck UTXOs failed",
    );
  }

  return data.txHashes;
};
