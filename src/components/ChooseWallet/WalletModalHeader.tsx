import { WalletModalView } from "./types";

interface WalletModalHeaderProps {
  view: WalletModalView;
  connecting: boolean;
  onBack: () => void;
}

export const WalletModalHeader = ({
  view,
  connecting,
  onBack,
}: WalletModalHeaderProps) => (
  <div className="flex items-center gap-3 p-5 pb-0">
    {view === WalletModalView.Social && (
      <button
        type="button"
        aria-label="Back"
        className="text-white text-xl leading-none hover:text-hinkal-gray-100"
        disabled={connecting}
        onClick={onBack}
      >
        ‹
      </button>
    )}
    <h1 className="font-[500] text-2xl text-white">
      {view === WalletModalView.Social ? "Social Login" : "Select Wallet"}
    </h1>
  </div>
);
