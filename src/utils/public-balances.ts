import { zeroAddress } from "../constants";
import { ERC20Token } from "../types";
import type { WalletType } from "../AppContext";
import { getErc20Balance, getNativeBalance } from "./ethers-wallet";
import { getTronErc20Balance, getTronNativeBalance } from "./tron-wallet";
import {
  getSolanaNativeBalance,
  getSolanaTokenBalance,
  SOLANA_NATIVE_ADDRESS,
} from "./solana-wallet";

export interface PublicBalance {
  token: ERC20Token;
  balance: bigint;
}

const getTokenWalletBalance = (
  token: ERC20Token,
  walletAddress: string,
  chainId: number,
  walletType: WalletType
): Promise<bigint> => {
  const address = token.erc20TokenAddress;

  if (walletType === "tron") {
    return address.toLowerCase() === zeroAddress
      ? getTronNativeBalance(walletAddress)
      : getTronErc20Balance(address, walletAddress);
  }

  if (walletType === "solana") {
    return address === SOLANA_NATIVE_ADDRESS
      ? getSolanaNativeBalance(walletAddress)
      : getSolanaTokenBalance(address, walletAddress);
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
  walletType: WalletType
): Promise<PublicBalance[]> => {
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
          walletType
        ).catch(() => 0n),
      };
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_BALANCE_REQUESTS, tokens.length) },
      worker
    )
  );
  return results;
};
