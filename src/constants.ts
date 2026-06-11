import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";

// social media platform URLs
export const mediaUrls = {
  AIPRISE: "https://aiprise.com/",
  POLY_SCAN: "https://polygonscan.com/",
  SEPOLIA_SCAN: "https://sepolia.etherscan.io/",
};

export const zeroAddress = `0x${"00".repeat(20)}`;

export const PRIVY_APP_ID = "cmpzcz5re00et0cjmajy6q25y";

export const DYNAMIC_ENVIRONMENT_ID = import.meta.env
  .VITE_DYNAMIC_ENVIRONMENT_ID;

export const dfnsConfig = {
  apiUrl: import.meta.env.VITE_DFNS_API_URL,
  orgId: import.meta.env.VITE_DFNS_ORG_ID,
  googleClientId: import.meta.env.VITE_DFNS_GOOGLE_OAUTH_CLIENT_ID,
  relyingParty: {
    id: import.meta.env.VITE_DFNS_RP_ID,
    name: import.meta.env.VITE_DFNS_RP_NAME,
  },
};

const TURNKEY_ORGANIZATION_ID = import.meta.env.VITE_TURNKEY_ORGANIZATION_ID;
const TURNKEY_AUTH_PROXY_CONFIG_ID = import.meta.env
  .VITE_TURNKEY_AUTH_PROXY_CONFIG_ID;

export const turnkeyConfig: TurnkeyProviderConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: TURNKEY_ORGANIZATION_ID,
  authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID,
};
