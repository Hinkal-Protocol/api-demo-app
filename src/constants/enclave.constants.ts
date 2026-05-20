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
  | "DepositAndWithdraw"
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
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  ProoflessDeposit: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  DepositForOther: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipientInfo", type: "string" },
  ],
  Transfer: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
  ],
  Withdraw: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
  ],
  Swap: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  DepositAndWithdraw: [
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipients", type: "RecipientAmount[]" },
  ],
  WithdrawStuckUtxos: [
    { name: "nonce", type: "string" },
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

  return types;
};
