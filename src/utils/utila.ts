import { ethers } from "ethers";
import { DATA_SERVER_BASE_URL } from "../constants/server.constants";

export interface UtilaCreds {
  email: string;
  privateKey: string;
}

export interface UtilaWallet {
  name: string;
  displayName: string;
  address: string;
}

const post = async (path: string, body: unknown): Promise<any> => {
  const res = await fetch(`${DATA_SERVER_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Utila request failed (${res.status})`);
  }
  return data;
};

export const connectUtila = (
  creds: UtilaCreds,
): Promise<{ wallets: UtilaWallet[]; vaults: unknown[] }> =>
  post("/utila/connect", creds);

export class UtilaSigner extends ethers.AbstractSigner {
  private readonly creds: UtilaCreds;
  private readonly wallet: UtilaWallet;

  constructor(
    creds: UtilaCreds,
    wallet: UtilaWallet,
    provider: ethers.Provider | null = null,
  ) {
    super(provider);
    this.creds = creds;
    this.wallet = wallet;
  }

  getAddress() {
    return Promise.resolve(this.wallet.address);
  }

  connect(provider: ethers.Provider | null) {
    return new UtilaSigner(this.creds, this.wallet, provider);
  }

  async signMessage(message: string | Uint8Array) {
    const msg = typeof message === "string" ? message : ethers.hexlify(message);
    const { signature } = await post("/utila/sign-message", {
      ...this.creds,
      wallet: this.wallet.name,
      message: msg,
    });
    return signature;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>,
  ) {
    const typedData = ethers.TypedDataEncoder.getPayload(domain, types, value);
    const { signature } = await post("/utila/sign-message", {
      ...this.creds,
      wallet: this.wallet.name,
      typedData: JSON.stringify(typedData),
    });
    return signature;
  }

  signTransaction(): Promise<string> {
    throw new Error("UtilaSigner signs and broadcasts via sendTransaction");
  }

  async sendTransaction(tx: ethers.TransactionRequest) {
    const provider = this.provider;
    if (!provider) throw new Error("UtilaSigner requires a provider");
    const { chainId } = await provider.getNetwork();
    const { hash } = await post("/utila/send-transaction", {
      ...this.creds,
      wallet: this.wallet.name,
      to: tx.to,
      data: tx.data ?? "0x",
      value: tx.value ? ethers.toBeHex(tx.value) : "0x0",
      chainId: Number(chainId),
    });
    const receipt = await provider.waitForTransaction(hash);
    return provider.getTransaction(receipt!.hash) as Promise<ethers.TransactionResponse>;
  }
}
