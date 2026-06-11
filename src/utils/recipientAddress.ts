import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { TronWeb } from "tronweb";
import { SOLANA_NATIVE_ADDRESS } from "./solana-wallet";

const REJECT_URLS = ["http://", "https://", "/payment/", ".app/", ".com/", ".netlify."];

export const isValidPrivateAddress = (address: string): boolean => {
  const looksLikeUrl = REJECT_URLS.some((url) => address.includes(url));
  if (looksLikeUrl) return false;

  if (address.includes('"')) return false;

  const parts = address.split(",");
  if (parts.length !== 5) return false;

  const isNumericField = (value: string) =>
    /^0x[0-9a-fA-F]+$/.test(value) || /^[0-9]+$/.test(value);

  return parts.every((part) => isNumericField(part.trim()));
};

export const isValidSolanaPublicKey = (address: string): boolean => {
  try {
    const pubkey = new PublicKey(address);
    return pubkey.toBase58() === address;
  } catch {
    return false;
  }
};

export const isValidTronAddress = (address: string): boolean => {
  try {
    return TronWeb.isAddress(address);
  } catch {
    return false;
  }
};





export const isValidRecipientAddress = (
  address: string,
  isSolana: boolean,
  isTron: boolean,
): boolean => {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (isValidPrivateAddress(trimmed)) return true;
  if (isSolana) return isValidSolanaPublicKey(trimmed);
  if (isTron) return isValidTronAddress(trimmed);
  return ethers.isAddress(trimmed);
};

export const getRecipientAddressError = (
  isTron: boolean,
  isSolana: boolean,
  isPrivate: boolean,
): string => {
  if (isSolana) {
    return isPrivate ? "Invalid private address" : "Invalid address. Use a Solana address";
  }
  if (isTron) {
    return isPrivate ? "Invalid private address" : "Invalid address. Use a Tron address";
  }
  return isPrivate ? "Invalid private address" : "Invalid address. Use an EVM address";
};
