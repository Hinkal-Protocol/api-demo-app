import { useCallback, useState } from "react";
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
  setActiveDynamicWallet,
  setActivePrivyWallet,
  setActiveTurnkeyParams,
  setActiveDfnsWallet,
  setActiveOpenfort,
} from "../../utils/ethers-wallet";
import { recoverStuckBalance } from "../../utils/withdraw";
import { recoverReceiveVault } from "../../utils/transferAddress";
import { shortenAddress } from "../../utils/shortenAddress";
import { WalletInfoBalance } from "./WalletInfoBalance";
import { useAppContext } from "../../AppContext";
import { StuckBalance } from "../../types";

type StuckSource = StuckBalance["sources"][number];

const stuckSourceKey = (tokenAddress: string, { kind, vaultAddress }: StuckSource) =>
  `${tokenAddress}:${kind}:${vaultAddress ?? ""}`;

export const WalletInfoDropDown = () => {
  const {
    stuckBalances,
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
  const [recoveringStuckKey, setRecoveringStuckKey] = useState<string | null>(null);
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

  // Recovers one source of a stuck token to the connected wallet; a vault's tx is sent by the wallet itself.
  const handleRecoverStuck = useCallback(
    async (tokenAddress: string, source: StuckSource) => {
      try {
        if (!walletAddress || !chainId || !sessionId || !privateKey) return;

        setRecoveringStuckKey(stuckSourceKey(tokenAddress, source));
        const session = { sessionId, authMode, privateKey };
        const wallet = {
          signer: isTron || isSolana ? null : await getEthersSigner(),
          solanaProvider: isSolana ? solanaProvider : undefined,
        };
        if (source.kind === "vault" && source.vaultAddress) {
          const txHash = await recoverReceiveVault(
            wallet,
            session,
            chainId,
            source.vaultAddress,
            tokenAddress,
            walletAddress,
          );
          toast.success(`Vault recover sent: ${txHash}`);
        } else {
          const result = await recoverStuckBalance(wallet, session, chainId, {
            tokenAddress,
            recipientAddress: walletAddress,
            kind: source.kind,
          });
          toast.success(
            source.kind === "utxo"
              ? `Withdraw sent (${result.txHashes?.length ?? 0} txs)`
              : `Recovered ${result.recoveredAmount} (${result.failedCount ?? 0} failed)`,
          );
        }
        await refreshBalances();
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err, "Recover stuck balance failed"));
      } finally {
        setRecoveringStuckKey(null);
      }
    },
    [walletAddress, chainId, sessionId, privateKey, authMode, refreshBalances, isSolana, isTron, solanaProvider],
  );

  return (
    <div className="absolute top-20 md:top-2 right-0 left-auto w-60 max-w-[90vw] bg-hinkal-blue-900 rounded-xl shadow-metamask font-generalSans p-4 items-center">
      {stuckBalances.length > 0 && (
        <div className="border-t-2 border-hinkal-blue-900 pt-3 mb-[10%]">
          <p className="text-hinkal-white-300 text-[12px] text-left mb-3">
            Stuck Balances
          </p>
          <div className="flex flex-col justify-center gap-4">
            {stuckBalances.map((stuckBalance) => (
              <div className="flex flex-col gap-2" key={`stuck-${stuckBalance.tokenAddress}`}>
                <WalletInfoBalance tokenBalance={stuckBalance} />
                {stuckBalance.sources.map((source) => {
                  const key = stuckSourceKey(stuckBalance.tokenAddress, source);
                  return (
                    <div className="flex items-center justify-between gap-3 pl-2" key={key}>
                      <div className="text-hinkal-white-300 text-[12px]">
                        <p>
                          {source.kind}
                          {source.vaultAddress && ` ${shortenAddress(source.vaultAddress)}`}
                        </p>
                        <WalletInfoBalance tokenBalance={{ ...stuckBalance, balance: source.amount }} />
                      </div>
                      <button
                        type="button"
                        disabled={recoveringStuckKey !== null}
                        onClick={() => handleRecoverStuck(stuckBalance.tokenAddress, source)}
                        className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:bg-hinkal-purple-200 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {recoveringStuckKey === key ? (
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
            ))}
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
