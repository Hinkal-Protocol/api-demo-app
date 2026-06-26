import { useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { getFriendlyErrorMessage } from "../../utils/errors";
import { WalletOptionButton } from "./WalletOptionButton";

interface OpenfortOverlayProps {
  onClose: () => void;
  onRequestOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, otp: string) => Promise<void>;
}

export const OpenfortOverlay = ({
  onClose,
  onRequestOtp,
  onVerifyOtp,
}: OpenfortOverlayProps): ReactElement => {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const sendCode = async () => {
    setLoading(true);
    try {
      await onRequestOtp(email);
      setStep("otp");
      toast.success("Code sent — check your email");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      await onVerifyOtp(email, otp);
      onClose();
    } catch {
      // toast shown upstream
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-hinkal-blue-900 text-white border-[2px] border-hinkal-blue-200 focus:border-hinkal-lavender-200 outline-none text-sm";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#000000cc] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative rounded-[10px] border border-hinkal-gray-400 bg-hinkal-blue-300 px-5 pb-6 pt-4 min-w-[300px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-2 top-2 text-white hover:text-hinkal-white-300"
          onClick={onClose}
        >
          <i className="bi bi-x text-[22px]" />
        </button>

        <p className="pt-6 pb-4 text-center text-white font-bold">
          Sign in with Openfort
        </p>

        <div className="flex flex-col items-center gap-y-3">
          {step === "email" ? (
            <>
              <input
                className={inputClass}
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <WalletOptionButton
                label="Send code"
                loading={loading}
                disabled={loading || !email.includes("@")}
                onClick={sendCode}
              />
            </>
          ) : (
            <>
              <input
                className={inputClass}
                placeholder="Enter code from email"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
              />
              <WalletOptionButton
                label="Verify & connect"
                loading={loading}
                disabled={loading || !otp}
                onClick={verify}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) as ReactElement;
};
