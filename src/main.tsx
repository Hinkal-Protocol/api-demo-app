import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { TurnkeyProvider } from "@turnkey/react-wallet-kit";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { WagmiProvider } from "wagmi";
import { OpenfortProvider } from "@openfort/react";
import App from "./App";
import { wagmiConfig } from "./wagmi.config";
import { AppContextProvider } from "./AppContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SUPPORTED_CHAINS } from "./constants/supported-chain-ids.constants";
import {
  dfnsConfig,
  isWalletConfigured,
  OPENFORT_PUBLISHABLE_KEY,
  PRIVY_APP_ID,
  turnkeyConfig,
} from "./constants";
import { dynamicSettings } from "./constants/dynamic.config";
import {
  openfortWalletConfig,
  openfortUiConfig,
} from "./constants/openfort.config";
import turnkeyStyles from "@turnkey/react-wallet-kit/styles.css?raw";

const style = document.createElement("style");
style.textContent = turnkeyStyles;
document.head.appendChild(style);

const queryClient = new QueryClient();

const app = !isWalletConfigured.openfort() ? (
  <App />
) : (
  <OpenfortProvider
    publishableKey={OPENFORT_PUBLISHABLE_KEY}
    walletConfig={openfortWalletConfig}
    uiConfig={openfortUiConfig}
  >
    <App />
  </OpenfortProvider>
);

const inner = (
  <TurnkeyProvider config={turnkeyConfig}>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AppContextProvider>{app}</AppContextProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </TurnkeyProvider>
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <GoogleOAuthProvider clientId={dfnsConfig.googleClientId}>
    <DynamicContextProvider
      settings={{
        ...dynamicSettings,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {!isWalletConfigured.privy() ? (
        inner
      ) : (
        <PrivyProvider
          appId={PRIVY_APP_ID}
          config={{
            loginMethods: ["email"],
            supportedChains: [...SUPPORTED_CHAINS],
            embeddedWallets: {
              ethereum: { createOnLogin: "off" },

              showWalletUIs: true,
            },
          }}
        >
          {inner}
        </PrivyProvider>
      )}
    </DynamicContextProvider>
  </GoogleOAuthProvider>,
);
