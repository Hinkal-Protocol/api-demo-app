import { type ReactElement } from "react";
import { createPortal } from "react-dom";
import { GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";

interface DfnsGoogleOverlayProps {
  onClose: () => void;
  onConnect: (credential: string) => void;
}

export const DfnsGoogleOverlay = ({
  onClose,
  onConnect,
}: DfnsGoogleOverlayProps): ReactElement =>
  createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#000000cc] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative rounded-[10px] border border-hinkal-gray-400 bg-hinkal-blue-300 px-5 pb-5 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-2 top-2 text-white hover:text-hinkal-white-300"
          onClick={onClose}
        >
          <i className="bi bi-x text-[22px]" />
        </button>
        <div className="pt-5 flex justify-center min-w-[280px]">
          <GoogleLogin
            theme="filled_black"
            size="large"
            text="continue_with"
            width={280}
            onSuccess={(res) => {
              onClose();
              res.credential
                ? onConnect(res.credential)
                : toast.error("Google sign-in returned no credential");
            }}
            onError={() => toast.error("Google sign-in failed")}
          />
        </div>
      </div>
    </div>,
    document.body,
  ) as ReactElement;
