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

export const getPublicBalances = (
  tokens: ERC20Token[],
  walletAddress: string,
  chainId: number,
  walletType: WalletType
): Promise<PublicBalance[]> =>
  Promise.all(
    tokens.map(async (token) => ({
      token,
      balance: await getTokenWalletBalance(
        token,
        walletAddress,
        chainId,
        walletType
      ).catch(() => 0n),
    }))
  );
