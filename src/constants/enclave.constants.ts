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
    { name: "feeToken", type: "address" },
    { name: "feeStructure", type: "FeeStructure" },
  ],
  Withdraw: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
    { name: "feeToken", type: "address" },
    { name: "feeStructure", type: "FeeStructure" },
  ],
  Swap: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "externalActionId", type: "string" },
    { name: "swapData", type: "string" },
    { name: "feeToken", type: "address" },
    { name: "feeStructure", type: "FeeStructure" },
  ],
  PrivateSend: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipients", type: "RecipientAmount[]" },
    { name: "feeToken", type: "address" },
    { name: "txCompletionTime", type: "uint256" },
  ],
  WithdrawStuckUtxos: [
    { name: "nonce", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipient", type: "address" },
  ],
};

export const getEnclaveTypedDataDomain = (
  chainId: number,
): TypedDataDomain => ({
  name: ENCLAVE_TYPED_DATA_DOMAIN_NAME,
  chainId,
});

export const getTypesForPrimary = (
  primaryType: EnclaveTypedDataPrimaryType,
): Record<string, TypedDataField[]> => {
  const types: Record<string, TypedDataField[]> = {
    [primaryType]: ENCLAVE_TYPED_DATA_TYPES[primaryType],
  };

  const usesTokenAmount = ENCLAVE_TYPED_DATA_TYPES[primaryType].some(
    (field) => field.type === "TokenAmount" || field.type === "TokenAmount[]",
  );
  if (usesTokenAmount) {
    types.TokenAmount = ENCLAVE_TYPED_DATA_TYPES.TokenAmount;
  }

  const usesRecipientAmount = ENCLAVE_TYPED_DATA_TYPES[primaryType].some(
    (field) =>
      field.type === "RecipientAmount" || field.type === "RecipientAmount[]",
  );
  if (usesRecipientAmount) {
    types.RecipientAmount = ENCLAVE_TYPED_DATA_TYPES.RecipientAmount;
  }

  if (ENCLAVE_TYPED_DATA_TYPES[primaryType].some((f: TypedDataField) => f.type === "FeeStructure")) {
    types.FeeStructure = ENCLAVE_TYPED_DATA_TYPES.FeeStructure;
  }

  return types;
};
