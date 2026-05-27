import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getWallets } from "@wallet-standard/app";

export const SOLANA_MAINNET_CHAIN_ID = 501;
export const SOLANA_NATIVE_ADDRESS = "11111111111111111111111111111111";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=54ad9ec9-dad6-41de-b961-e3e8ea7a7188";
const SOLANA_MAINNET_CHAIN = "solana:mainnet";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phantom?: { solana?: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solflare?: any;
  }
}

export type SolanaWalletProvider = "phantom" | "solflare" | "metamask";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPhantom = (): any => {
  const p = window.phantom?.solana;
  if (!p) throw new Error("Phantom wallet not found. Please install the Phantom extension.");
  return p;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSolflare = (): any => {
  const s = window.solflare;
  if (!s) throw new Error("Solflare wallet not found. Please install the Solflare extension.");
  return s;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMetaMaskSolanaWallet = (): any => {
  const { get } = getWallets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = (get() as any[]).find((w) => w.name === "MetaMask");
  if (!wallet) {
    throw new Error("MetaMask not found. Please install MetaMask and ensure Solana is enabled.");
  }
  return wallet;
};

export const isSolanaChain = (chainId: number): boolean =>
  chainId === SOLANA_MAINNET_CHAIN_ID;

export const connectSolanaWallet = async (
  provider: SolanaWalletProvider,
): Promise<{ address: string; chainId: number }> => {
  if (provider === "metamask") {
    const wallet = getMetaMaskSolanaWallet();
    const connectFeature = wallet.features["standard:connect"];
    if (!connectFeature) throw new Error("MetaMask does not support standard:connect for Solana.");
    const { accounts } = await connectFeature.connect();
    const solanaAccount = accounts.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.chains?.some((c: string) => c.startsWith("solana:")),
    );
    if (!solanaAccount) throw new Error("No Solana account found in MetaMask.");
    return { address: solanaAccount.address, chainId: SOLANA_MAINNET_CHAIN_ID };
  }

  const wallet = provider === "phantom" ? getPhantom() : getSolflare();
  if (!wallet.isConnected) {
    await wallet.connect();
  }
  const publicKey: PublicKey = wallet.publicKey;
  if (!publicKey) throw new Error("No Solana account connected.");
  return { address: publicKey.toBase58(), chainId: SOLANA_MAINNET_CHAIN_ID };
};

export const signSolanaMessage = async (
  provider: SolanaWalletProvider,
  message: string,
): Promise<string> => {
  const encoded = new TextEncoder().encode(message);

  if (provider === "metamask") {
    const wallet = getMetaMaskSolanaWallet();
    const signFeature = wallet.features["solana:signMessage"];
    if (!signFeature) throw new Error("MetaMask does not support solana:signMessage.");
    // Get connected account
    const connectFeature = wallet.features["standard:connect"];
    const { accounts } = await connectFeature.connect({ silent: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = accounts.find((a: any) =>
      a.chains?.some((c: string) => c.startsWith("solana:")),
    );
    if (!account) throw new Error("No Solana account in MetaMask.");
    const [result] = await signFeature.signMessage({ account, message: encoded });
    return Buffer.from(result.signature).toString("hex");
  }

  const wallet = provider === "phantom" ? getPhantom() : getSolflare();
  const result = await wallet.signMessage(encoded, "utf8");
  // Phantom: { signature: Uint8Array }, Solflare: { signature: Uint8Array } or Uint8Array
  const sigBytes: Uint8Array = result?.signature ?? result;
  return Buffer.from(sigBytes).toString("hex");
};

export const broadcastSolanaTransaction = async (
  provider: SolanaWalletProvider,
  serializedTxBase64: string,
): Promise<string> => {
  const txBytes = Buffer.from(serializedTxBase64, "base64");
  const connection = new Connection(HELIUS_RPC, "confirmed");

  if (provider === "metamask") {
    const wallet = getMetaMaskSolanaWallet();
    const signTxFeature = wallet.features["solana:signTransaction"];
    if (!signTxFeature) throw new Error("MetaMask does not support solana:signTransaction.");
    const connectFeature = wallet.features["standard:connect"];
    const { accounts } = await connectFeature.connect({ silent: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = accounts.find((a: any) =>
      a.chains?.some((c: string) => c.startsWith("solana:")),
    );
    if (!account) throw new Error("No Solana account in MetaMask.");
    const [result] = await signTxFeature.signTransaction({
      account,
      transaction: txBytes,
      chain: SOLANA_MAINNET_CHAIN,
    });
    const signature = await connection.sendRawTransaction(result.signedTransaction);
    return signature;
  }

  const wallet = provider === "phantom" ? getPhantom() : getSolflare();
  const tx = VersionedTransaction.deserialize(txBytes);
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  return signature;
};

export const getSolanaNativeBalance = async (address: string): Promise<bigint> => {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const lamports = await connection.getBalance(new PublicKey(address));
  return BigInt(lamports);
};

export const getSolanaTokenBalance = async (
  tokenMintAddress: string,
  ownerAddress: string,
): Promise<bigint> => {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const mint = new PublicKey(tokenMintAddress);
  const owner = new PublicKey(ownerAddress);
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length === 0) return 0n;
  const amount: string =
    accounts.value[0].account.data.parsed.info.tokenAmount.amount;
  return BigInt(amount);
};
