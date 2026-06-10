import { ClientState } from "@turnkey/react-wallet-kit";
import type { ChooseWalletConnections } from "./useChooseWalletConnections";
import { WalletOptionButton } from "./WalletOptionButton";

interface SocialLoginViewProps {
  connectingId: string | null;
  privyReady: boolean;
  dynamicReady: boolean;
  turnkeyClientState: ClientState;
  onConnectPrivy: ChooseWalletConnections["handleConnectPrivy"];
  onConnectTurnkey: ChooseWalletConnections["handleConnectTurnkey"];
  onConnectDynamic: ChooseWalletConnections["handleConnectDynamic"];
}

export const SocialLoginView = ({
  connectingId,
  privyReady,
  dynamicReady,
  turnkeyClientState,
  onConnectPrivy,
  onConnectTurnkey,
  onConnectDynamic,
}: SocialLoginViewProps) => (
  <div className="p-5 pb-10 flex flex-col items-center gap-y-5">
    <p className="text-hinkal-gray-100 text-sm text-center w-[80%]">
      Sign in with email.
    </p>
    <WalletOptionButton
      variant="social"
      label="Continue with Privy"
      disabled={!!connectingId || !privyReady}
      loading={connectingId?.startsWith("privy") ?? false}
      onClick={onConnectPrivy}
    />
    <WalletOptionButton
      variant="social"
      label="Continue with Turnkey"
      disabled={!!connectingId || turnkeyClientState === ClientState.Loading}
      loading={connectingId?.startsWith("turnkey") ?? false}
      onClick={onConnectTurnkey}
    />
    <WalletOptionButton
      variant="social"
      label="Continue with Dynamic"
      disabled={!!connectingId || !dynamicReady}
      loading={connectingId?.startsWith("dynamic") ?? false}
      onClick={onConnectDynamic}
    />
  </div>
);
