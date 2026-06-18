import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { Modal } from "../Modal";
import { MainWalletView } from "./MainWalletView";
import { SocialLoginView } from "./SocialLoginView";
import { WalletModalHeader } from "./WalletModalHeader";
import { AuthModeToggle } from "./AuthModeToggle";
import { WalletModalView } from "./types";
import { useChooseWalletConnections } from "./useChooseWalletConnections";

interface ChooseWalletProps {
  isOpen: boolean;
  onHide: () => void;
  setShieldedAddress: Dispatch<SetStateAction<string | undefined>>;
  setIsConnecting?: Dispatch<SetStateAction<boolean>>;
}

export const ChooseWallet = ({
  isOpen,
  onHide,
  setShieldedAddress,
  setIsConnecting,
}: ChooseWalletProps) => {
  const { clientState: turnkeyClientState } = useTurnkey();
  const [useEIP712Enabled, setUseEIP712Enabled] = useState(false);
  const [view, setView] = useState<WalletModalView>(WalletModalView.Main);

  const {
    connectors,
    connectingId,
    privyReady,
    dynamicReady,
    handleSelectConnector,
    handleConnectPrivy,
    handleConnectTurnkey,
    handleConnectDynamic,
    handleConnectDfns,
    handleConnectSolana,
    handleConnectTronLink,
  } = useChooseWalletConnections({
    onHide,
    setShieldedAddress,
    setIsConnecting,
    useEIP712Enabled,
  });

  useEffect(() => {
    if (isOpen) setView(WalletModalView.Main);
  }, [isOpen]);

  const connecting = useMemo(() => !!connectingId, [connectingId]);

  return (
    <Modal
      xBtn
      xBtnAction={onHide}
      isOpen={isOpen}
      styleProps="md:w-[30%] md:ml-[5%] !bg-hinkal-blue-300 rounded-[10px]"
      stylePropsBg="bg-[#000000cc]"
      xBtnStyleProps="text-white font-black"
    >
      <WalletModalHeader
        view={view}
        connecting={connecting}
        onBack={() => setView(WalletModalView.Main)}
      />
      <AuthModeToggle
        useEIP712Enabled={useEIP712Enabled}
        onToggle={() => setUseEIP712Enabled((prev) => !prev)}
      />
      {view === WalletModalView.Social && turnkeyClientState ? (
        <SocialLoginView
          connectingId={connectingId}
          privyReady={privyReady}
          dynamicReady={dynamicReady}
          turnkeyClientState={turnkeyClientState}
          onConnectPrivy={handleConnectPrivy}
          onConnectTurnkey={handleConnectTurnkey}
          onConnectDynamic={handleConnectDynamic}
          onConnectDfns={handleConnectDfns}
        />
      ) : (
        <MainWalletView
          connectors={connectors}
          connectingId={connectingId}
          onOpenSocial={() => setView(WalletModalView.Social)}
          onSelectConnector={handleSelectConnector}
          onConnectTronLink={handleConnectTronLink}
          onConnectSolana={handleConnectSolana}
        />
      )}
    </Modal>
  );
};
