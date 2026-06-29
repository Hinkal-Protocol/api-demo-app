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

export const getTokenBalanceWei = (
  balances: TokenBalance[],
  token: ERC20Token
): bigint => {
  const bal = balances.find(
    (b) =>
      b.tokenAddress.toLowerCase() === token.erc20TokenAddress.toLowerCase()
  );
  return bal ? BigInt(bal.balance) : 0n;
};

export const getTokenBalanceDisplay = (
  balances: TokenBalance[],
  token: ERC20Token
): string | null => {
  const bal = balances.find(
    (b) =>
      b.tokenAddress.toLowerCase() === token.erc20TokenAddress.toLowerCase()
  );
  if (!bal) return null;
  const amount = Number(getAmountInToken(token, bal.balance));
  const formatted =
    amount === 0 ? "0" : amount < 0.0001 ? "<0.0001" : amount.toFixed(4);
  return `${formatted} ${token.symbol}`;
};
