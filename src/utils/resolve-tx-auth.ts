import { requireEvmSigner } from "./ethers-wallet";
import {
  buildDepositAndWithdrawAuthFields,
  buildDepositAuthFields,
  buildDepositForOtherAuthFields,
  buildReceiveVaultRecoverAuthFields,
  buildSwapAuthFields,
  buildTransferAuthFields,
  buildWithdrawAuthFields,
  buildWithdrawStuckUtxosAuthFields,
} from "./enclave-auth";
import type { Recipient } from "./multiSend";
import {
  buildSolanaDepositAuthFields,
  buildSolanaDepositForOtherAuthFields,
  buildSolanaPrivateSendAuthFields,
  buildSolanaSwapAuthFields,
  buildSolanaTransferAuthFields,
  buildSolanaWithdrawAuthFields,
  buildSolanaWithdrawStuckUtxosAuthFields,
} from "./solana-auth";
import {
  buildTronDepositAuthFields,
  buildTronDepositForOtherAuthFields,
  buildTronPrivateSendAuthFields,
  buildTronReceiveVaultRecoverAuthFields,
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

export const resolveDepositForOtherAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipient: string,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaDepositForOtherAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddresses,
        amounts,
        recipient,
      ),
    tron: () =>
      buildTronDepositForOtherAuthFields(sessionId, chainId, tokenAddresses, amounts, recipient),
    evm: () =>
      buildDepositForOtherAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        tokenAddresses,
        amounts,
        recipient,
      }),
  });

export const resolveTransferAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeAmount?: string,
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
        feeAmount,
      ),
    tron: () =>
      buildTronTransferAuthFields(
        sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
        feeToken,
        feeAmount,
      ),
    evm: () =>
      buildTransferAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        tokenAddresses,
        amounts,
        recipient: recipientAddress,
        feeToken,
        feeAmount,
      }),
  });

export const resolveWithdrawAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeAmount?: string,
  ref?: string,
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
        feeAmount,
        ref,
      ),
    tron: () =>
      buildTronWithdrawAuthFields(
        sessionId,
        chainId,
        tokenAddresses,
        amounts,
        recipientAddress,
        feeToken,
        feeAmount,
        ref,
      ),
    evm: () =>
      buildWithdrawAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        tokenAddresses,
        amounts,
        recipient: recipientAddress,
        feeToken,
        feeAmount,
        ref,
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
  feeToken?: string,
  txCompletionTime?: number,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaPrivateSendAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        tokenAddress,
        recipients,
        feeToken,
        txCompletionTime,
      ),
    tron: () =>
      buildTronPrivateSendAuthFields(
        sessionId,
        chainId,
        tokenAddress,
        recipients,
        feeToken,
        txCompletionTime,
      ),
    evm: () =>
      buildDepositAndWithdrawAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, tokenAddress, recipients, feeToken, txCompletionTime },
      ),
  });

export const resolveSwapAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  externalActionId: string,
  swapData: string,
  feeToken?: string,
  feeAmount?: string,
): Promise<EnclaveTxAuthFields> => {
  if (isTronChain(chainId)) throw new Error("Swap is not supported on Tron");
  if (isSolanaChain(chainId)) {
    return buildSolanaSwapAuthFields(
      sessionId,
      requireSolanaProvider(wallet.solanaProvider),
      chainId,
      tokenAddresses,
      amounts,
      externalActionId,
      swapData,
      feeAmount,
    );
  }
  return buildSwapAuthFields(sessionId, requireEvmSigner(wallet.signer), {
    chainId,
    tokenAddresses,
    amounts,
    externalActionId,
    swapData,
    feeToken,
    feeAmount,
  });
};

export const resolveReceiveVaultRecoverAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  vaultAddress: string,
  tokenAddress: string,
  recipientAddress: string,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () => {
      throw new Error("Receive addresses are not available on Solana");
    },
    tron: () =>
      buildTronReceiveVaultRecoverAuthFields(
        sessionId,
        chainId,
        vaultAddress,
        tokenAddress,
        recipientAddress,
      ),
    evm: () =>
      buildReceiveVaultRecoverAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, vaultAddress, tokenAddress, recipientAddress },
      ),
  });
