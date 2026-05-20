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
import { fetchBalances } from "./utils/balance";
import { buildEnclaveAuthFields } from "./utils/auth";
import { getERC20Registry } from "./constants/token-data";
import { getEthersSigner } from "./utils/ethers-wallet";
import { ERC20Token } from "./types";

type AppContextArgumnets = {
  signature: string | null;
  setSignature: Dispatch<SetStateAction<string | null>>;
  nonce: string | null;
  setNonce: Dispatch<SetStateAction<string | null>>;
  walletAddress: string | null;
  setWalletAddress: Dispatch<SetStateAction<string | null>>;
  chainId?: number;
  setChainId: (num: number) => void;
  selectedNetwork: (typeof networkRegistry)[number] | undefined;
  dataLoaded: boolean;
  setDataLoaded: (val: boolean) => void;
  erc20List: ERC20Token[];
  balances: any[];
  refreshBalances: () => Promise<void>;
};

const BALANCE_REFRESH_INTERVAL = 100000;

const AppContext = createContext<AppContextArgumnets>({
  signature: null,
  setSignature: () => {},
  nonce: null,
  setNonce: () => {},
  walletAddress: null,
  setWalletAddress: () => {},
  chainId: undefined,
  setChainId: () => {},
  selectedNetwork: undefined,
  dataLoaded: false,
  setDataLoaded: () => {},
  erc20List: [],
  balances: [],
  refreshBalances: async () => {},
});

type AppContextProps = { children: ReactNode };

export const AppContextProvider: FC<AppContextProps> = ({
  children,
}: AppContextProps) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | undefined>();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [balances, setBalances] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevChainIdRef = useRef<number | undefined>();

  const erc20List = useMemo<ERC20Token[]>(
    () => (chainId ? getERC20Registry(chainId) : []),
    [chainId],
  );

  const selectedNetwork = useMemo(
    () => (chainId ? networkRegistry[chainId] : undefined),
    [chainId],
  );

  useEffect(() => {
    if (!chainId) {
      prevChainIdRef.current = undefined;
      return;
    }

    const prevChainId = prevChainIdRef.current;
    prevChainIdRef.current = chainId;

    if (!walletAddress || !dataLoaded) return;
    if (prevChainId === undefined || prevChainId === chainId) return;

    let cancelled = false;
    setSignature(null);
    setNonce(null);

    const refreshAuth = async () => {
      try {
        const signer = await getEthersSigner();
        const auth = await buildEnclaveAuthFields(signer);
        if (!cancelled) {
          setSignature(auth.signature);
          setNonce(auth.nonce);
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
  }, [chainId, walletAddress, dataLoaded]);

  const refreshBalances = useCallback(async () => {
    if (!dataLoaded || !chainId || !walletAddress || !signature || !nonce)
      return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const bals = await fetchBalances(
        { signature, nonce, address: walletAddress, chainId },
        controller.signal,
      );
      if (!controller.signal.aborted) setBalances(bals);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error refreshing balances:", error);
      }
    }
  }, [dataLoaded, chainId, walletAddress, signature, nonce]);

  useEffect(() => {
    if (!dataLoaded || !chainId) return;
    setBalances([]);
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
        walletAddress,
        setWalletAddress,
        chainId,
        setChainId,
        selectedNetwork,
        dataLoaded,
        setDataLoaded,
        erc20List,
        balances,
        refreshBalances,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
