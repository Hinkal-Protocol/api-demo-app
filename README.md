# api-react-demo-app

A React + Vite demo for the Hinkal privacy protocol. It shows how to connect a
range of wallet providers, build an enclave session, and run shielded
**deposit, transfer, withdraw, swap, and multi-send** flows across EVM, Solana,
and Tron networks.

---

### Prerequisites

- Node.js 18+
- `yarn` (or `npm`)

### Install

```bash
yarn
# or
npm install
```

### Configure environment

Copy the example file and fill in the values for the providers you want to use:

```bash
cp .env.example .env
```

You only need keys for the providers you intend to test. Any provider left
unconfigured simply shows a toast when its button is clicked, so you can start
with a single provider and add others later.

### Run

```bash
yarn dev
```


---

## Environment variables

All variables are read at build time via Vite and must be prefixed with
`VITE_`. Each one falls back to an empty string when unset; instead of crashing,
the app surfaces the missing key at the point of use.

| Variable                            | Used by         | Required for                              |
| ----------------------------------- | --------------- | ----------------------------------------- |
| `VITE_ALCHEMY_API_KEY`              | RPC (all EVM)   | All EVM RPC calls. Warns once at startup if missing. |
| `VITE_DYNAMIC_ENVIRONMENT_ID`       | Dynamic         | "Continue with Dynamic"                   |
| `VITE_TURNKEY_ORGANIZATION_ID`      | Turnkey         | "Continue with Turnkey"                   |
| `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID` | Turnkey         | "Continue with Turnkey"                   |
| `VITE_DFNS_ORG_ID`                  | DFNS            | "Continue with DFNS"                      |
| `VITE_DFNS_GOOGLE_OAUTH_CLIENT_ID`  | DFNS            | "Continue with DFNS" (Google login)       |
| `VITE_DFNS_RP_ID`                   | DFNS            | Passkey relying-party id (e.g. `localhost`) |
| `VITE_DFNS_RP_NAME`                 | DFNS            | Passkey relying-party name (e.g. `Hinkal`)  |

> Notes
>
> - **Alchemy** powers RPC for every EVM chain, so a missing key affects the
>   whole app rather than a single wallet — it is reported with a one-time
>   startup toast.
> - **Dynamic** is only mounted (and only fails) when its environment id is set;
>   otherwise the button toasts that it is not configured.
> - **DFNS** builds its WebAuthn signer lazily, so a missing DFNS config does
>   not crash the app on load.
> - **Privy** uses a hard-coded app id and needs no env var.

---

## Project structure

```
src/
├── App.tsx                 # Root layout + tabs (Deposit / Transfer / ...)
├── main.tsx                # Provider tree (Google, Dynamic, Privy, Turnkey, wagmi, ...)
├── constants.ts            # Provider configs + isWalletConfigured helpers
├── constants/              # Chain registry, supported chains, token data
├── pages/                  # Deposit, Transfer, Withdraw, Swap, MultiSend
├── components/             # UI, including ChooseWallet/* connection flows
├── utils/                  # Wallet + session helpers (dfns, ethers-wallet, solana, tron, ...)
└── hooks/                  # Shared React hooks
```

Wallet connection logic lives in
[`src/components/ChooseWallet/`](src/components/ChooseWallet/), with the
per-provider connect handlers in
[`useChooseWalletConnections.ts`](src/components/ChooseWallet/useChooseWalletConnections.ts).
