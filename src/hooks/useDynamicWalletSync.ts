import { useEffect } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { setActiveDynamicWallet } from "../utils/ethers-wallet";

/**
 * useDynamicContext() can't be called inside getEthersSigner (plain util, not a component).
 * This bridges the gap — keeps activeDynamicWallet in sync so getEthersSigner can reach it.
 */
export const useDynamicWalletSync = () => {
  const { primaryWallet } = useDynamicContext();

  useEffect(() => {
    console.log("primaryWallet", primaryWallet);
    setActiveDynamicWallet(primaryWallet ?? null);
  }, [primaryWallet]);
};
