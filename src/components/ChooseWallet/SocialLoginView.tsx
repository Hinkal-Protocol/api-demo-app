import { useState, useMemo } from "react";
import { ClientState } from "@turnkey/react-wallet-kit";
import type { ChooseWalletConnections } from "./useChooseWalletConnections";
import { WalletOptionButton } from "./WalletOptionButton";
import { DfnsGoogleOverlay } from "./DfnsGoogleOverlay";

interface SocialLoginViewProps {
  connectingId: string | null;
  privyReady: boolean;
  dynamicReady: boolean;
  turnkeyClientState: ClientState;
  onConnectPrivy: ChooseWalletConnections["handleConnectPrivy"];
  onConnectTurnkey: ChooseWalletConnections["handleConnectTurnkey"];
  onConnectDynamic: ChooseWalletConnections["handleConnectDynamic"];
  onConnectDfns: ChooseWalletConnections["handleConnectDfns"];
}

export const SocialLoginView = ({
  connectingId,
  privyReady,
  dynamicReady,
  turnkeyClientState,
  onConnectPrivy,
  onConnectTurnkey,
  onConnectDynamic,
  onConnectDfns,
}: SocialLoginViewProps) => {
  const [dfnsOpen, setDfnsOpen] = useState(false);

  const socialProviders = useMemo(
    () => [
      {
        id: "privy",
        label: "Continue with Privy",
        disabled: !!connectingId || !privyReady,
        onClick: onConnectPrivy,
      },
      {
        id: "turnkey",
        label: "Continue with Turnkey",
        disabled: !!connectingId || turnkeyClientState === ClientState.Loading,
        onClick: onConnectTurnkey,
      },
      {
        id: "dynamic",
        label: "Continue with Dynamic",
        disabled: !!connectingId || !dynamicReady,
        onClick: onConnectDynamic,
      },
      {
        id: "dfns",
        label: "Continue with DFNS",
        disabled: !!connectingId,
        onClick: () => setDfnsOpen(true),
      },
    ],
    [
      connectingId,
      privyReady,
      turnkeyClientState,
      dynamicReady,
      onConnectPrivy,
      onConnectTurnkey,
      onConnectDynamic,
    ] as const,
  );

  return (
    <div className="p-5 pb-10 flex flex-col items-center gap-y-5">
      <p className="text-hinkal-gray-100 text-sm text-center w-[80%]">
        Sign in with email.
      </p>
      {socialProviders.map(({ id, label, disabled, onClick }) => (
        <WalletOptionButton
          key={id}
          variant="social"
          label={label}
          disabled={disabled}
          loading={connectingId?.startsWith(id) ?? false}
          onClick={onClick}
        />
      ))}
      {dfnsOpen && (
        <DfnsGoogleOverlay
          onClose={() => setDfnsOpen(false)}
          onConnect={onConnectDfns}
        />
      )}
    </div>
  );
};
