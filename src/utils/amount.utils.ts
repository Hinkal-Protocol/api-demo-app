import { ethers } from "ethers";
import { ERC20Token, TokenBalance } from "../types";

export const getAmountInWei = (token: ERC20Token, amount: string): bigint => {
  const decimalsToRemove = 10 ** (18 - token.decimals);
  try {
    return ethers.parseUnits(amount) / BigInt(decimalsToRemove);
  } catch (err) {
    throw new Error("Number of decimals exceed maximum");
  }
};

export const getAmountInToken = (
  token: ERC20Token,
  amount: bigint | string
): string => ethers.formatUnits(amount, token.decimals);

export const getTokenBalanceDisplay = (
  balances: TokenBalance[],
  token: ERC20Token
): string | null => {
  const bal = balances.find(
    (b) =>
      b.tokenAddress.toLowerCase() === token.erc20TokenAddress.toLowerCase()
  );
  if (!bal) return null;
  return `${Number(getAmountInToken(token, bal.balance)).toFixed(4)} ${
    token.symbol
  }`;
};
