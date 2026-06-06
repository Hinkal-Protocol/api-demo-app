import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { isMobile } from "react-device-detect";
import { useConfig, useConnectors } from "wagmi";
import { connect } from "wagmi/actions";
import type { Connector } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit"; // + added
import coinbaseLogo from "../assets/coinbaseWalletLogo.png";
import metamaskLogo from "../assets/metamaskWalletLogo.png";
import walletconnectLogo from "../assets/walletconnectWalletLogo.png";
import SolflareLogo from "../assets/SolflareWalletLogo.jpeg";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { ToggleSwitch } from "./withdraw/ToggleSwitch";
import { useAppContext } from "../AppContext";
import { createEnclaveSession } from "../utils/session";
import {
  getEthersSigner,
  setActiveTurnkeyParams,
} from "../utils/ethers-wallet";
import { connectTronLink } from "../utils/tron-wallet";
import { createTronEnclaveSession } from "../utils/tron-session";
import {
  connectSolanaWallet,
  SolanaWalletProvider,
} from "../utils/solana-wallet";
import { createSolanaEnclaveSession } from "../utils/solana-session";
import { SUPPORTED_CHAINS } from "../constants/supported-chain-ids.constants";
import { getFriendlyErrorMessage } from "../utils/errors";
import toast from "react-hot-toast";

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
  const connectors = useConnectors();
  console.log({ connectors });
  const config = useConfig();
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { wallets } = useWallets();
  const {
    handleLogin: turnkeyLogin,
    authState: turnkeyAuthState,
    clientState: turnkeyClientState,
    wallets: turnkeyWallets,
    refreshWallets: turnkeyRefreshWallets,
    httpClient: turnkeyHttpClient,
  } = useTurnkey();

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
  const [writeAccessEnabled, setWriteAccessEnabled] = useState(false);
  const turnkeySessionStarted = useRef(false);
  const handleSelectConnector = useCallback(
    async (connector: Connector) => {
      try {
        setIsConnecting?.(true);
        setConnectingId(connector.id);
        try {
          await connector.disconnect();
        } catch (disconnectError) {
          console.log("Disconnect cleanup:", disconnectError);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        const { accounts, chainId } = await connect(config, { connector });
        if (!chainId) throw new Error("Chain id not found");
        const account = accounts?.[0];
        if (!account) throw new Error("No account returned");

        const signer = await getEthersSigner();
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
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err, "Wallet connection failed"));
      } finally {
        setConnectingId(null);
        setIsConnecting?.(false);
      }
    },
    [
      setIsConnecting,
      config,
      setShieldedAddress,
      setChainId,
      setDataLoaded,
      setWalletAddress,
      setRequestedWriteAccess,
      applyEnclaveSession,
      setWalletType,
      writeAccessEnabled,
      onHide,
    ],
  );

  const handleConnectPrivy = useCallback(() => {
    setIsConnecting?.(true);
    setConnectingId("privy");
    if (!authenticated) login();
  }, [authenticated, login, setIsConnecting]);

  useEffect(() => {
    if (connectingId !== "privy" || !authenticated) return;
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (!embedded) return;
    setConnectingId("privy-signing");

    (async () => {
      try {
        const account = embedded.address;
        const chainId = Number(embedded.chainId.split(":")[1]);
        const signer = await getEthersSigner();
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
      } catch (err) {
        toast.error(`Privy connection failed: ${err || "Unknown error"}`);
      } finally {
        setConnectingId(null);
        setIsConnecting?.(false);
      }
    })();
  }, [
    connectingId,
    authenticated,
    wallets,
    setIsConnecting,
    setShieldedAddress,
    setChainId,
    setDataLoaded,
    setWalletAddress,
    setRequestedWriteAccess,
    applyEnclaveSession,
    setWalletType,
    writeAccessEnabled,
    onHide,
  ]);

  const handleConnectTurnkey = useCallback(() => {
    setIsConnecting?.(true);
    setConnectingId("turnkey");
    if (turnkeyAuthState !== AuthState.Authenticated) void turnkeyLogin();
  }, [turnkeyAuthState, turnkeyLogin, setIsConnecting]);

  useEffect(() => {
    if (connectingId !== "turnkey" && connectingId !== "turnkey-signing")
      return;
    if (turnkeyAuthState !== AuthState.Authenticated) return;

    const evmAccount = turnkeyWallets
      .flatMap((w) => w.accounts)
      .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

    if (!evmAccount) return;

    if (connectingId === "turnkey") setConnectingId("turnkey-signing");
    if (turnkeySessionStarted.current) return;
    turnkeySessionStarted.current = true;

    (async () => {
      try {
        const account = evmAccount.address;
        const chainId = SUPPORTED_CHAINS[0].id;
        setActiveTurnkeyParams({
          client: turnkeyHttpClient as any,
          organizationId: evmAccount.organizationId,
          signWith: evmAccount.address,
        });
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
      } catch (err) {
        toast.error(`Turnkey connection failed: ${err || "Unknown error"}`);
      } finally {
        turnkeySessionStarted.current = false;
        setConnectingId(null);
        setIsConnecting?.(false);
      }
    })();
  }, [
    connectingId,
    turnkeyAuthState,
    turnkeyWallets,
    turnkeyHttpClient,
    setIsConnecting,
    setShieldedAddress,
    setChainId,
    setDataLoaded,
    setWalletAddress,
    setRequestedWriteAccess,
    applyEnclaveSession,
    setWalletType,
    writeAccessEnabled,
    onHide,
  ]);

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
        setConnectingId(null);
        setIsConnecting?.(false);
      }
    },
    [
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
      writeAccessEnabled,
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
      setConnectingId(null);
      setIsConnecting?.(false);
    }
  }, [
    setIsConnecting,
    setShieldedAddress,
    setChainId,
    setDataLoaded,
    setWalletAddress,
    setRequestedWriteAccess,
    applyEnclaveSession,
    setWalletType,
    onHide,
    writeAccessEnabled,
  ]);

  return (
    <Modal
      xBtn
      xBtnAction={onHide}
      isOpen={isOpen}
      styleProps="md:w-[30%] md:ml-[5%] !bg-hinkal-blue-300 rounded-[10px]"
      stylePropsBg="bg-[#000000cc]"
      xBtnStyleProps="text-white font-black"
    >
      <h1 className="font-[500] text-2xl p-5 text-white">Select Wallet</h1>
      <div className="px-5 pb-2 flex items-center justify-between gap-3">
        <div className="text-sm text-white">
          <p className="font-semibold">24h session for transactions</p>
          <p className="text-hinkal-gray-100 text-xs mt-0.5">
            {writeAccessEnabled
              ? "Reuse one signature for txs for 24 hours"
              : "Read-only session; each tx requires a new signature"}
          </p>
        </div>
        <ToggleSwitch
          isOff={!writeAccessEnabled}
          setIsOff={() => setWriteAccessEnabled((prev) => !prev)}
        />
      </div>
      <div className="p-5 pb-10 flex flex-col items-center gap-y-5">
        <button
          className="bg-modal px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-[#f0f0f0] hover:border-[#9c9c9c] font-bold duration-150 flex items-center justify-center gap-x-3"
          type="button"
          disabled={!!connectingId || !privyReady}
          onClick={handleConnectPrivy}
        >
          <span className="text-white">Privy</span>
          {connectingId?.startsWith("privy") && <Spinner />}
        </button>
        <button
          className="bg-modal px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-[#f0f0f0] hover:border-[#9c9c9c] font-bold duration-150 flex items-center justify-center gap-x-3"
          type="button"
          disabled={
            !!connectingId || turnkeyClientState === ClientState.Loading
          }
          onClick={handleConnectTurnkey}
        >
          <span className="text-white">Turnkey</span>
          {connectingId?.startsWith("turnkey") && <Spinner />}
        </button>
        {connectors
          .filter((connector) =>
            isMobile
              ? connector.name === "WalletConnect"
              : connector.name !== "Hinkal" &&
                !connector.id.startsWith("io.privy.wallet"),
          )
          .map((connector) => (
            <button
              className="bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3"
              type="button"
              disabled={!!connectingId}
              key={connector.id}
              onClick={() => handleSelectConnector(connector)}
            >
              {connector.name === "Coinbase Wallet" && (
                <img
                  src={coinbaseLogo}
                  alt="Logo"
                  className="w-[26px] h-[26px]"
                />
              )}
              {connector.name === "MetaMask" && (
                <img
                  src={metamaskLogo}
                  alt="Logo"
                  className="w-[26px] h-[26px]"
                />
              )}
              {connector.name === "WalletConnect" && (
                <img
                  src={walletconnectLogo}
                  alt="Logo"
                  className="w-[26px] h-[26px]"
                />
              )}
              {connector.name !== "Coinbase Wallet" &&
                connector.name !== "MetaMask" &&
                connector.name !== "WalletConnect" && (
                  <img
                    src={connector.icon}
                    alt="Logo"
                    className="w-[26px] h-[26px]"
                  />
                )}
              <span>{connector.name}</span>
              {connectingId === connector.id && <Spinner />}
            </button>
          ))}
        {!isMobile && (
          <button
            className="bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3"
            type="button"
            disabled={!!connectingId}
            onClick={handleConnectTronLink}
          >
            <img
              src={connectors.find((c) => c.name === "TronLink")?.icon}
              alt="TronLink Logo"
              className="w-[26px] h-[26px]"
            />
            <span>TronLink (Tron)</span>
            {connectingId === "tronlink" && <Spinner />}
          </button>
        )}
        {!isMobile && (
          <button
            className="bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3"
            type="button"
            disabled={!!connectingId}
            onClick={() => handleConnectSolana("phantom")}
          >
            <img
              src={connectors.find((c) => c.name === "Phantom")?.icon}
              alt="Phantom Logo"
              className="w-[26px] h-[26px]"
            />
            <span>Phantom (Solana)</span>
            {connectingId === "solana-phantom" && <Spinner />}
          </button>
        )}
        {!isMobile && (
          <button
            className="bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3"
            type="button"
            disabled={!!connectingId}
            onClick={() => handleConnectSolana("solflare")}
          >
            <img
              src={SolflareLogo}
              alt="Solflare Logo"
              className="w-[26px] h-[26px]"
            />
            <span>Solflare (Solana)</span>
            {connectingId === "solana-solflare" && <Spinner />}
          </button>
        )}
        {!isMobile && (
          <button
            className="bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3"
            type="button"
            disabled={!!connectingId}
            onClick={() => handleConnectSolana("metamask")}
          >
            <img
              src={metamaskLogo}
              alt="MetaMask"
              className="w-[26px] h-[26px]"
            />
            <span>MetaMask (Solana)</span>
            {connectingId === "solana-metamask" && <Spinner />}
          </button>
        )}
      </div>
    </Modal>
  );
};
