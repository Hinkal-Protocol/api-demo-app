import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { setActivePrivyWallet } from "../utils/ethers-wallet";

/**
 * useWallets() can't be called inside getEthersSigner (plain util, not a component).
 * This bridges the gap — keeps activePrivyWallet in sync so getEthersSigner can reach it.
 */
export const usePrivyWalletSync = () => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!authenticated) {
      setActivePrivyWallet(null);
      return;
    }
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    setActivePrivyWallet(embedded ?? null);
  }, [authenticated, wallets]);
};
