import { signSolanaMessage, SolanaWalletProvider } from "./solana-wallet";
import type { EnclaveTxAuthFields } from "./types";
import type { Recipient } from "./multiSend";
import type { FeeStructure } from "./fees";

const DOMAIN_NAME = "Hinkal Enclave";

const buildHeader = (
  primaryType: string,
  nonce: string,
  sessionId: string,
  chainId: number,
): string =>
  `${DOMAIN_NAME}\n\nPrimary Type: ${primaryType}\nSession ID: ${sessionId}\nNonce: ${nonce}\nChain ID: ${chainId}`;

const renderTokenAmounts = (
  tokenAddresses: string[],
  amounts: string[],
): string => {
  const pairs = tokenAddresses
    .map((tokenAddress, i) => ({ tokenAddress, amount: amounts[i] }))
    .sort((a, b) => a.tokenAddress.localeCompare(b.tokenAddress));
  return pairs
    .map(
      ({ tokenAddress, amount }, i) =>
        `  ${i}:\n    Token: ${tokenAddress}\n    Amount: ${amount}`,
    )
    .join("\n");
};

const renderRecipients = (recipients: Recipient[]): string => {
  const sorted = [...recipients].sort((a, b) =>
    a.address.localeCompare(b.address),
  );
  return sorted
    .map(
      ({ address, amount }, i) =>
        `  ${i}:\n    Recipient: ${address}\n    Amount: ${amount}`,
    )
    .join("\n");
};

const renderFeeFields = (feeStructure?: FeeStructure): string => {
  if (!feeStructure) return "";
  const { feeToken, flatFee, variableRate } = feeStructure;
  return `\nFee Structure:\n    Fee Token: ${feeToken}\n    Flat Fee: ${flatFee}\n    Variable Rate: ${variableRate}`;
};

const sign = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  message: string,
  nonce: string,
): Promise<EnclaveTxAuthFields> => {
  const hexSig = await signSolanaMessage(provider, message);
  return {
    sessionId,
    signature: hexSig.startsWith("0x") ? hexSig : `0x${hexSig}`,
    nonce,
    timestamp: Date.now(),
  };
};

export const buildSolanaDepositAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Deposit", nonce, sessionId, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}`;
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaDepositForOtherAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("DepositForOther", nonce, sessionId, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nRecipient Info: ${recipient}`;
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaTransferAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Transfer", nonce, sessionId, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nRecipient: ${recipientAddress}` +
    renderFeeFields(feeStructure);
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaWithdrawAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Withdraw", nonce, sessionId, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nRecipient: ${recipientAddress}` +
    renderFeeFields(feeStructure);
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaPrivateSendAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  feeToken?: string,
  txCompletionTime?: number,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("PrivateSend", nonce, sessionId, chainId)}` +
    `\nToken Address: ${tokenAddress}` +
    `\nRecipients:\n${renderRecipients(recipients)}` +
    `\nFee Token: ${feeToken ?? ""}` +
    `\nTx Completion Time: ${txCompletionTime ?? 0}`;
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaSwapAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  externalActionId: string,
  swapData: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Swap", nonce, sessionId, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nExternal Action ID: ${externalActionId}` +
    `\nSwap Data: ${swapData}` +
    renderFeeFields(feeStructure);
  return sign(sessionId, provider, message, nonce);
};

export const buildSolanaWithdrawStuckUtxosAuthFields = async (
  sessionId: string,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("WithdrawStuckUtxos", nonce, sessionId, chainId)}` +
    `\nToken Address: ${tokenAddress}` +
    `\nRecipient: ${recipientAddress}`;
  return sign(sessionId, provider, message, nonce);
};
