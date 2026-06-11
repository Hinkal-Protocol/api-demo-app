import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { useConfig, useConnectors } from "wagmi";
import { connect, disconnect } from "wagmi/actions";
import type { Connector } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import toast from "react-hot-toast";
import { useAppContext } from "../../AppContext";
import { createEnclaveSession } from "../../utils/session";
import {
  getEthersSigner,
  setActiveDfnsWallet,
  setActiveTurnkeyParams,
} from "../../utils/ethers-wallet";
import { connectDfns } from "../../utils/dfns";
import { connectTronLink } from "../../utils/tron-wallet";
import { createTronEnclaveSession } from "../../utils/tron-session";
import {
  connectSolanaWallet,
  SolanaWalletProvider,
} from "../../utils/solana-wallet";
import { createSolanaEnclaveSession } from "../../utils/solana-session";
import { SUPPORTED_CHAINS } from "../../constants/supported-chain-ids.constants";
import { getFriendlyErrorMessage } from "../../utils/errors";

interface UseChooseWalletConnectionsParams {
  writeAccessEnabled: boolean;
  onHide: () => void;
  setShieldedAddress: (value: string | undefined) => void;
  setIsConnecting?: (value: boolean) => void;
}

export const useChooseWalletConnections = ({
  onHide,
  setShieldedAddress,
  setIsConnecting,
  writeAccessEnabled,
}: UseChooseWalletConnectionsParams) => {
  const connectors = useConnectors();
  const config = useConfig();
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { wallets } = useWallets();
  const {
    handleLogin: turnkeyLogin,
    authState: turnkeyAuthState,
    wallets: turnkeyWallets,
    refreshWallets: turnkeyRefreshWallets,
    httpClient: turnkeyHttpClient,
    session: turnkeySession,
  } = useTurnkey();
  const {
    primaryWallet: dynamicWallet,
    setShowAuthFlow: setDynamicShowAuthFlow,
    sdkHasLoaded: dynamicReady,
  } = useDynamicContext();

  const {
    setChainId,
    setDataLoaded,
    setWalletAddress,
    setRequestedWriteAccess,
    applyEnclaveSession,
    setWalletType,
    setSolanaProvider,
  } = useAppContext();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const turnkeySessionStarted = useRef(false);

  const finishConnecting = useCallback(() => {
    setConnectingId(null);
    setIsConnecting?.(false);
  }, [setIsConnecting]);

  const completeEvmSession = useCallback(
    async (account: string, chainId: number) => {
      const signer = await getEthersSigner(chainId);
      setRequestedWriteAccess(writeAccessEnabled);
      const session = await createEnclaveSession(
        signer,
        account,
        chainId,
        writeAccessEnabled,
      );
      setWalletType("evm");
      setWalletAddress(account);
      applyEnclaveSession(session);
      setShieldedAddress(undefined);
      setChainId(chainId);
      setDataLoaded(true);
      onHide();
    },
    [
      writeAccessEnabled,
      setRequestedWriteAccess,
      applyEnclaveSession,
      setShieldedAddress,
      setChainId,
      setDataLoaded,
      setWalletAddress,
      setWalletType,
      onHide,
    ],
  );

  const handleSelectConnector = useCallback(
    async (connector: Connector) => {
      try {
        setIsConnecting?.(true);
        setConnectingId(connector.id);
        try {
          await disconnect(config);
          await connector.disconnect();
        } catch (disconnectError) {
          console.log("Disconnect cleanup:", disconnectError);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        const { accounts, chainId } = await connect(config, { connector });
        if (!chainId) throw new Error("Chain id not found");
        const account = accounts?.[0];
        if (!account) throw new Error("No account returned");
        await completeEvmSession(account, chainId);
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err, "Wallet connection failed"));
      } finally {
        finishConnecting();
      }
    },
    [config, completeEvmSession, finishConnecting, setIsConnecting],
  );

  const handleConnectPrivy = useCallback(async () => {
    setIsConnecting?.(true);
    setConnectingId("privy");
    await disconnect(config);
    if (!authenticated) login();
  }, [authenticated, login, setIsConnecting, config]);

  useEffect(() => {
    if (connectingId !== "privy" || !authenticated) return;
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (!embedded) return;
    setConnectingId("privy-signing");

    (async () => {
      try {
        const chainId = Number(embedded.chainId.split(":")[1]);
        await completeEvmSession(embedded.address, chainId);
      } catch (err) {
        toast.error(
          `Privy connection failed: ${getFriendlyErrorMessage(
            err,
            "Privy connection failed",
          )}`,
        );
      } finally {
        finishConnecting();
      }
    })();
  }, [
    connectingId,
    authenticated,
    wallets,
    completeEvmSession,
    finishConnecting,
  ]);

  const handleConnectTurnkey = useCallback(async () => {
    setIsConnecting?.(true);
    setConnectingId("turnkey");
    await disconnect(config);
    if (turnkeyAuthState !== AuthState.Authenticated) await turnkeyLogin();
  }, [turnkeyAuthState, turnkeyLogin, setIsConnecting, config]);

  useEffect(() => {
    if (connectingId !== "turnkey" && connectingId !== "turnkey-signing") {
      return;
    }
    if (turnkeyAuthState !== AuthState.Authenticated) return;
    if (turnkeySessionStarted.current) return;
    turnkeySessionStarted.current = true;

    if (connectingId === "turnkey") setConnectingId("turnkey-signing");

    (async () => {
      try {
        const pickEvm = (wallets: typeof turnkeyWallets) =>
          wallets
            .flatMap((w) => w.accounts)
            .find(
              (a) =>
                a.addressFormat === "ADDRESS_FORMAT_ETHEREUM" &&
                (a as { source?: string }).source !== "connected",
            );
        let evmAccount =
          pickEvm(turnkeyWallets) ?? pickEvm(await turnkeyRefreshWallets());
        if (!evmAccount) {
          await (turnkeyHttpClient as any).createWallet({
            walletName: `Default Wallet ${Date.now()}`,
            accounts: [
              {
                curve: "CURVE_SECP256K1",
                pathFormat: "PATH_FORMAT_BIP32",
                path: "m/44'/60'/0'/0/0",
                addressFormat: "ADDRESS_FORMAT_ETHEREUM",
              },
            ],
          });
          evmAccount = pickEvm(await turnkeyRefreshWallets());
          if (!evmAccount) throw new Error("No Turnkey wallet available");
        }
        const account = ethers.getAddress(evmAccount.address);
        const chainId = SUPPORTED_CHAINS[0].id;
        const signingOrgId =
          turnkeySession?.organizationId ?? evmAccount.organizationId;
        if (!signingOrgId) {
          throw new Error("No Turnkey organization id for signing");
        }
        setActiveTurnkeyParams({
          client: turnkeyHttpClient as any,
          organizationId: signingOrgId,
          signWith: account,
        });
        await completeEvmSession(account, chainId);
      } catch (err) {
        toast.error(
          `Turnkey connection failed: ${getFriendlyErrorMessage(
            err,
            "Turnkey connection failed",
          )}`,
        );
      } finally {
        turnkeySessionStarted.current = false;
        finishConnecting();
      }
    })();
  }, [
    connectingId,
    turnkeyAuthState,
    turnkeyWallets,
    turnkeyHttpClient,
    turnkeyRefreshWallets,
    turnkeySession,
    completeEvmSession,
    finishConnecting,
  ]);

  const handleConnectDynamic = useCallback(async () => {
    setIsConnecting?.(true);
    setConnectingId("dynamic");
    await disconnect(config);
    setDynamicShowAuthFlow(true);
  }, [config, setDynamicShowAuthFlow, setIsConnecting]);

  useEffect(() => {
    if (connectingId !== "dynamic" || !dynamicWallet) return;
    if (!isEthereumWallet(dynamicWallet)) return;
    setConnectingId("dynamic-signing");

    (async () => {
      try {
        const chainId =
          Number(await dynamicWallet.getNetwork()) || SUPPORTED_CHAINS[0].id;
        await completeEvmSession(dynamicWallet.address, chainId);
      } catch (err) {
        toast.error(
          `Dynamic connection failed: ${getFriendlyErrorMessage(
            err,
            "Dynamic connection failed",
          )}`,
        );
      } finally {
        finishConnecting();
      }
    })();
  }, [connectingId, dynamicWallet, completeEvmSession, finishConnecting]);

  const handleConnectDfns = useCallback(
    async (idToken: string) => {
      try {
        setIsConnecting?.(true);
        setConnectingId("dfns");
        await disconnect(config);
        const chainId = SUPPORTED_CHAINS[0].id;
        const { wallet, address } = await connectDfns(idToken);
        setActiveDfnsWallet(wallet);
        await completeEvmSession(address, chainId);
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err, "DFNS connection failed"));
      } finally {
        finishConnecting();
      }
    },
    [config, completeEvmSession, finishConnecting, setIsConnecting],
  );

  const handleConnectSolana = useCallback(
    async (provider: SolanaWalletProvider) => {
      try {
        setIsConnecting?.(true);
        setConnectingId(`solana-${provider}`);
        const { address, chainId } = await connectSolanaWallet(provider);
        const session = await createSolanaEnclaveSession(
          address,
          chainId,
          provider,
          writeAccessEnabled,
        );
        setRequestedWriteAccess(writeAccessEnabled);
        setWalletType("solana");
        setSolanaProvider(provider);
        setWalletAddress(address);
        applyEnclaveSession(session);
        setShieldedAddress(undefined);
        setChainId(chainId);
        setDataLoaded(true);
        onHide();
      } catch (err) {
        toast.error(
          getFriendlyErrorMessage(
            err,
            `${
              provider === "phantom" ? "Phantom" : "Solflare"
            } connection failed`,
          ),
        );
      } finally {
        finishConnecting();
      }
    },
    [
      writeAccessEnabled,
      setIsConnecting,
      setShieldedAddress,
      setChainId,
      setDataLoaded,
      setWalletAddress,
      setRequestedWriteAccess,
      applyEnclaveSession,
      setWalletType,
      setSolanaProvider,
      onHide,
      finishConnecting,
    ],
  );

  const handleConnectTronLink = useCallback(async () => {
    try {
      setIsConnecting?.(true);
      setConnectingId("tronlink");
      const { address, chainId } = await connectTronLink();
      const session = await createTronEnclaveSession(
        address,
        chainId,
        writeAccessEnabled,
      );
      setRequestedWriteAccess(writeAccessEnabled);
      setWalletType("tron");
      setWalletAddress(address);
      applyEnclaveSession(session);
      setShieldedAddress(undefined);
      setChainId(chainId);
      setDataLoaded(true);
      onHide();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "TronLink connection failed"));
    } finally {
      finishConnecting();
    }
  }, [
    writeAccessEnabled,
    setIsConnecting,
    setShieldedAddress,
    setChainId,
    setDataLoaded,
    setWalletAddress,
    setRequestedWriteAccess,
    applyEnclaveSession,
    setWalletType,
    onHide,
    finishConnecting,
  ]);

  return {
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
  };
};

export type ChooseWalletConnections = ReturnType<
  typeof useChooseWalletConnections
>;
