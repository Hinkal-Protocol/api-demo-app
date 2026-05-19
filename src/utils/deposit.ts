import { API_BASE_URL } from "../constants/server.constants";
import { Auth } from "./types";

export type TxData = {
  to: string;
  data: string;
  value?: string;
  from?: string;
  gasLimit?: string;
};

export const deposit = async (
  auth: Auth,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData> => {
  const { signature, nonce, address, chainId } = auth;
  const body = { signature, nonce, address, chainId, tokenAddresses, amounts };

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
