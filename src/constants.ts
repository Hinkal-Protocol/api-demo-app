import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";

// social media platform URLs
export const mediaUrls = {
  AIPRISE: "https://aiprise.com/",
  POLY_SCAN: "https://polygonscan.com/",
  SEPOLIA_SCAN: "https://sepolia.etherscan.io/",
};

export const zeroAddress = `0x${"00".repeat(20)}`;

export const PRIVY_APP_ID = "cmpzcz5re00et0cjmajy6q25y";

const TURNKEY_ORGANIZATION_ID = "bcf49c16-5d81-4ab7-938c-5673526cf69f";
const TURNKEY_AUTH_PROXY_CONFIG_ID = "bcf49c16-5d81-4ab7-938c-5673526cf69f";

export const turnkeyConfig: TurnkeyProviderConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: TURNKEY_ORGANIZATION_ID,
  authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID,
};
