import type { TypedDataDomain } from "ethers";

type TypedDataField = { name: string; type: string };

export const ENCLAVE_TYPED_DATA_DOMAIN_NAME = "Hinkal Enclave";
export const ENCLAVE_TYPED_DATA_VERSION = "1";

export const ENCLAVE_TRANSACTION_NAMES = {
  deposit: "Deposit",
  prooflessDeposit: "ProoflessDeposit",
  transfer: "Transfer",
  withdraw: "Withdraw",
  swap: "Swap",
  depositAndWithdraw: "DepositAndWithdraw",
} as const;

export type EnclaveTransactionName =
  (typeof ENCLAVE_TRANSACTION_NAMES)[keyof typeof ENCLAVE_TRANSACTION_NAMES];

export type EnclaveTypedDataPrimaryType =
  | "TokenDeposit"
  | "TokenDepositForOther"
  | "TokenTransfer"
  | "TokenSwap"
  | "DepositAndWithdraw"
  | "WithdrawStuckUtxos";

export const ENCLAVE_TYPED_DATA_TYPES: Record<string, TypedDataField[]> = {
  TokenAmount: [
    { name: "token", type: "address" },
    { name: "amount", type: "int256" },
  ],
  TokenDeposit: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  TokenDepositForOther: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipientInfo", type: "string" },
  ],
  TokenTransfer: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
    { name: "recipient", type: "string" },
  ],
  TokenSwap: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAmounts", type: "TokenAmount[]" },
  ],
  RecipientAmount: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "int256" },
  ],
  DepositAndWithdraw: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipients", type: "RecipientAmount[]" },
  ],
  WithdrawStuckUtxos: [
    { name: "transaction", type: "string" },
    { name: "nonce", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "tokenAddress", type: "address" },
    { name: "recipient", type: "address" },
  ],
};

export const getEnclaveTypedDataDomain = (chainId: number): TypedDataDomain => ({
  name: ENCLAVE_TYPED_DATA_DOMAIN_NAME,
  version: ENCLAVE_TYPED_DATA_VERSION,
  chainId,
});

export const getTypesForPrimary = (
  primaryType: EnclaveTypedDataPrimaryType,
): Record<string, TypedDataField[]> => {
  const types: Record<string, TypedDataField[]> = {
    [primaryType]: ENCLAVE_TYPED_DATA_TYPES[primaryType],
  };

  const usesTokenAmount = ENCLAVE_TYPED_DATA_TYPES[primaryType].some(
    (field) =>
      field.type === "TokenAmount" || field.type === "TokenAmount[]",
  );
  if (usesTokenAmount) {
    types.TokenAmount = ENCLAVE_TYPED_DATA_TYPES.TokenAmount;
  }

  const usesRecipientAmount = ENCLAVE_TYPED_DATA_TYPES[primaryType].some(
    (field) =>
      field.type === "RecipientAmount" ||
      field.type === "RecipientAmount[]",
  );
  if (usesRecipientAmount) {
    types.RecipientAmount = ENCLAVE_TYPED_DATA_TYPES.RecipientAmount;
  }

  return types;
};
