import { useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Spinner } from "../Spinner";
import { connectUtila } from "../../utils/utila";
import type { UtilaCreds, UtilaWallet } from "../../utils/utila";
import { getFriendlyErrorMessage } from "../../utils/errors";

interface UtilaOverlayProps {
  onClose: () => void;
  onConnect: (creds: UtilaCreds, wallet: UtilaWallet) => void;
}

const inputClass =
  "w-full rounded-lg border-[2.5px] border-hinkal-gray-400 bg-hinkal-blue-900 px-3 py-2 text-sm text-white placeholder:text-hinkal-gray-100 outline-none focus:border-hinkal-lavender-200";

export const UtilaOverlay = ({
  onClose,
  onConnect,
}: UtilaOverlayProps): ReactElement => {
  const [email, setEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<UtilaWallet[] | null>(null);

  const creds: UtilaCreds = { email: email.trim(), privateKey: privateKey.trim() };

  const handleFetchWallets = async () => {
    if (!creds.email || !creds.privateKey) {
      toast.error("Enter service-account email and private key");
      return;
    }
    setLoading(true);
    try {
      const { wallets: found } = await connectUtila(creds);
      if (!found.length) throw new Error("No EVM wallets found in this vault");
      setWallets(found);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Utila connection failed"));
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (wallet: UtilaWallet) => {
    onClose();
    onConnect(creds, wallet);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#000000cc] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[340px] rounded-[10px] border border-hinkal-gray-400 bg-hinkal-blue-300 px-5 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-2 top-2 text-white hover:text-hinkal-white-300"
          onClick={onClose}
        >
          <i className="bi bi-x text-[22px]" />
        </button>

        <h3 className="mb-4 pt-3 text-center font-bold text-white">
          Connect Utila
        </h3>

        {!wallets ? (
          <div className="flex flex-col gap-y-3">
            <input
              className={inputClass}
              type="email"
              placeholder="Service-account email"
              value={email}
              autoComplete="off"
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
            />
            <textarea
              className={`${inputClass} h-28 resize-none font-mono text-[11px]`}
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={privateKey}
              disabled={loading}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
            <button
              type="button"
              className="mt-1 flex items-center justify-center gap-x-2 rounded-lg border-[2.5px] border-[#f0f0f0] bg-modal px-4 py-2 font-bold text-white duration-150 hover:border-[#9c9c9c] disabled:opacity-50"
              disabled={loading}
              onClick={handleFetchWallets}
            >
              Continue
              {loading && <Spinner />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-y-3">
            <p className="text-center text-sm text-hinkal-gray-100">
              Select a wallet
            </p>
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                type="button"
                className="flex flex-col items-start rounded-lg border-[2.5px] border-[#f0f0f0] bg-modal px-4 py-2 text-left duration-150 hover:border-[#9c9c9c]"
                onClick={() => handlePick(wallet)}
              >
                <span className="font-bold text-white">
                  {wallet.displayName}
                </span>
                <span className="font-mono text-[11px] text-hinkal-gray-100">
                  {wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) as ReactElement;
};
