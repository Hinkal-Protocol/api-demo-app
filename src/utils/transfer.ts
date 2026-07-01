import { buildAuthPost } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { FeeStructure } from "./fees";
import { isValidPrivateAddress } from "./recipientAddress";
import { resolveTransferAuth } from "./resolve-tx-auth";
import type { TxSessionAuth, TxWallet } from "./types";

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
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const isPrivate = isValidPrivateAddress(recipientAddress);
  const normalizedRecipient = isPrivate ? normalizeRecipientForSigning(recipientAddress) : recipientAddress;
  const txParams = {
    tokenAddresses,
    amounts,
    ...(isPrivate ? { recipientInfo: normalizedRecipient } : { recipientAddress: normalizedRecipient }),
    feeToken,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txParams,
    () =>
      resolveTransferAuth(
        wallet,
        session.sessionId,
        chainId,
        tokenAddresses,
        amounts,
        normalizedRecipient,
        feeToken,
        feeStructure,
      ),
  );

  const { res, data } = await enclaveFetch<
    | { success: true; txHash: string }
    | { error?: string }
  >("/transfer", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};
