import type { ComponentProps } from "react";
import {
  OpenfortProvider,
  AccountTypeEnum,
  RecoveryMethod,
  AuthProvider as OpenfortAuthProvider,
} from "@openfort/react";
import { SUPPORTED_CHAINS } from "./supported-chain-ids.constants";
import { networkRegistry } from "./chain.constants";
import { OPENFORT_SHIELD_PUBLISHABLE_KEY } from "../constants";

type OpenfortProviderProps = ComponentProps<typeof OpenfortProvider>;

const openfortRpcUrls = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [
    c.id,
    networkRegistry[c.id]?.fetchRpcUrl,
  ]).filter(([, url]) => !!url),
);

export const openfortWalletConfig: OpenfortProviderProps["walletConfig"] = {
  shieldPublishableKey: OPENFORT_SHIELD_PUBLISHABLE_KEY,
  ethereum: {
    chainId: SUPPORTED_CHAINS[0].id,
    rpcUrls: openfortRpcUrls,
    accountType: AccountTypeEnum.EOA,
  },
};

export const openfortUiConfig: OpenfortProviderProps["uiConfig"] = {
  authProviders: [OpenfortAuthProvider.EMAIL_OTP],
  walletRecovery: {
    allowedMethods: [RecoveryMethod.PASSWORD],
    defaultMethod: RecoveryMethod.PASSWORD,
  },
  bufferPolyfill: true,
  // Theme Openfort's auth modal to the app's wallet-picker palette.
  mode: "dark",
  customTheme: {
    "--ck-font-family": "inherit",
    "--ck-border-radius": "8px",
    "--ck-primary-button-border-radius": "8px",
    "--ck-primary-button-color": "#ffffff",
    "--ck-primary-button-background": "#2C2F3F",
    "--ck-body-background": "#141427",
    "--ck-body-color": "#ffffff",
    "--ck-overlay-background": "#000000cc",
  },
};
