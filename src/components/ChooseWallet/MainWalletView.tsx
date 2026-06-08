import { isMobile } from "react-device-detect";
import type { Connector } from "wagmi";
import type { SolanaWalletProvider } from "../../utils/solana-wallet";
import { isVisibleWagmiConnector } from "../../utils/wagmiConnectors";
import metamaskLogo from "../../assets/metamaskWalletLogo.png";
import SolflareLogo from "../../assets/SolflareWalletLogo.jpeg";
import type { ChooseWalletConnections } from "./useChooseWalletConnections";
import { WalletOptionButton } from "./WalletOptionButton";
import { WagmiConnectorButton } from "./WagmiConnectorButton";

interface MainWalletViewProps {
  connectors: readonly Connector[];
  connectingId: string | null;
  onOpenSocial: () => void;
  onSelectConnector: ChooseWalletConnections["handleSelectConnector"];
  onConnectTronLink: ChooseWalletConnections["handleConnectTronLink"];
  onConnectSolana: ChooseWalletConnections["handleConnectSolana"];
}

export const MainWalletView = ({
  connectors,
  connectingId,
  onOpenSocial,
  onSelectConnector,
  onConnectTronLink,
  onConnectSolana,
}: MainWalletViewProps) => {
  const disabled = !!connectingId;
  const connectorIcon = (name: string) =>
    connectors.find((c) => c.name === name)?.icon;

  return (
    <div className="p-5 pb-10 flex flex-col items-center gap-y-5">
      <WalletOptionButton
        variant="social"
        label="Social Login"
        disabled={disabled}
        onClick={onOpenSocial}
      />

      {connectors.filter(isVisibleWagmiConnector).map((connector) => (
        <WagmiConnectorButton
          key={connector.id}
          connector={connector}
          disabled={disabled}
          loading={connectingId === connector.id}
          onSelect={onSelectConnector}
        />
      ))}

      {!isMobile && (
        <>
          <WalletOptionButton
            label="TronLink (Tron)"
            disabled={disabled}
            loading={connectingId === "tronlink"}
            onClick={onConnectTronLink}
            icon={
              connectorIcon("TronLink") ? (
                <img
                  src={connectorIcon("TronLink")}
                  alt="TronLink logo"
                  className="w-[26px] h-[26px]"
                />
              ) : undefined
            }
          />
          <WalletOptionButton
            label="Phantom (Solana)"
            disabled={disabled}
            loading={connectingId === "solana-phantom"}
            onClick={() =>
              onConnectSolana("phantom" satisfies SolanaWalletProvider)
            }
            icon={
              connectorIcon("Phantom") ? (
                <img
                  src={connectorIcon("Phantom")}
                  alt="Phantom logo"
                  className="w-[26px] h-[26px]"
                />
              ) : undefined
            }
          />
          <WalletOptionButton
            label="Solflare (Solana)"
            disabled={disabled}
            loading={connectingId === "solana-solflare"}
            onClick={() =>
              onConnectSolana("solflare" satisfies SolanaWalletProvider)
            }
            icon={
              <img
                src={SolflareLogo}
                alt="Solflare logo"
                className="w-[26px] h-[26px]"
              />
            }
          />
          <WalletOptionButton
            label="MetaMask (Solana)"
            disabled={disabled}
            loading={connectingId === "solana-metamask"}
            onClick={() =>
              onConnectSolana("metamask" satisfies SolanaWalletProvider)
            }
            icon={
              <img
                src={metamaskLogo}
                alt="MetaMask logo"
                className="w-[26px] h-[26px]"
              />
            }
          />
        </>
      )}
    </div>
  );
};
