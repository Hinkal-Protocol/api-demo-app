import { signSolanaMessage, SolanaWalletProvider } from "./solana-wallet";
import type { EnclaveTxAuthFields, TxSessionAuth } from "./types";
import type { Recipient } from "./multiSend";

const DOMAIN_NAME = "Hinkal Enclave";

const buildHeader = (primaryType: string, nonce: string, chainId: number): string =>
  `${DOMAIN_NAME}\n\nPrimary Type: ${primaryType}\nNonce: ${nonce}\nChain ID: ${chainId}`;

const renderTokenAmounts = (tokenAddresses: string[], amounts: string[]): string => {
  const pairs = tokenAddresses
    .map((tokenAddress, i) => ({ tokenAddress, amount: amounts[i] }))
    .sort((a, b) => a.tokenAddress.localeCompare(b.tokenAddress));
  return pairs
    .map(({ tokenAddress, amount }, i) => `  ${i}:\n    Token: ${tokenAddress}\n    Amount: ${amount}`)
    .join("\n");
};

const renderRecipients = (recipients: Recipient[]): string => {
  const sorted = [...recipients].sort((a, b) => a.address.localeCompare(b.address));
  return sorted
    .map(({ address, amount }, i) => `  ${i}:\n    Recipient: ${address}\n    Amount: ${amount}`)
    .join("\n");
};

const sign = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  message: string,
  nonce: string,
): Promise<EnclaveTxAuthFields> => {
  const hexSig = await signSolanaMessage(provider, message);
  return {
    sessionId: session.sessionId,
    signature: hexSig.startsWith("0x") ? hexSig : `0x${hexSig}`,
    nonce,
    timestamp: Date.now(),
  };
};

export const buildSolanaDepositAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Deposit", nonce, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}`;
  return sign(session, provider, message, nonce);
};

export const buildSolanaTransferAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Transfer", nonce, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nRecipient: ${recipientAddress}`;
  return sign(session, provider, message, nonce);
};

export const buildSolanaWithdrawAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Withdraw", nonce, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}` +
    `\nRecipient: ${recipientAddress}`;
  return sign(session, provider, message, nonce);
};

export const buildSolanaPrivateSendAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("PrivateSend", nonce, chainId)}` +
    `\nToken Address: ${tokenAddress}` +
    `\nRecipients:\n${renderRecipients(recipients)}`;
  return sign(session, provider, message, nonce);
};

export const buildSolanaSwapAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("Swap", nonce, chainId)}` +
    `\nToken Amounts:\n${renderTokenAmounts(tokenAddresses, amounts)}`;
  return sign(session, provider, message, nonce);
};

export const buildSolanaWithdrawStuckUtxosAuthFields = async (
  session: TxSessionAuth,
  provider: SolanaWalletProvider,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> => {
  const nonce = crypto.randomUUID();
  const message =
    `${buildHeader("WithdrawStuckUtxos", nonce, chainId)}` +
    `\nToken Address: ${tokenAddress}` +
    `\nRecipient: ${recipientAddress}`;
  return sign(session, provider, message, nonce);
};
