import { isMobile } from "react-device-detect";
import type { Connector } from "wagmi";

export const isVisibleWagmiConnector = (connector: Connector) =>
  isMobile
    ? connector.name === "WalletConnect"
    : connector.name !== "Hinkal" &&
      !connector.id.startsWith("io.privy.wallet");
