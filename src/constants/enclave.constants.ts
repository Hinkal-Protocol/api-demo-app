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
  FeeStructure: [
    { name: "feeToken", type: "address" },
    { name: "flatFee", type: "uint256" },
    { name: "variableRate", type: "uint256" },
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
const FEE_STRUCTURE_FIELD: TypedDataField = { name: "feeStructure", type: "FeeStructure" };
const TX_COMPLETION_TIME_FIELD: TypedDataField = { name: "txCompletionTime", type: "uint256" };

const getPrimaryFields = (
  primaryType: EnclaveTypedDataPrimaryType,
  value: Record<string, unknown>,
): TypedDataField[] => {
  const fields = [...ENCLAVE_TYPED_DATA_TYPES[primaryType]];

  if (value.feeToken) fields.push(FEE_TOKEN_FIELD);
  if (value.feeStructure) fields.push(FEE_STRUCTURE_FIELD);
  if (value.txCompletionTime !== undefined) fields.push(TX_COMPLETION_TIME_FIELD);

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

  if (fields.some((f: TypedDataField) => f.type === "FeeStructure")) {
    types.FeeStructure = ENCLAVE_TYPED_DATA_TYPES.FeeStructure;
  }

  return types;
};
