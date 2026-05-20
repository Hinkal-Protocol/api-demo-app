import { ethers } from "ethers";
import { ENCLAVE_TRANSACTION_NAMES } from "../constants/enclave.constants";
import { API_BASE_URL } from "../constants/server.constants";
import { buildTokenDepositAuthFields } from "./enclave-auth";

export type TxData = {
  to: string;
  data: string;
  value?: string;
  from?: string;
  gasLimit?: string;
};

export const deposit = async (
  signer: ethers.Signer,
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData> => {
  const authFields = await buildTokenDepositAuthFields(
    signer,
    ENCLAVE_TRANSACTION_NAMES.deposit,
    { chainId, tokenAddresses, amounts },
  );
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
    | { success: true; txData: TxData }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};
