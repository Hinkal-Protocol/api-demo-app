import { useState, useMemo } from "react";
import { ClientState } from "@turnkey/react-wallet-kit";
import toast from "react-hot-toast";
import type { ChooseWalletConnections } from "./useChooseWalletConnections";
import { WalletOptionButton } from "./WalletOptionButton";
import { DfnsGoogleOverlay } from "./DfnsGoogleOverlay";
import { isWalletConfigured } from "../../constants";

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
        name: "Privy",
        disabled:
          !!connectingId || (isWalletConfigured.privy() && !privyReady),
        configured: isWalletConfigured.privy(),
        onClick: onConnectPrivy,
      },
      {
        id: "turnkey",
        name: "Turnkey",
        disabled:
          !!connectingId ||
          (isWalletConfigured.turnkey() &&
            turnkeyClientState === ClientState.Loading),
        configured: isWalletConfigured.turnkey(),
        onClick: onConnectTurnkey,
      },
      {
        id: "dynamic",
        name: "Dynamic",
        disabled:
          !!connectingId || (isWalletConfigured.dynamic() && !dynamicReady),
        configured: isWalletConfigured.dynamic(),
        onClick: onConnectDynamic,
      },
      {
        id: "dfns",
        name: "DFNS",
        disabled: !!connectingId,
        configured: isWalletConfigured.dfns(),
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
      {socialProviders.map(({ id, name, disabled, configured, onClick }) => (
        <WalletOptionButton
          key={id}
          variant="social"
          label={`Continue with ${name}`}
          disabled={disabled}
          loading={connectingId?.startsWith(id) ?? false}
          onClick={
            configured
              ? onClick
              : () =>
                  toast.error(
                    `${name} is not configured — missing API keys in .env`,
                  )
          }
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
