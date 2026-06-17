import { ethers } from "ethers";
import {
  buildWithdrawAuthFields,
  buildWithdrawStuckUtxosAuthFields,
  resolveTxAuthFields,
} from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { hasKeySignSession, signWriteRequest } from "./session";
import type { EnclaveAuthFields, TxSessionAuth } from "./types";
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
  buildReadOnlyAuth?: () => Promise<EnclaveAuthFields>,
): Promise<string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
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

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let finalBody: Record<string, unknown> = body;
  if (session.hasWriteAccess && hasKeySignSession()) {
    const signed = signWriteRequest(body);
    finalBody = signed.body;
    headers["X-Request-Signature"] = signed.signature;
  }

  const { res, data } = await enclaveFetch<
    | { success: true; txHash: string }
    | { error?: string }
  >("/withdraw", authFields.nonce, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

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
  buildReadOnlyAuth?: () => Promise<EnclaveAuthFields>,
): Promise<string[]> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
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

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let finalBody: Record<string, unknown> = body;
  if (session.hasWriteAccess && hasKeySignSession()) {
    const signed = signWriteRequest(body);
    finalBody = signed.body;
    headers["X-Request-Signature"] = signed.signature;
  }

  const { res, data } = await enclaveFetch<
    | { success: true; txHashes: string[] }
    | { error?: string }
  >("/withdraw-stuck-utxos", authFields.nonce, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Withdraw stuck UTXOs failed",
    );
  }

  return data.txHashes;
};
