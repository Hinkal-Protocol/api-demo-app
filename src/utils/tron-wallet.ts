import { chainIds } from "../constants/chain.constants";
import { zeroAddress } from "../constants";

export const TRON_NILE_CHAIN_ID = 3448148188;
export const TRON_MAINNET_CHAIN_ID = 728126428;

const TRON_FEE_LIMIT_SUN = 1_000_000_000;
const TRON_EXPIRATION_EXTENSION_SEC = 300;

// Minimal ERC20 approve ABI fragment for Tron
const APPROVE_FUNC = "approve(address,uint256)";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tronLink?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tronWeb?: any;
  }
}


export const isTempo = (chainId: number): boolean =>
  chainId === chainIds.tempo;

export const isTronChain = (chainId: number): boolean =>
  chainId === TRON_NILE_CHAIN_ID || chainId === TRON_MAINNET_CHAIN_ID;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTronWeb = (): any => {
  const tw = window.tronLink?.tronWeb ?? window.tronWeb;
  if (!tw) throw new Error("TronLink not found. Please install the TronLink extension.");
  return tw;
};

/** Convert EVM hex address (0x...) to Tron base58 */
export const tronHexToBase58 = (hex: string): string => {
  const tw = getTronWeb();
  // TronWeb.address.fromHex handles both 0x... and 41... prefixes
  return tw.address.fromHex(hex);
};

/** Convert Tron base58 address to EVM hex (0x...) */
export const tronBase58ToHex = (base58: string): string => {
  if (base58.startsWith("0x")) return base58;
  const tw = getTronWeb();
  const hex: string = tw.address.toHex(base58); // returns 41...
  return "0x" + hex.slice(2);
};

export const connectTronLink = async (): Promise<{
  address: string;
  chainId: number;
}> => {
  if (!window.tronLink && !window.tronWeb) {
    throw new Error("TronLink not installed. Please install the TronLink extension.");
  }

  if (window.tronLink) {
    await window.tronLink.request({ method: "tron_requestAccounts" });
  }

  const tw = getTronWeb();
  const address: string = tw.defaultAddress?.base58;
  if (!address) throw new Error("No Tron account connected. Please unlock TronLink.");

  // Detect network from the full node host URL
  const host: string = tw.fullNode?.host ?? "";
  const chainId = host.toLowerCase().includes("nile")
    ? TRON_NILE_CHAIN_ID
    : TRON_MAINNET_CHAIN_ID;

  return { address, chainId };
};

export const signTronPersonalMessage = (message: string): string => {
  const tw = getTronWeb();
  return tw.trx.signMessageV2(message);
};

/** Approve a TRC20 token spend and wait for confirmation */
export const approveTronToken = async (
  tokenHexAddress: string,
  spenderHexAddress: string,
  amount: bigint,
  fromBase58: string,
): Promise<void> => {
  const tw = getTronWeb();
  const tokenBase58 = tronHexToBase58(tokenHexAddress);
  const spenderBase58 = tronHexToBase58(spenderHexAddress);

  const { transaction: approveTx } =
    await tw.transactionBuilder.triggerSmartContract(
      tokenBase58,
      APPROVE_FUNC,
      { feeLimit: TRON_FEE_LIMIT_SUN },
      [
        { type: "address", value: spenderBase58 },
        { type: "uint256", value: amount.toString() },
      ],
      fromBase58,
    );

  const signed = await tw.trx.sign(approveTx);
  const result = await tw.trx.sendRawTransaction(signed);
  if (!result.result) {
    const msg = result.message
      ? Buffer.from(result.message as string, "hex").toString()
      : "Approve failed";
    throw new Error(`TRC20 approve failed: ${msg}`);
  }
  await waitForTronConfirmation(result.txid ?? signed.txID);
};

/** Sign and broadcast a raw Tron transaction, returning the txid */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const broadcastRawTronTx = async (transaction: any): Promise<string> => {
  const tw = getTronWeb();
  const signed = await tw.trx.sign(transaction);
  const result = await tw.trx.sendRawTransaction(signed);
  if (!result.result) {
    const msg = result.message
      ? Buffer.from(result.message as string, "hex").toString()
      : "Transaction failed";
    throw new Error(`Tron broadcast failed: ${msg}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txid: string = result.txid ?? (result as any).transaction?.txID;
  if (!txid) throw new Error("Tron broadcast failed: no txid returned");
  return txid;
};

/**
 * Approve ERC20 (if needed) and broadcast the Tron deposit transaction.
 * txData is the raw Tron Transaction object returned by the /deposit endpoint.
 */
export const approveAndBroadcastTronDepositTx = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txData: any,
  amount: bigint,
  tokenHexAddress: string,
  fromBase58: string,
): Promise<string> => {
  // Tron tx has no `to`; the spender is the contract the deposit tx calls
  const spenderHex: string | undefined =
    txData?.raw_data?.contract?.[0]?.parameter?.value?.contract_address;
  if (!spenderHex) throw new Error("Invalid Tron deposit tx: missing contract_address");

  let depositTx = txData;
  if (tokenHexAddress !== zeroAddress) {
    const allowance = await getTronErc20Allowance(tokenHexAddress, fromBase58, spenderHex);
    if (allowance < amount) {
      await approveTronToken(tokenHexAddress, spenderHex, amount, fromBase58);
      // Server-built tx expires ~60s after creation; the approve round-trip can outlast it
      depositTx = await getTronWeb().transactionBuilder.extendExpiration(txData, TRON_EXPIRATION_EXTENSION_SEC);
    }
  }

  const txid = await broadcastRawTronTx(depositTx);
  await waitForTronConfirmation(txid);
  return txid;
};

/**
 * Parse base64-encoded Tron transaction (from /private-send serializedTx),
 * optionally approve, then broadcast.
 */
export const approveAndBroadcastTronSerializedTx = async (
  serializedTxBase64: string,
  approvalAddress: string | null,
  amount: bigint,
  tokenHexAddress: string,
  fromBase58: string,
): Promise<string> => {
  if (approvalAddress) {
    await approveTronToken(tokenHexAddress, approvalAddress, amount, fromBase58);
  }

  const raw = Buffer.from(serializedTxBase64, "base64").toString("utf8");
  const transaction = JSON.parse(raw);
  return broadcastRawTronTx(transaction);
};

const ERC20_BALANCE_OF_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
];

/** Fetch TRX (native) balance for a Tron address, returns raw units (sun) */
export const getTronNativeBalance = async (address: string): Promise<bigint> => {
  const tw = getTronWeb();
  const balance = await tw.trx.getBalance(address);
  return BigInt(balance);
};

/** Fetch TRC20 token balance for a Tron address */
export const getTronErc20Balance = async (
  tokenHexAddress: string,
  ownerAddress: string,
): Promise<bigint> => {
  const tw = getTronWeb();
  const tokenBase58 = tronHexToBase58(tokenHexAddress);
  const contract = await tw.contract(ERC20_BALANCE_OF_ABI, tokenBase58);
  const balance = await contract.balanceOf(ownerAddress).call({ from: ownerAddress });
  return BigInt(String(balance));
};

const ERC20_ALLOWANCE_ABI = [
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    type: "function",
  },
];

/** Fetch TRC20 allowance granted by owner to spender */
export const getTronErc20Allowance = async (
  tokenHexAddress: string,
  ownerAddress: string,
  spenderHexAddress: string,
): Promise<bigint> => {
  const tw = getTronWeb();
  const contract = await tw.contract(ERC20_ALLOWANCE_ABI, tronHexToBase58(tokenHexAddress));
  const allowance = await contract
    .allowance(ownerAddress, tronHexToBase58(spenderHexAddress))
    .call({ from: ownerAddress });
  return BigInt(String(allowance));
};

/** Wait for a Tron transaction to be included in a block (polls fullnode tx info) */
export const waitForTronConfirmation = async (
  txid: string,
  timeoutMs = 120_000,
): Promise<void> => {
  const tw = getTronWeb();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Fullnode query: returns once included in a block, unlike getTransactionInfo which waits for solidification
    const info: any = await tw.trx.getUnconfirmedTransactionInfo(txid);
    if (info?.receipt) {
      if (info.receipt.result && info.receipt.result !== "SUCCESS") {
        throw new Error(`Tron transaction ${txid} failed: ${info.receipt.result}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Tron transaction ${txid} not confirmed within timeout`);
};
