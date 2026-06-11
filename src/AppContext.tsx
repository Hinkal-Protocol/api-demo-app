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
import { getPublicBalances } from "./utils/public-balances";
import { createEnclaveSession } from "./utils/session";
import { getFriendlyErrorMessage } from "./utils/errors";
import type { EnclaveSession } from "./utils/types";
import type { SolanaWalletProvider } from "./utils/solana-wallet";
import { getERC20Registry } from "./constants/token-data";
import { getEthersSigner } from "./utils/ethers-wallet";
import { ERC20Token, TokenBalance } from "./types";

export type WalletType = "evm" | "tron" | "solana";

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
  isSolana: boolean;
  solanaProvider: SolanaWalletProvider | null;
  setSolanaProvider: Dispatch<SetStateAction<SolanaWalletProvider | null>>;
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
  refreshBalancesSoon: (delaysMs?: number[]) => Promise<void>;
  isBalancesRefreshing: boolean;
  walletBalances: Record<string, bigint>;
  isWalletBalancesLoading: boolean;
  refreshWalletBalances: () => Promise<void>;
};

const BALANCE_REFRESH_INTERVAL = 100000;
const WALLET_BALANCES_REFRESH_INTERVAL = 7000;

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
  isSolana: false,
  solanaProvider: null,
  setSolanaProvider: () => {},
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
  refreshBalancesSoon: async () => {},
  isBalancesRefreshing: false,
  walletBalances: {},
  isWalletBalancesLoading: false,
  refreshWalletBalances: async () => {},
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
  const [solanaProvider, setSolanaProvider] =
    useState<SolanaWalletProvider | null>(null);
  const [chainId, setChainId] = useState<number | undefined>();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [stuckUtxoBalances, setStuckUtxoBalances] = useState<TokenBalance[]>(
    [],
  );
  const [walletBalances, setWalletBalances] = useState<Record<string, bigint>>(
    {},
  );
  const [isWalletBalancesLoading, setIsWalletBalancesLoading] = useState(false);
  const [isBalancesRefreshing, setIsBalancesRefreshing] = useState(false);
  const balancesRef = useRef<TokenBalance[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevChainIdRef = useRef<number | undefined>();

  const isTron = useMemo(() => walletType === "tron", [walletType]);
  const isSolana = useMemo(() => walletType === "solana", [walletType]);

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
    setSolanaProvider(null);
  }, [setSolanaProvider]);

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
    if (walletType === "tron" || walletType === "solana") return;

    let cancelled = false;
    setSignature(null);
    setNonce(null);
    setHasWriteAccess(false);
    setSessionExpiresAt(null);

    const refreshAuth = async () => {
      try {
        const signer = await getEthersSigner(chainId);
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
          console.error(
            "Failed to refresh enclave auth after chain switch:",
            error,
          );
          toast.error(
            getFriendlyErrorMessage(
              error,
              "Failed to authorize on new network",
            ),
          );
        }
      }
    };

    void refreshAuth();
    return () => {
      cancelled = true;
    };
  }, [
    chainId,
    walletAddress,
    dataLoaded,
    requestedWriteAccess,
    applyEnclaveSession,
    walletType,
  ]);

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
        balancesRef.current = bals;
        setBalances(bals);
        setStuckUtxoBalances(stuckBals);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error refreshing balances:", error);
      }
    }
  }, [dataLoaded, chainId, walletAddress, signature, nonce]);

  // After a tx the new balance may not be indexed yet, so a single immediate
  // refresh returns stale data. Re-poll a few times spaced out to catch it
  // well before the periodic interval would.
  const refreshBalancesSoon = useCallback(
    async (delaysMs: number[] = [2000, 5000, 9000]) => {
      const snapshot = (bals: TokenBalance[]) =>
        bals
          .map((b) => `${b.tokenAddress.toLowerCase()}:${b.balance}`)
          .sort()
          .join(",");

      const before = snapshot(balancesRef.current);
      setIsBalancesRefreshing(true);
      try {
        for (const ms of delaysMs) {
          await new Promise((resolve) => setTimeout(resolve, ms));
          await refreshBalances();

          if (snapshot(balancesRef.current) !== before) break;
        }
      } finally {
        setIsBalancesRefreshing(false);
      }
    },
    [refreshBalances],
  );

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

  const refreshWalletBalances = useCallback(
    async (silent = false) => {
      if (!walletAddress || !chainId || !walletType || erc20List.length === 0) {
        setWalletBalances({});
        return;
      }
      if (!silent) setIsWalletBalancesLoading(true);
      try {
        const balances = await getPublicBalances(
          erc20List,
          walletAddress,
          chainId,
          walletType,
        );
        setWalletBalances(
          Object.fromEntries(
            balances.map((b) => [
              b.token.erc20TokenAddress.toLowerCase(),
              b.balance,
            ]),
          ),
        );
      } finally {
        if (!silent) setIsWalletBalancesLoading(false);
      }
    },
    [walletAddress, chainId, walletType, erc20List],
  );

  useEffect(() => {
    if (!walletAddress || !chainId || !walletType || erc20List.length === 0) {
      setWalletBalances({});
      return;
    }
    refreshWalletBalances();
    const interval = setInterval(
      () => refreshWalletBalances(true),
      WALLET_BALANCES_REFRESH_INTERVAL,
    );
    return () => clearInterval(interval);
  }, [walletAddress, chainId, walletType, erc20List, refreshWalletBalances]);

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
        refreshBalancesSoon,
        isBalancesRefreshing,
        walletBalances,
        isWalletBalancesLoading,
        refreshWalletBalances,
        walletType,
        setWalletType,
        isTron,
        isSolana,
        solanaProvider,
        setSolanaProvider,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
