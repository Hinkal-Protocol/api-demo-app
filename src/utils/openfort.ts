import { ethers } from "ethers";
import {
  Openfort,
  AccountTypeEnum,
  ChainTypeEnum,
  RecoveryMethod,
  EmbeddedState,
} from "@openfort/openfort-js";
import {
  OPENFORT_PUBLISHABLE_KEY,
  OPENFORT_SHIELD_PUBLISHABLE_KEY,
} from "../constants";
import { SUPPORTED_CHAINS } from "../constants/supported-chain-ids.constants";

let client: Openfort | null = null;

const getClient = (): Openfort => {
  if (!OPENFORT_PUBLISHABLE_KEY || !OPENFORT_SHIELD_PUBLISHABLE_KEY) {
    throw new Error("Openfort keys are not configured (VITE_OPENFORT_*)");
  }
  client ??= new Openfort({
    baseConfiguration: { publishableKey: OPENFORT_PUBLISHABLE_KEY },
    shieldConfiguration: {
      shieldPublishableKey: OPENFORT_SHIELD_PUBLISHABLE_KEY,
    },
  });
  return client;
};

/** Sends a one-time login code to the email. */
export const requestOpenfortOtp = async (email: string): Promise<void> => {
  const openfort = getClient();
  await openfort.auth.logout().catch(() => {});
  await openfort.auth.requestEmailOtp({ email: email.trim() });
};

/** Verifies the OTP, ensures an EOA embedded wallet, and returns an ethers signer. */
export const loginOpenfort = async (
  email: string,
  otp: string,
  chainId: number,
): Promise<{ signer: ethers.Signer; address: string }> => {
  const openfort = getClient();
  await openfort.auth.logInWithEmailOtp({
    email: email.trim(),
    otp: otp.trim(),
  });

  const state = await openfort.embeddedWallet.getEmbeddedState();
  if (state !== EmbeddedState.READY) {
    await openfort.embeddedWallet.configure({
      chainType: ChainTypeEnum.EVM,
      accountType: AccountTypeEnum.EOA,
      recoveryParams: {
        recoveryMethod: RecoveryMethod.PASSWORD,
        password: "hinkal-demo-openfort",
      },
    });
  }

  return buildSigner(chainId);
};

/** Clears the Openfort session and cached client (call on disconnect). */
export const logoutOpenfort = async (): Promise<void> => {
  if (!client) return;
  await client.auth.logout().catch(() => {});
  client = null;
};

/** Builds an ethers signer for a chain (also used on chain switch). */
export const buildSigner = async (
  chainId: number,
): Promise<{ signer: ethers.Signer; address: string }> => {
  const provider = await getClient().embeddedWallet.getEthereumProvider({
    chains: Object.fromEntries(
      SUPPORTED_CHAINS.map((c) => [c.id, c.rpcUrls.default.http[0]]),
    ),
  });

  await provider
    .request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
    .catch(() => {});

  const signer = await new ethers.BrowserProvider(
    provider as unknown as ethers.Eip1193Provider,
  ).getSigner();
  return { signer, address: await signer.getAddress() };
};
