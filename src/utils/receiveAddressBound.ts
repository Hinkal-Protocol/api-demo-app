import {
  buildAuthPost,
  buildReceiveAddressBoundAuthFields,
} from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { requireEvmSigner } from "./ethers-wallet";
import type { TxSessionAuth, TxWallet } from "./types";

export type BoundReceiveRecord = {
  vaultAddress: string;
  expiry: string;
};

export const createBoundReceiveAddress = async (
  wallet: TxWallet,
  session: TxSessionAuth,
  chainId: number,
  recipientAddress: string,
): Promise<BoundReceiveRecord> => {
  const txParams = { recipientAddress };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    "/receive-address-bound",
    txParams,
    () =>
      buildReceiveAddressBoundAuthFields(
        session.sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, recipientAddress },
      ),
  );

  const { res, data } = await enclaveFetch<
    { success: true; record: BoundReceiveRecord } | { error?: string }
  >("/receive-address-bound", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ??
        "Create bound receive address failed",
    );
  }

  return data.record;
};
