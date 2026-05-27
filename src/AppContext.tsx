import {
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { networkRegistry } from "./constants/chain.constants";
import { fetchBalances, fetchStuckUtxoBalances } from "./utils/balance";
import { createEnclaveSession } from "./utils/session";
import type { EnclaveSession } from "./utils/types";
import { getERC20Registry } from "./constants/token-data";
import { getEthersSigner } from "./utils/ethers-wallet";
import { ERC20Token, TokenBalance } from "./types";

export type WalletType = "evm" | "tron";

type AppContextArgumnets = {
  signature: string | null;
  setSignature: Dispatch<SetStateAction<string | null>>;
  nonce: string | null;
  setNonce: Dispatch<SetStateAction<string | null>>;
  hasWriteAccess: boolean;
  sessionExpiresAt: string | null;
  requestedWriteAccess: boolean;
  walletType: WalletType | null;
  setWalletType: Dispatch<SetStateAction<WalletType | null>>;
  isTron: boolean;
  setRequestedWriteAccess: Dispatch<SetStateAction<boolean>>;
  applyEnclaveSession: (session: EnclaveSession) => void;
  clearEnclaveSession: () => void;
  walletAddress: string | null;
  setWalletAddress: Dispatch<SetStateAction<string | null>>;
  chainId?: number;
  setChainId: (num: number) => void;
  selectedNetwork: (typeof networkRegistry)[number] | undefined;
  dataLoaded: boolean;
  setDataLoaded: (val: boolean) => void;
  erc20List: ERC20Token[];
  balances: TokenBalance[];
  stuckUtxoBalances: TokenBalance[];
  refreshBalances: () => Promise<void>;
};

const BALANCE_REFRESH_INTERVAL = 100000;

const AppContext = createContext<AppContextArgumnets>({
  signature: null,
  setSignature: () => {},
  nonce: null,
  setNonce: () => {},
  hasWriteAccess: false,
  sessionExpiresAt: null,
  requestedWriteAccess: false,
  setRequestedWriteAccess: () => {},
  walletType: null,
  setWalletType: () => {},
  isTron: false,
  applyEnclaveSession: () => {},
  clearEnclaveSession: () => {},
  walletAddress: null,
  setWalletAddress: () => {},
  chainId: undefined,
  setChainId: () => {},
  selectedNetwork: undefined,
  dataLoaded: false,
  setDataLoaded: () => {},
  erc20List: [],
  balances: [],
  stuckUtxoBalances: [],
  refreshBalances: async () => {},
});

type AppContextProps = { children: ReactNode };

export const AppContextProvider: FC<AppContextProps> = ({
  children,
}: AppContextProps) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [requestedWriteAccess, setRequestedWriteAccess] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [chainId, setChainId] = useState<number | undefined>();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [stuckUtxoBalances, setStuckUtxoBalances] = useState<TokenBalance[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevChainIdRef = useRef<number | undefined>();

  const isTron = walletType === "tron";

  const erc20List = useMemo<ERC20Token[]>(
    () => (chainId ? getERC20Registry(chainId) : []),
    [chainId],
  );

  const selectedNetwork = useMemo(
    () => (chainId ? networkRegistry[chainId] : undefined),
    [chainId],
  );

  const applyEnclaveSession = useCallback((session: EnclaveSession) => {
    setSignature(session.signature);
    setNonce(session.nonce);
    setHasWriteAccess(session.hasWriteAccess);
    setSessionExpiresAt(session.expiresAt);
  }, []);

  const clearEnclaveSession = useCallback(() => {
    setSignature(null);
    setNonce(null);
    setHasWriteAccess(false);
    setSessionExpiresAt(null);
    setWalletType(null);
  }, []);

  useEffect(() => {
    if (!chainId) {
      prevChainIdRef.current = undefined;
      return;
    }

    const prevChainId = prevChainIdRef.current;
    prevChainIdRef.current = chainId;

    if (!walletAddress || !dataLoaded) return;
    if (prevChainId === undefined || prevChainId === chainId) return;
    // Tron users don't switch chains via wagmi; skip EVM re-auth for them
    if (walletType === "tron") return;

    let cancelled = false;
    setSignature(null);
    setNonce(null);
    setHasWriteAccess(false);
    setSessionExpiresAt(null);

    const refreshAuth = async () => {
      try {
        const signer = await getEthersSigner();
        const session = await createEnclaveSession(
          signer,
          walletAddress,
          chainId,
          requestedWriteAccess,
        );
        if (!cancelled) {
          applyEnclaveSession(session);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to refresh enclave auth after chain switch:", error);
          toast.error(
            `Failed to authorize on new network: ${error || "Unknown error"}`,
          );
        }
      }
    };

    void refreshAuth();
    return () => {
      cancelled = true;
    };
  }, [chainId, walletAddress, dataLoaded, requestedWriteAccess, applyEnclaveSession, walletType]);

  const refreshBalances = useCallback(async () => {
    if (!dataLoaded || !chainId || !walletAddress || !signature || !nonce)
      return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const auth = { signature, nonce, address: walletAddress, chainId };
      const [bals, stuckBals] = await Promise.all([
        fetchBalances(auth, controller.signal),
        fetchStuckUtxoBalances(auth, controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setBalances(bals);
        setStuckUtxoBalances(stuckBals);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error refreshing balances:", error);
      }
    }
  }, [dataLoaded, chainId, walletAddress, signature, nonce]);

  useEffect(() => {
    if (!dataLoaded || !chainId) return;
    setBalances([]);
    setStuckUtxoBalances([]);
    refreshBalances();
    const interval = setInterval(refreshBalances, BALANCE_REFRESH_INTERVAL);
    return () => {
      clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [dataLoaded, chainId, refreshBalances]);

  return (
    <AppContext.Provider
      value={{
        signature,
        setSignature,
        nonce,
        setNonce,
        hasWriteAccess,
        sessionExpiresAt,
        requestedWriteAccess,
        setRequestedWriteAccess,
        applyEnclaveSession,
        clearEnclaveSession,
        walletAddress,
        setWalletAddress,
        chainId,
        setChainId,
        selectedNetwork,
        dataLoaded,
        setDataLoaded,
        erc20List,
        balances,
        stuckUtxoBalances,
        refreshBalances,
        walletType,
        setWalletType,
        isTron,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
