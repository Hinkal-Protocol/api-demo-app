import type { Connector } from "wagmi";
import coinbaseLogo from "../../assets/coinbaseWalletLogo.png";
import metamaskLogo from "../../assets/metamaskWalletLogo.png";
import walletconnectLogo from "../../assets/walletconnectWalletLogo.png";
import { WalletOptionButton } from "./WalletOptionButton";
import { useMemo } from "react";

const CONNECTOR_LOGOS: Record<string, string> = {
  "Coinbase Wallet": coinbaseLogo,
  MetaMask: metamaskLogo,
  WalletConnect: walletconnectLogo,
};

interface WagmiConnectorButtonProps {
  connector: Connector;
  disabled: boolean;
  loading: boolean;
  onSelect: (connector: Connector) => void;
}

export const WagmiConnectorButton = ({
  connector,
  disabled,
  loading,
  onSelect,
}: WagmiConnectorButtonProps) => {
  const logoSrc = useMemo(
    () =>
      CONNECTOR_LOGOS[connector.name] ?? (connector.icon as string | undefined),
    [connector.name, connector.icon],
  );

  return (
    <WalletOptionButton
      label={connector.name}
      disabled={disabled}
      loading={loading}
      onClick={() => onSelect(connector)}
      icon={
        logoSrc ? (
          <img
            src={logoSrc}
            alt={`${connector.name} logo`}
            className="w-[26px] h-[26px]"
          />
        ) : undefined
      }
    />
  );
};
