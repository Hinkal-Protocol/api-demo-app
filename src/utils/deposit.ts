import { ethers } from "ethers";
import { buildDepositAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { hasKeySignSession, signWriteRequest } from "./session";
import type { EnclaveAuthFields, TxSessionAuth } from "./types";

export type TxData = {
  to: string;
  data: string;
  value?: string;
  from?: string;
  gasLimit?: string;
};

export const deposit = async (
  signer: ethers.Signer | null,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  buildReadOnlyAuth?: () => Promise<EnclaveAuthFields>,
): Promise<TxData | string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
    if (!signer) throw new Error("EVM signer required for deposit without write-access session");
    return buildDepositAuthFields(signer, "Deposit", { chainId, tokenAddresses, amounts });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let finalBody: Record<string, unknown> = body;
  if (session.hasWriteAccess && hasKeySignSession()) {
    const signed = signWriteRequest(body);
    finalBody = signed.body;
    headers["X-Request-Signature"] = signed.signature;
  }

  const { res, data } = await enclaveFetch<
    | { success: true; txData: TxData | string }
    | { error?: string }
  >("/deposit", authFields.nonce, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};
