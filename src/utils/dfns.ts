import { DfnsApiClient, DfnsError } from "@dfns/sdk";
import { WebAuthnSigner } from "@dfns/sdk-browser";
import { DfnsWallet } from "@dfns/lib-ethersjs6";
import { ethers } from "ethers";
import { dfnsConfig } from "../constants";

const { orgId, apiUrl, relyingParty } = dfnsConfig;
const getSigner = () => new WebAuthnSigner({ relyingParty });
const dfnsApi = (authToken?: string) =>
  new DfnsApiClient({ orgId, authToken, baseUrl: apiUrl, signer: getSigner() });

const register = async (body: {
  orgId: string;
  socialLoginProviderKind: "Oidc";
  idToken: string;
}): Promise<string> => {
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

/**
 * Google OIDC login; registers if the user is new (401/404). A user who canceled
 * passkey setup before is stranded `Invited`: socialLogin succeeds but has no
 * credential, so listing wallets is denied — fall back to registration to finish.
 */
const socialLoginOrRegister = async (idToken: string): Promise<string> => {
  const body = { orgId, socialLoginProviderKind: "Oidc", idToken } as const;
  try {
    const token = (await dfnsApi().auth.socialLogin({ body })).token;
    await dfnsApi(token).wallets.listWallets();
    return token;
  } catch (err) {
    const status = err instanceof DfnsError ? err.httpStatus : undefined;
    if (status !== 401 && status !== 403 && status !== 404) throw err;
  }
  return register(body);
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
