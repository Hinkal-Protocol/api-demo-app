import { useState } from "react";
import HinkalLogoSvg from "../../assets/hinkal-logo.svg";
import { ChooseWallet } from "../ChooseWallet/ChooseWallet";
import { HinkalInfo } from "./HinkalInfo";
import { Spinner } from "../Spinner";
import { useAppContext } from "../../AppContext";
import { SVGIconType } from "../../types";

const HinkalLogo = HinkalLogoSvg as unknown as SVGIconType;

export const Header = () => {
  // local states
  const [chooseWalletShown, setChooseWalletShown] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const { walletAddress } = useAppContext();

  return (
    <header className="md:bg-hinkal-blue-200 pt-4 md:pt-0 pb-4 relative z-20">
      <ChooseWallet
        isOpen={chooseWalletShown}
        onHide={() => setChooseWalletShown(false)}
        setShieldedAddress={() => {}}
        setIsConnecting={setIsConnecting}
      />
      <div
        className={`flex ${
          walletAddress ? "flex-col" : ""
        } md:flex-row items-center justify-between w-[87%] md:w-[81.5%] mx-auto pt-[1%] relative md:static`}
      >
        <HinkalLogo className="text-hinkal-white-200 shrink-0 cursor-pointer transition-opacity duration-300 hover:opacity-80" />
        {walletAddress ? (
          <HinkalInfo shieldedAddress={walletAddress} />
        ) : (
          <button
            type="button"
            onClick={() => setChooseWalletShown(true)}
            disabled={isConnecting}
            className="text-white font-[700] md:font-[500] text-[16px] rounded-[12px] px-4 py-3 border-[2px] bg-primary md:bg-transparent border-primary font-generalSans flex items-center justify-center gap-2 w-[160px] h-12 transition-all duration-300 hover:bg-hinkal-purple-200 hover:border-hinkal-purple-200"
          >
            {isConnecting ? <Spinner /> : "Connect"}
          </button>
        )}
      </div>
    </header>
  );
};
