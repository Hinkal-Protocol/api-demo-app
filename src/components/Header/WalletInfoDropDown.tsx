import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useConfig } from "wagmi";
import { disconnect } from "wagmi/actions";
import Copy from "../../assets/Copy.svg";
import Disconnect from "../../assets/Disconnect.svg";
import { Spinner } from "../Spinner";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { getEthersSigner } from "../../utils/ethers-wallet";
import { withdrawStuckUtxos } from "../../utils/withdraw";
import { WalletInfoBalance } from "./WalletInfoBalance";
import { useAppContext } from "../../AppContext";
import { TokenBalance } from "../../types";
import { zeroAddress } from "../../constants";

const sortTokenBalances = (tokenBalances: TokenBalance[]) =>
  [...tokenBalances].sort((a, b) =>
    a.tokenAddress < b.tokenAddress ? -1 : 1,
  );

const filterNonZeroTokenBalances = (tokenBalances: TokenBalance[]) =>
  tokenBalances.filter((b) => b.balance !== "0");

export const WalletInfoDropDown = () => {
  const {
    balances,
    stuckUtxoBalances,
    walletAddress,
    chainId,
    signature,
    nonce,
    hasWriteAccess,
    refreshBalances,
    setWalletAddress,
    clearEnclaveSession,
    setChainId,
    setDataLoaded,
    setRequestedWriteAccess,
  } = useAppContext();
  const config = useConfig();
  const visibleBalances = useMemo(
    () => sortTokenBalances(balances),
    [balances],
  );
  const visibleStuckUtxoBalances = useMemo(
    () => filterNonZeroTokenBalances(stuckUtxoBalances),
    [stuckUtxoBalances],
  );
  const [withdrawingStuckTokenAddress, setWithdrawingStuckTokenAddress] =
    useState<string | null>(null);

  const { isTron } = useAppContext();

  const handleDisconnect = async () => {
    if (!isTron) {
      try {
        await disconnect(config);
      } catch (err) {
        console.error("disconnect failed", err);
      }
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

  const handleWithdrawStuckUtxos = useCallback(
    async (tokenAddress: string) => {
      try {
        if (!walletAddress || !chainId || !signature || !nonce) return;

        setWithdrawingStuckTokenAddress(tokenAddress);
        const signer = isTron ? null : await getEthersSigner();
        const txHashes = await withdrawStuckUtxos(
          signer,
          { signature, nonce, hasWriteAccess },
          walletAddress,
          chainId,
          tokenAddress,
          walletAddress,
        );

        toast.success(`Withdraw sent (${txHashes.length} txs)`);
        await refreshBalances();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Withdraw stuck UTXOs failed";
        toast.error(message);
      } finally {
        setWithdrawingStuckTokenAddress(null);
      }
    },
    [walletAddress, chainId, signature, nonce, hasWriteAccess, refreshBalances],
  );

  return (
    <div className="absolute min-w-max top-20 md:top-2 left-0 md:left-auto right-0 bg-[#272B30] rounded-xl shadow-metamask font-pubsans p-4 items-center max-content">
      <div className="flex items-center space-x-4">
        <div className="w-[26px]" />
        <p className="text-[#abaeaf] text-[12px] text-left">Private Balance</p>
      </div>
      <div className="flex flex-col justify-center gap-4 mb-[10%]">
        {visibleBalances.length > 0 ? (
          visibleBalances.map((tokenBalance) => (
            <WalletInfoBalance
              tokenBalance={tokenBalance}
              key={tokenBalance.tokenAddress}
            />
          ))
        ) : (
          <p className="text-[#abaeaf] text-[13px]">No private balance</p>
        )}
      </div>

      {visibleStuckUtxoBalances.length > 0 && (
        <div className="border-t-2 border-[#36393D] pt-3 mb-[10%]">
          <p className="text-[#abaeaf] text-[12px] text-left mb-3">
            Stuck Balances
          </p>
          <div className="flex flex-col justify-center gap-4">
            {visibleStuckUtxoBalances.map((tokenBalance) => {
              const isWithdrawing =
                withdrawingStuckTokenAddress === tokenBalance.tokenAddress;

              return (
                <div
                  className="flex items-center justify-between gap-3"
                  key={`stuck-${tokenBalance.tokenAddress}`}
                >
                  <WalletInfoBalance tokenBalance={tokenBalance} />
                  <button
                    type="button"
                    disabled={withdrawingStuckTokenAddress !== null}
                    onClick={() =>
                      handleWithdrawStuckUtxos(tokenBalance.tokenAddress)
                    }
                    className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#4d32fa] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isWithdrawing ? (
                      <span className="flex items-center gap-x-1">
                        Withdraw <Spinner />
                      </span>
                    ) : (
                      "Withdraw"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
