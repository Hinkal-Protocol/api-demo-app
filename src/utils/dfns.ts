import { DfnsApiClient, DfnsError } from "@dfns/sdk";
import { WebAuthnSigner } from "@dfns/sdk-browser";
import { DfnsWallet } from "@dfns/lib-ethersjs6";
import { ethers } from "ethers";
import { dfnsConfig } from "../constants";

const { orgId, apiUrl, relyingParty } = dfnsConfig;
const getSigner = () => new WebAuthnSigner({ relyingParty });
const dfnsApi = (authToken?: string) =>
  new DfnsApiClient({ orgId, authToken, baseUrl: apiUrl, signer: getSigner() });

/** Google OIDC login; registers a passkey + Ethereum wallet if the user is new (401/404). */
const socialLoginOrRegister = async (idToken: string): Promise<string> => {
  const body = { orgId, socialLoginProviderKind: "Oidc", idToken } as const;
  try {
    return (await dfnsApi().auth.socialLogin({ body })).token;
  } catch (err) {
    const status = err instanceof DfnsError ? err.httpStatus : undefined;
    if (status !== 401 && status !== 404) throw err;
  }

  const challenge = await dfnsApi().auth.createSocialRegistrationChallenge({ body });
  const { authentication } = await dfnsApi(
    challenge.temporaryAuthenticationToken,
  ).auth.registerEndUser({
    body: {
      firstFactorCredential: await getSigner().create(challenge),
      wallets: [{ network: "Ethereum" }],
    },
  });
  return authentication.token;
};

/** Google idToken -> auth token -> the user's Ethereum wallet -> DfnsWallet signer. */
export const connectDfns = async (idToken: string) => {
  const client = dfnsApi(await socialLoginOrRegister(idToken));
  const { items } = await client.wallets.listWallets();
  const wallet = items.find(
    (w) => w.address?.match(/^0x[0-9a-fA-F]{40}$/) && w.status === "Active",
  );
  if (!wallet) throw new Error("No active DFNS Ethereum wallet found");

  return {
    wallet: await DfnsWallet.init({ walletId: wallet.id, dfnsClient: client }),
    address: ethers.getAddress(wallet.address!),
  };
};
