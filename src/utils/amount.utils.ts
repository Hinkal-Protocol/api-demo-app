import { ethers } from "ethers";
import { ERC20Token } from "../types";

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
  amount: bigint | string,
): string => ethers.formatUnits(amount, token.decimals);
