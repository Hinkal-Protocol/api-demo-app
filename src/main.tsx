import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import App from "./App";
import { wagmiConfig } from "./wagmi.config";
import { AppContextProvider } from "./AppContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SUPPORTED_CHAINS } from "./constants/supported-chain-ids.constants";
import { PRIVY_APP_ID } from "./constants";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        supportedChains: [...SUPPORTED_CHAINS],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <AppContextProvider>
            <App />
          </AppContextProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </React.StrictMode>,
);
