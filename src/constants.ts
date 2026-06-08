import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";

// social media platform URLs
export const mediaUrls = {
  AIPRISE: "https://aiprise.com/",
  POLY_SCAN: "https://polygonscan.com/",
  SEPOLIA_SCAN: "https://sepolia.etherscan.io/",
};

export const zeroAddress = `0x${"00".repeat(20)}`;

export const PRIVY_APP_ID = "cmpzcz5re00et0cjmajy6q25y";

const TURNKEY_ORGANIZATION_ID = "424649e0-9ea1-4d7f-b1a4-901421688ac5";
const TURNKEY_AUTH_PROXY_CONFIG_ID = "61fcfb14-eeac-4360-b9cb-babfa9e900a4";

export const turnkeyConfig: TurnkeyProviderConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: TURNKEY_ORGANIZATION_ID,
  authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID,
};
