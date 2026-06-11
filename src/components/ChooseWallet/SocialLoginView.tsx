import { useState } from "react";
import { ClientState } from "@turnkey/react-wallet-kit";
import { GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";
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

  return (
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
      <WalletOptionButton
        variant="social"
        label="Continue with DFNS"
        disabled={!!connectingId}
        loading={connectingId?.startsWith("dfns") ?? false}
        onClick={() => setDfnsOpen(true)}
      />
      {dfnsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setDfnsOpen(false)}
        >
          <div
            className="bg-modal rounded-2xl p-6 flex flex-col items-center gap-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <GoogleLogin
              onSuccess={(res) => {
                setDfnsOpen(false);
                res.credential
                  ? onConnectDfns(res.credential)
                  : toast.error("Google sign-in returned no credential");
              }}
              onError={() => toast.error("Google sign-in failed")}
            />
          </div>
        </div>
      )}
    </div>
  );
};
