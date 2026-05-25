import toast from "react-hot-toast";
import { useConfig } from "wagmi";
import { disconnect } from "wagmi/actions";
import Copy from "../../assets/Copy.svg";
import Disconnect from "../../assets/Disconnect.svg";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { WalletInfoBalance } from "./WalletInfoBalance";
import { useAppContext } from "../../AppContext";
import { TokenBalance } from "../../types";
import { zeroAddress } from "../../constants";

const filterTokenBalances = (tokenBalances: TokenBalance[]) => {
  const nonZeroBalances = [...tokenBalances]
    .sort((a, b) => (a.tokenAddress < b.tokenAddress ? -1 : 1))
    .filter((tokenBalance) => tokenBalance.balance !== "0");
  if (nonZeroBalances.length === 0)
    return tokenBalances.filter(
      (tokenBalance) => tokenBalance.tokenAddress === zeroAddress,
    );
  return nonZeroBalances;
};

export const WalletInfoDropDown = () => {
  const {
    balances,
    walletAddress,
    setWalletAddress,
    clearEnclaveSession,
    setChainId,
    setDataLoaded,
    setRequestedWriteAccess,
  } = useAppContext();
  const config = useConfig();

  const handleDisconnect = async () => {
    try {
      await disconnect(config);
    } catch (err) {
      console.error("disconnect failed", err);
    }
    setWalletAddress(null);
    clearEnclaveSession();
    setRequestedWriteAccess(false);
    setDataLoaded(false);
    setChainId(undefined as any);
  };

  const handleCopyShieldedAddress = () => {
    try {
      if (!walletAddress) {
        toast.error("No wallet address found");
        return;
      }
      copyToClipboard(walletAddress);
      toast.success("Wallet address copied to clipboard");
    } catch (err: any) {
      toast.error(err?.message || "Failed to copy wallet address");
    }
  };

  return (
    <div className="absolute min-w-max top-20 md:top-2 left-0 md:left-auto right-0 bg-[#272B30] rounded-xl shadow-metamask font-pubsans p-4 items-center max-content">
      <div className="flex items-center space-x-4">
        <div className="w-[26px]" />
        <p className="text-[#abaeaf] text-[12px] text-left">Balance</p>
      </div>
      <div className="flex flex-col justify-center gap-4 mb-[10%]">
        {filterTokenBalances(balances).map((tokenBalance) => (
          <WalletInfoBalance
            tokenBalance={tokenBalance}
            key={tokenBalance.tokenAddress}
          />
        ))}
      </div>

      <div className="border-t-2 md:text-[15px] border-[#36393D]">
        <button type="button" onClick={handleCopyShieldedAddress}>
          <div className="flex items-center mt-2 text-white text-[14px] md:w-[9.5rem]">
            <div className="flex justify-center items-center w-[25px] h-[25px]">
              <Copy />
            </div>
            <div className="pl-2">Copy Address</div>
          </div>
        </button>
        <div>
          <button
            type="button"
            className="cursor-pointer"
            onClick={handleDisconnect}
          >
            <div className="flex flex-row items-center text-white text-[14px] mt-2 w-[9.5rem]">
              <div className="flex justify-center items-center w-[25px] h-[25px]">
                <Disconnect />
              </div>
              <div className="pl-2">Disconnect</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
