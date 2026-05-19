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
import { networkRegistry } from "./constants/chain.constants";
import { fetchBalances } from "./utils/balance";
import { getERC20Registry } from "./constants/token-data";
import { ERC20Token } from "./types";

type AppContextArgumnets = {
  hinkal: any;
  setHinkal: Dispatch<SetStateAction<any>>;
  signature: string | null;
  setSignature: Dispatch<SetStateAction<string | null>>;
  nonce: string | null;
  setNonce: Dispatch<SetStateAction<string | null>>;
  walletAddress: string | null;
  setWalletAddress: Dispatch<SetStateAction<string | null>>;
  chainId?: number;
  setChainId: (num: number) => void;
  selectedNetwork: any;
  setSelectedNetwork: (net: any) => void;
  dataLoaded: boolean;
  setDataLoaded: (val: boolean) => void;
  erc20List: any[];
  balances: any[];
  refreshBalances: () => Promise<void>;
};

const BALANCE_REFRESH_INTERVAL = 100000;

const AppContext = createContext<AppContextArgumnets>({
  hinkal: null,
  setHinkal: () => {},
  signature: null,
  setSignature: () => {},
  nonce: null,
  setNonce: () => {},
  walletAddress: null,
  setWalletAddress: () => {},
  chainId: undefined,
  setChainId: () => {},
  selectedNetwork: undefined,
  setSelectedNetwork: () => {},
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
  const [hinkal, setHinkal] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | undefined>();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(undefined);
  const [balances, setBalances] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const erc20List = useMemo<ERC20Token[]>(
    () => (chainId ? getERC20Registry(chainId) : []),
    [chainId],
  );

  useEffect(() => {
    if (!chainId) {
      setSelectedNetwork(undefined);
      return;
    }
    setSelectedNetwork(networkRegistry[chainId]);
  }, [chainId]);

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
        hinkal,
        setHinkal,
        signature,
        setSignature,
        nonce,
        setNonce,
        walletAddress,
        setWalletAddress,
        chainId,
        setChainId,
        selectedNetwork,
        setSelectedNetwork,
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
