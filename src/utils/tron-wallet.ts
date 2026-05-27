export const TRON_NILE_CHAIN_ID = 3448148188;
export const TRON_MAINNET_CHAIN_ID = 728126428;

const TRON_FEE_LIMIT_SUN = 1_000_000_000;

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
  // The deposit txData.to field is the spender (depositOnChainUtxos contract) in EVM hex
  const spenderHex: string | undefined = txData?.to;
  if (spenderHex) {
    await approveTronToken(tokenHexAddress, spenderHex, amount, fromBase58);
  }

  // txData itself is the Tron Transaction object (has raw_data)
  return broadcastRawTronTx(txData);
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

/** Wait for a Tron transaction to be confirmed (polls getTransactionInfo) */
export const waitForTronConfirmation = async (
  txid: string,
  timeoutMs = 120_000,
): Promise<void> => {
  const tw = getTronWeb();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await tw.trx.getTransactionInfo(txid);
    if (info?.receipt) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Tron transaction ${txid} not confirmed within timeout`);
};
