import { ReceiveVaultRecord } from "../types";
import { enclaveFetch } from "./enclaveApi";
import {
  type Session,
  requestSignaturePostHeader,
  sessionBodyParams,
} from "./request-signature";

export const createReceiveAddress = async (
  session: Session,
  chainId: number,
  forceFresh = false
): Promise<ReceiveVaultRecord> => {
  const body = { ...sessionBodyParams(session, chainId), forceFresh };

  const { res, data } = await enclaveFetch<
    { success: true; record: ReceiveVaultRecord } | { error?: string }
  >("/receive-address", body.nonce, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await requestSignaturePostHeader(session, "/receive-address", body)),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Receive address creation failed"
    );
  }

  return data.record;
};
