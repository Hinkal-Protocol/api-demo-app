import { ethers } from "ethers";
import { buildDepositAuthFields, resolveTxAuthFields } from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import type { EnclaveTxAuthFields, TxSessionAuth } from "./types";

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
  buildReadOnlyAuth?: () => Promise<EnclaveTxAuthFields>,
): Promise<TxData | string> => {
  const authFields = await resolveTxAuthFields(session, () => {
    if (buildReadOnlyAuth) return buildReadOnlyAuth();
    if (!signer) throw new Error("EVM signer required for deposit without write-access session");
    return buildDepositAuthFields(session, signer, "Deposit", { chainId, tokenAddresses, amounts });
  });
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
  };

  const { res, data } = await enclaveFetch<
    | { success: true; txData: TxData | string }
    | { error?: string }
  >("/deposit", authFields.nonce, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};
