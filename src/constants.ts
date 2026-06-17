import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";

// social media platform URLs
export const mediaUrls = {
  AIPRISE: "https://aiprise.com/",
  POLY_SCAN: "https://polygonscan.com/",
  SEPOLIA_SCAN: "https://sepolia.etherscan.io/",
};

export const zeroAddress = `0x${"00".repeat(20)}`;

export const PRIVY_APP_ID = "cmpzcz5re00et0cjmajy6q25y";

// Fall back to "" when an env key is missing so providers still mount and the
// app renders; each connect handler then checks its key and shows a toast.
export const DYNAMIC_ENVIRONMENT_ID =
  import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID || "";

export const dfnsConfig = {
  apiUrl: "https://api.dfns.io",
  orgId: import.meta.env.VITE_DFNS_ORG_ID || "",
  googleClientId: import.meta.env.VITE_DFNS_GOOGLE_OAUTH_CLIENT_ID || "",
  relyingParty: {
    id: import.meta.env.VITE_DFNS_RP_ID || "",
    name: import.meta.env.VITE_DFNS_RP_NAME || "",
  },
};

export const turnkeyConfig: TurnkeyProviderConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: import.meta.env.VITE_TURNKEY_ORGANIZATION_ID || "",
  authProxyConfigId: import.meta.env.VITE_TURNKEY_AUTH_PROXY_CONFIG_ID || "",
};

// True when every env key a wallet needs is present.
export const isWalletConfigured = {
  dynamic: () => !!DYNAMIC_ENVIRONMENT_ID,
  turnkey: () =>
    !!turnkeyConfig.organizationId && !!turnkeyConfig.authProxyConfigId,
  dfns: () => !!dfnsConfig.orgId && !!dfnsConfig.googleClientId,
};
