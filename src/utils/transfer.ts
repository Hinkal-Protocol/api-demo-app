import { ethers } from "ethers";
import { buildTransferAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { hasKeySignSession, signWriteRequest } from "./session";
import type { EnclaveAuthFields, TxSessionAuth } from "./types";
import { FeeStructure } from "./fees";

// ONLY FOR WALLET-CONNECT
// for wallet-connect sessions thier safeJsonParse method identifies long consecutive
// numbers as a bigint and adds " delimiters which messes up json decoding for this request
// so as a workaround we conver this to hex
const normalizeRecipientForSigning = (recipient: string): string => {
  const parts = recipient.split(",");
  if (parts.length !== 5) return recipient;
  return parts
    .map((part) => {
      if (part.startsWith("0x")) return part;
      try {
        return "0x" + BigInt(part).toString(16);
      } catch {
        return part;
      }
    })
    .join(",");
};

export const transfer = async (
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
  buildReadOnlyAuth?: () => Promise<EnclaveAuthFields>,
): Promise<string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
    if (!signer) throw new Error("EVM signer required for transfer without write-access session");
    return buildTransferAuthFields(signer, { chainId, tokenAddresses, amounts, recipient: normalizeRecipientForSigning(recipientAddress) });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
    recipientAddress: normalizeRecipientForSigning(recipientAddress),
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
  >("/transfer", authFields.nonce, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};
