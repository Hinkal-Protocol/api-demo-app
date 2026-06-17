import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { TronWeb } from "tronweb";

const REJECT_URLS = [
  "http://",
  "https://",
  "/payment/",
  ".app/",
  ".com/",
  ".netlify.",
];

export const isValidPrivateAddress = (address: string): boolean => {
  const looksLikeUrl = REJECT_URLS.some((url) => address.includes(url));
  if (looksLikeUrl) return false;

  const [stealthAddress, H00, H01, H11, encryptionKey] = address.split(",");

  const missingVariable =
    !stealthAddress || !encryptionKey || !H00 || !H01 || !H11;
  const incorrectAddressFormat =
    stealthAddress?.substring(0, 2) !== "0x" ||
    encryptionKey?.substring(0, 2) !== "0x";
  const incorrectLength =
    encryptionKey?.length !== 66 ||
    stealthAddress?.length > 66 ||
    stealthAddress?.length < 64;
  const incorrectSymbols = address.includes('"');

  return !(missingVariable || incorrectAddressFormat || incorrectLength || incorrectSymbols);
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
  isPrivate: boolean = false,
): boolean => {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (isPrivate) return isValidPrivateAddress(trimmed);
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
    return isPrivate
      ? "Invalid private address"
      : "Invalid address. Use a Solana address";
  }
  if (isTron) {
    return isPrivate
      ? "Invalid private address"
      : "Invalid address. Use a Tron address";
  }
  return isPrivate
    ? "Invalid private address"
    : "Invalid address. Use an EVM address";
};
