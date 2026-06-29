import { NetworkDropdownItem } from "./NetworkDropdownItem";
import { useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import {
  switchActiveWalletChain,
  isUtilaSigner,
} from "../../../../utils/ethers-wallet";
import { useAppContext } from "../../../../AppContext";
import { SUPPORTED_CHAIN_IDS } from "../../../../constants/supported-chain-ids.constants";
import { networkRegistry } from "../../../../constants/chain.constants";

interface NetworkSettingsDropdownProps {
  close: () => void;
}

export const NetworkSettingsDropdown = ({
  close,
}: NetworkSettingsDropdownProps) => {
  const { setChainId } = useAppContext();

  const networkList = useMemo(
    () =>
      Object.values(networkRegistry).filter((network) =>
        SUPPORTED_CHAIN_IDS.includes(network.chainId),
      ),
    [],
  );

  const switchNetwork = useCallback(
    async (chainId: number) => {
      const network = networkList.find((net) => net.chainId === chainId);
      if (!network) return;
      try {
        await switchActiveWalletChain(network.chainId);
      } catch (err) {
        console.error("switchChain failed", err);
        return;
      }
      if (isUtilaSigner()) {
        toast("Check your Utila mobile app to approve", {
          id: "utila-approval",
          duration: 5000,
        });
      }
      setChainId(network.chainId);
      close();
    },
    [networkList, setChainId, close],
  );

  return (
    <div className="top-20 md:top-2 absolute text-white shadow-2xl border border-bgColor rounded-[12px] child:rounded-xl flex flex-col items-center gap-y-2 p-2 text-[16px] bg-modalBgColor font-generalSans font-medium left-0 md:left-auto right-0">
      {networkList.map(({ chainId, name }, index) => (
        <div key={chainId} className="w-full">
          <NetworkDropdownItem
            chainId={chainId}
            logoPath={""}
            networkName={name}
            onSelect={() => switchNetwork?.(chainId)}
          />
          {index !== networkList.length - 1 && (
            <div className="border-b-[1px] mt-1 border-hinkal-blue-900 mx-[0.6rem]" />
          )}
        </div>
      ))}
    </div>
  );
};
