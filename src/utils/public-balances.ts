import { zeroAddress } from "../constants";
import { ERC20Token, WalletType } from "../types";
import {
  getErc20Balance,
  getEvmBalancesMulticall,
  getNativeBalance,
} from "./ethers-wallet";
import { getTronErc20Balance, getTronNativeBalance } from "./tron-wallet";
import { getSolanaBalances } from "./solana-wallet";

export interface PublicBalance {
  token: ERC20Token;
  balance: bigint;
}

const getTokenWalletBalance = (
  token: ERC20Token,
  walletAddress: string,
  chainId: number,
  walletType: WalletType,
): Promise<bigint> => {
  const address = token.erc20TokenAddress;

  if (walletType === WalletType.Tron) {
    return address.toLowerCase() === zeroAddress
      ? getTronNativeBalance(walletAddress)
      : getTronErc20Balance(address, walletAddress);
  }

  return address.toLowerCase() === zeroAddress
    ? getNativeBalance(chainId, walletAddress)
    : getErc20Balance(chainId, address, walletAddress);
};

// Public RPCs rate-limit bursts; token lists run to hundreds of entries.
const MAX_CONCURRENT_BALANCE_REQUESTS = 10;

export const getPublicBalances = async (
  tokens: ERC20Token[],
  walletAddress: string,
  chainId: number,
  walletType: WalletType,
): Promise<PublicBalance[]> => {
  if (walletType === WalletType.Solana) {
    const balances = await getSolanaBalances(walletAddress, tokens);
    return tokens.map((token, i) => ({ token, balance: balances[i] }));
  }
  if (walletType === WalletType.Evm) {
    const balances = await getEvmBalancesMulticall(
      chainId,
      tokens.map((token) => token.erc20TokenAddress),
      walletAddress,
    );
    if (balances) {
      return tokens.map((token, i) => ({ token, balance: balances[i] }));
    }
  }

  const results: PublicBalance[] = new Array(tokens.length);
  let next = 0;
  const worker = async () => {
    while (next < tokens.length) {
      const index = next++;
      const token = tokens[index];
      results[index] = {
        token,
        balance: await getTokenWalletBalance(
          token,
          walletAddress,
          chainId,
          walletType,
        ),
      };
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_BALANCE_REQUESTS, tokens.length) },
      worker,
    ),
  );
  return results;
};
