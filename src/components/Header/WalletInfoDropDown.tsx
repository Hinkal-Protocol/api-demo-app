import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useConfig } from "wagmi";
import { disconnect } from "wagmi/actions";
import { usePrivy } from "@privy-io/react-auth";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useSignOut } from "@openfort/react";
import Copy from "../../assets/Copy.svg";
import Disconnect from "../../assets/Disconnect.svg";
import { Spinner } from "../Spinner";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { getFriendlyErrorMessage } from "../../utils/errors";
import { fetchRecipientInfo } from "../../utils/recipientInfo";
import {
  getEthersSigner,
  requireEvmSigner,
  sendTx,
  setActiveDynamicWallet,
  setActivePrivyWallet,
  setActiveTurnkeyParams,
  setActiveDfnsWallet,
  setActiveOpenfort,
} from "../../utils/ethers-wallet";
import { withdrawStuckUtxos } from "../../utils/withdraw";
import { recoverReceiveVault } from "../../utils/receiveVault";
import type { TxData } from "../../utils/deposit";
import { broadcastRawTronTx } from "../../utils/tron-wallet";
import { getAmountInToken } from "../../utils/amount.utils";
import { WalletInfoBalance } from "./WalletInfoBalance";
import { useAppContext } from "../../AppContext";
import { ReceiveVaultBlockedFund, TokenBalance } from "../../types";

const filterNonZeroTokenBalances = (tokenBalances: TokenBalance[]) =>
  tokenBalances.filter((b) => b.balance !== "0");

const blockedFundKey = ({ record, token }: ReceiveVaultBlockedFund) =>
  `${record.vaultAddress}:${token.erc20TokenAddress}`.toLowerCase();

export const WalletInfoDropDown = () => {
  const {
    stuckUtxoBalances,
    receiveVaultBlockedFunds,
    refreshReceiveVaultAccount,
    walletAddress,
    chainId,
    sessionId,
    privateKey,
    authMode,
    refreshBalances,
    setWalletAddress,
    clearEnclaveSession,
    setChainId,
    setDataLoaded,
    setRequestedUseEIP712,
    isSolana,
    solanaProvider,
  } = useAppContext();
  const config = useConfig();
  const { authenticated, logout } = usePrivy();
  const { handleLogOut: dynamicLogout } = useDynamicContext();
  const { authState: turnkeyAuthState, logout: turnkeyLogout } = useTurnkey();
  const { signOut: openfortSignOut } = useSignOut();
  const visibleStuckUtxoBalances = useMemo(
    () => filterNonZeroTokenBalances(stuckUtxoBalances),
    [stuckUtxoBalances],
  );
  const [withdrawingStuckTokenAddress, setWithdrawingStuckTokenAddress] =
    useState<string | null>(null);
  const [recoveringBlockedFundKey, setRecoveringBlockedFundKey] = useState<
    string | null
  >(null);
  const [isCopyingPrivate, setIsCopyingPrivate] = useState(false);

  const { isTron } = useAppContext();

  const handleDisconnect = async () => {
    try {
      await disconnect(config);
    } catch (err) {
      console.error("disconnect failed", err);
    }

    if (authenticated) {
      try {
        await logout();
      } catch (err) {
        console.error("privy logout failed", err);
      }
    }
    if (turnkeyAuthState === AuthState.Authenticated) {
      try {
        await turnkeyLogout();
      } catch (err) {
        console.error("turnkey logout failed", err);
      }
    }
    try {
      await dynamicLogout();
    } catch (err) {
      console.error("dynamic logout failed", err);
    }
    try {
      await openfortSignOut();
    } catch (err) {
      console.error("openfort logout failed", err);
    }
    setActiveDfnsWallet(null);
    setActiveDynamicWallet(null);
    setActivePrivyWallet(null);
    setActiveTurnkeyParams(null);
    setActiveOpenfort(null);
    setWalletAddress(null);
    clearEnclaveSession();
    setRequestedUseEIP712(false);
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
      toast.error(
        getFriendlyErrorMessage(err, "Failed to copy wallet address"),
      );
    }
  };

  const handleCopyPrivateAddress = async () => {
    try {
      if (!walletAddress || !chainId || !sessionId || !privateKey) {
        toast.error("No active session found");
        return;
      }
      setIsCopyingPrivate(true);
      const recipientInfo = await fetchRecipientInfo({
        chainId,
        sessionId,
        privateKey,
      });
      copyToClipboard(recipientInfo);
      toast.success("Private address copied to clipboard");
    } catch (err: any) {
      toast.error(
        getFriendlyErrorMessage(err, "Failed to copy private address"),
      );
    } finally {
      setIsCopyingPrivate(false);
    }
  };

  const handleWithdrawStuckUtxos = useCallback(
    async (tokenAddress: string) => {
      try {
        if (!walletAddress || !chainId || !sessionId || !privateKey) return;

        setWithdrawingStuckTokenAddress(tokenAddress);
        const session = { sessionId, authMode, privateKey };
        const wallet = {
          signer: isTron || isSolana ? null : await getEthersSigner(),
          solanaProvider: isSolana ? solanaProvider : undefined,
        };
        const txHashes = await withdrawStuckUtxos(
          wallet,
          session,
          chainId,
          tokenAddress,
          walletAddress,
        );

        toast.success(`Withdraw sent (${txHashes.length} txs)`);
        await refreshBalances();
      } catch (err) {
        toast.error(
          getFriendlyErrorMessage(err, "Withdraw stuck UTXOs failed"),
        );
      } finally {
        setWithdrawingStuckTokenAddress(null);
      }
    },
    [walletAddress, chainId, sessionId, privateKey, authMode, refreshBalances, isSolana, isTron, solanaProvider],
  );

  const handleRecoverBlockedFund = useCallback(
    async (fund: ReceiveVaultBlockedFund) => {
      try {
        if (!walletAddress || !chainId || !sessionId || !privateKey) return;

        setRecoveringBlockedFundKey(blockedFundKey(fund));
        const session = { sessionId, authMode, privateKey };
        const wallet = {
          signer: isTron || isSolana ? null : await getEthersSigner(),
          solanaProvider: isSolana ? solanaProvider : undefined,
        };
        const txData = await recoverReceiveVault(
          wallet,
          session,
          fund.token.chainId,
          fund.record.vaultAddress,
          fund.token.erc20TokenAddress,
          walletAddress,
        );

        if (isTron) {
          await broadcastRawTronTx(txData);
        } else {
          const { to, data } = txData as TxData;
          await sendTx(requireEvmSigner(wallet.signer), { to, data });
        }

        toast.success("Funds sent");
        await refreshReceiveVaultAccount();
      } catch (err) {
        toast.error(
          getFriendlyErrorMessage(err, "Receive address recovery failed"),
        );
      } finally {
        setRecoveringBlockedFundKey(null);
      }
    },
    [
      walletAddress,
      chainId,
      sessionId,
      privateKey,
      authMode,
      isSolana,
      isTron,
      solanaProvider,
      refreshReceiveVaultAccount,
    ],
  );

  return (
    <div className="absolute top-20 md:top-2 right-0 left-auto w-60 max-w-[90vw] bg-hinkal-blue-900 rounded-xl shadow-metamask font-generalSans p-4 items-center">
      {(visibleStuckUtxoBalances.length > 0 ||
        receiveVaultBlockedFunds.length > 0) && (
        <div className="border-t-2 border-hinkal-blue-900 pt-3 mb-[10%]">
          <p className="text-hinkal-white-300 text-[12px] text-left mb-3">
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
                    className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:bg-hinkal-purple-200 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
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
            {receiveVaultBlockedFunds.map((fund) => {
              const key = blockedFundKey(fund);
              const isRecovering = recoveringBlockedFundKey === key;

              return (
                <div
                  className="flex items-center justify-between gap-3"
                  key={`receive-vault-${key}`}
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={fund.token.logoURI}
                      alt="tokenIcon"
                      className="w-[26px]"
                    />
                    <div>
                      <p className="text-white text-[18px] font-semibold">
                        {Number(
                          getAmountInToken(fund.token, fund.amount),
                        ).toFixed(4)}{" "}
                        {fund.token.symbol}
                      </p>
                      <p className="text-hinkal-white-300 text-[12px]">
                        Receive address ({fund.reason})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={recoveringBlockedFundKey !== null}
                    onClick={() => handleRecoverBlockedFund(fund)}
                    className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:bg-hinkal-purple-200 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRecovering ? (
                      <span className="flex items-center gap-x-1">
                        Recover <Spinner />
                      </span>
                    ) : (
                      "Recover"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t-2 md:text-[15px] border-hinkal-blue-900">
        <button
          type="button"
          className="block w-full text-left hover:opacity-70 transition-opacity duration-300"
          onClick={handleCopyShieldedAddress}
        >
          <div className="flex items-center mt-2 text-white text-[14px] md:w-[12.5rem]">
            <div className="flex justify-center items-center w-[25px] h-[25px]">
              <Copy />
            </div>
            <div className="pl-2">Copy Address</div>
          </div>
        </button>
        <button
          type="button"
          disabled={isCopyingPrivate}
          className="block w-full text-left hover:opacity-70 transition-opacity duration-300"
          onClick={handleCopyPrivateAddress}
        >
          <div className="flex items-center mt-2 text-white text-[14px] md:w-[12.5rem]">
            <div className="flex justify-center items-center w-[25px] h-[25px]">
              {isCopyingPrivate ? <Spinner /> : <Copy />}
            </div>
            <div className="pl-2 text-nowrap">Copy Private Address</div>
          </div>
        </button>
        <div>
          <button
            type="button"
            className="cursor-pointer hover:opacity-70 transition-opacity duration-300"
            onClick={handleDisconnect}
          >
            <div className="flex flex-row items-center text-white text-[14px] mt-2 ml-px w-[12.5rem]">
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
