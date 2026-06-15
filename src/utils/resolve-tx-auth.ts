import { requireEvmSigner } from "./ethers-wallet";
import {
  buildDepositAndWithdrawAuthFields,
  buildDepositAuthFields,
  buildSwapAuthFields,
  buildTransferAuthFields,
  buildWithdrawAuthFields,
  buildWithdrawStuckUtxosAuthFields,
} from "./enclave-auth";
import type { Recipient } from "./multiSend";
import {
  buildSolanaDepositAuthFields,
  buildSolanaPrivateSendAuthFields,
  buildSolanaSwapAuthFields,
  buildSolanaTransferAuthFields,
  buildSolanaWithdrawAuthFields,
  buildSolanaWithdrawStuckUtxosAuthFields,
} from "./solana-auth";
import {
  buildTronDepositAuthFields,
  buildTronPrivateSendAuthFields,
  buildTronTransferAuthFields,
  buildTronWithdrawAuthFields,
  buildTronWithdrawStuckUtxosAuthFields,
} from "./tron-auth";
import { isTronChain } from "./tron-wallet";
import type { EnclaveTxAuthFields, TxWallet } from "./types";
import { isSolanaChain, SolanaWalletProvider } from "./solana-wallet";

const requireSolanaProvider = (
  solanaProvider?: SolanaWalletProvider | null,
): SolanaWalletProvider => {
  if (!solanaProvider) throw new Error("Solana provider not set");
  return solanaProvider;
};

const resolveByChain = <T>(
  chainId: number,
  handlers: {
    solana: () => T;
    tron: () => T;
    evm: () => T;
  },
): T => {
  if (isSolanaChain(chainId)) return handlers.solana();
  if (isTronChain(chainId)) return handlers.tron();
  return handlers.evm();
};

export const resolveDepositAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaDepositAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddresses,
        amounts,
      ),
    tron: () =>
      buildTronDepositAuthFields(sessionId, chainId, tokenAddresses, amounts),
    evm: () =>
      buildDepositAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        "Deposit",
        { chainId, tokenAddresses, amounts },
      ),
  });

export const resolveTransferAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaTransferAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
      ),
    tron: () =>
      buildTronTransferAuthFields(
        sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
      ),
    evm: () =>
      buildTransferAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        tokenAddresses,
        amounts,
        recipient: recipientAddress,
      }),
  });

export const resolveWithdrawAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaWithdrawAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
      ),
    tron: () =>
      buildTronWithdrawAuthFields(
        sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
      ),
    evm: () =>
      buildWithdrawAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        tokenAddresses,
        amounts,
        recipient: recipientAddress,
      }),
  });

export const resolveWithdrawStuckUtxosAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaWithdrawStuckUtxosAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddress,
        recipientAddress,
      ),
    tron: () =>
      buildTronWithdrawStuckUtxosAuthFields(
        sessionId,
        chainId,
        tokenAddress,
        recipientAddress,
      ),
    evm: () =>
      buildWithdrawStuckUtxosAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, tokenAddress, recipientAddress },
      ),
  });

export const resolvePrivateSendAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaPrivateSendAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddress,
        recipients,
      ),
    tron: () =>
      buildTronPrivateSendAuthFields(
        sessionId,
        chainId,
        tokenAddress,
        recipients,
      ),
    evm: () =>
      buildDepositAndWithdrawAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, tokenAddress, recipients },
      ),
  });

export const resolveSwapAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<EnclaveTxAuthFields> => {
  if (isTronChain(chainId)) throw new Error("Swap is not supported on Tron");
  if (isSolanaChain(chainId)) {
    return buildSolanaSwapAuthFields(
      sessionId,
      requireSolanaProvider(wallet.solanaProvider),
      chainId,
      tokenAddresses,
      amounts,
    );
  }
  return buildSwapAuthFields(sessionId, requireEvmSigner(wallet.signer), {
    chainId,
    tokenAddresses,
    amounts,
  });
};
