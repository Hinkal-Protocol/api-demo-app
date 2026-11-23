import { requireEvmSigner } from "./ethers-wallet";
import {
  buildDepositAndWithdrawAuthFields,
  buildDepositAuthFields,
  buildDepositForOtherAuthFields,
  buildTransferAddressAuthFields,
  buildSwapAuthFields,
  buildTransferAuthFields,
  buildWithdrawAuthFields,
  buildRecoverStuckBalanceAuthFields,
} from "./enclave-auth";
import type { Recipient } from "./multiSend";
import {
  buildSolanaDepositAuthFields,
  buildSolanaDepositForOtherAuthFields,
  buildSolanaPrivateSendAuthFields,
  buildSolanaTransferAddressAuthFields,
  buildSolanaSwapAuthFields,
  buildSolanaTransferAuthFields,
  buildSolanaWithdrawAuthFields,
  buildSolanaRecoverStuckBalanceAuthFields,
} from "./solana-auth";
import {
  buildTronDepositAuthFields,
  buildTronDepositForOtherAuthFields,
  buildTronPrivateSendAuthFields,
  buildTronTransferAddressAuthFields,
  buildTronTransferAuthFields,
  buildTronWithdrawAuthFields,
  buildTronRecoverStuckBalanceAuthFields,
} from "./tron-auth";
import { isTronChain } from "./tron-wallet";
import type { TransferBridgeParams, EnclaveTxAuthFields, RecoverStuckBalanceParams, TxWallet } from "./types";
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

export const resolveRecoverStuckBalanceAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  params: RecoverStuckBalanceParams,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaRecoverStuckBalanceAuthFields(sessionId, requireSolanaProvider(wallet.solanaProvider), chainId, params),
    tron: () => buildTronRecoverStuckBalanceAuthFields(sessionId, chainId, params),
    evm: () => buildRecoverStuckBalanceAuthFields(sessionId, requireEvmSigner(wallet.signer), chainId, params),
  });

export const resolvePrivateSendAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  feeToken?: string,
  txCompletionTime?: number,
  ref?: string,
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
        ref,
      ),
    tron: () =>
      buildTronPrivateSendAuthFields(
        sessionId,
        chainId,
        tokenAddress,
        recipients,
        feeToken,
        txCompletionTime,
        ref,
      ),
    evm: () =>
      buildDepositAndWithdrawAuthFields(
        sessionId,
        requireEvmSigner(wallet.signer),
        { chainId, tokenAddress, recipients, feeToken, txCompletionTime, ref },
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

export const resolveTransferAddressAuth = (
  wallet: TxWallet,
  sessionId: string,
  chainId: number,
  recipientAddress: string,
  bridge?: TransferBridgeParams,
): Promise<EnclaveTxAuthFields> =>
  resolveByChain(chainId, {
    solana: () =>
      buildSolanaTransferAddressAuthFields(
        sessionId,
        requireSolanaProvider(wallet.solanaProvider),
        chainId,
        recipientAddress,
        bridge,
      ),
    tron: () => buildTronTransferAddressAuthFields(sessionId, chainId, recipientAddress, bridge),
    evm: () =>
      buildTransferAddressAuthFields(sessionId, requireEvmSigner(wallet.signer), {
        chainId,
        recipientAddress,
        bridge,
      }),
  });
