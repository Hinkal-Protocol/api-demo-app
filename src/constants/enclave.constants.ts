import type { TypedDataDomain } from "ethers";

type TypedDataField = { name: string; type: string };

const ENCLAVE_TYPED_DATA_DOMAIN_NAME = "Hinkal Enclave";

export type EnclaveTypedDataPrimaryType =
  | "Deposit"
  | "ProoflessDeposit"
  | "DepositForOther"
  | "Transfer"
  | "Withdraw"
  | "Swap"
  | "PrivateSend"
  | "WithdrawStuckUtxos";

const ENCLAVE_TYPED_DATA_TYPES: Record<string, TypedDataField[]> = {
  TokenAmount: [
    { name: "token", type: "address" },
    { name: "amount", type: "int256" },
  ],
  RecipientAmount: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "int256" },
  ],
  Deposit: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  ProoflessDeposit: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  DepositForOther: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipientInfo", type: "string" },
  ],
  Transfer: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
  ],
  Withdraw: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
  ],
  Swap: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "externalActionId", type: "string" },
    { name: "swapData", type: "string" },
  ],
  PrivateSend: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipients", type: "RecipientAmount[]" },
  ],
  WithdrawStuckUtxos: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipient", type: "address" },
  ],
};

const FEE_TOKEN_FIELD: TypedDataField = { name: "feeToken", type: "address" };
const FEE_AMOUNT_FIELD: TypedDataField = { name: "feeAmount", type: "uint256" };
const TX_COMPLETION_TIME_FIELD: TypedDataField = { name: "txCompletionTime", type: "uint256" };
const REF_FIELD: TypedDataField = { name: "ref", type: "string" };

const getPrimaryFields = (
  primaryType: EnclaveTypedDataPrimaryType,
  value: Record<string, unknown>,
): TypedDataField[] => {
  const fields = [...ENCLAVE_TYPED_DATA_TYPES[primaryType]];

  if (value.feeToken) fields.push(FEE_TOKEN_FIELD);
  if (value.feeAmount !== undefined) fields.push(FEE_AMOUNT_FIELD);
  if (value.txCompletionTime !== undefined) fields.push(TX_COMPLETION_TIME_FIELD);
  if (value.ref !== undefined) fields.push(REF_FIELD);

  return fields;
};

export const getEnclaveTypedDataDomain = (
  chainId: number,
): TypedDataDomain => ({
  name: ENCLAVE_TYPED_DATA_DOMAIN_NAME,
  chainId,
});

export const getTypesForPrimary = (
  primaryType: EnclaveTypedDataPrimaryType,
  value: Record<string, unknown>,
): Record<string, TypedDataField[]> => {
  const fields = getPrimaryFields(primaryType, value);
  const types: Record<string, TypedDataField[]> = {
    [primaryType]: fields,
  };

  const usesTokenAmount = fields.some(
    (field) => field.type === "TokenAmount" || field.type === "TokenAmount[]",
  );
  if (usesTokenAmount) {
    types.TokenAmount = ENCLAVE_TYPED_DATA_TYPES.TokenAmount;
  }

  const usesRecipientAmount = fields.some(
    (field) =>
      field.type === "RecipientAmount" || field.type === "RecipientAmount[]",
  );
  if (usesRecipientAmount) {
    types.RecipientAmount = ENCLAVE_TYPED_DATA_TYPES.RecipientAmount;
  }

  return types;
};
