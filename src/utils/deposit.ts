import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import { buildDepositAuthFields, resolveTxAuthFields } from "./enclave-auth";
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

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  const data = (await res.json()) as
    | { success: true; txData: TxData | string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};
