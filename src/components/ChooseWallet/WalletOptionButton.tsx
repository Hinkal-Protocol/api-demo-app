import { ReactNode } from "react";
import { Spinner } from "../Spinner";

type WalletOptionButtonVariant = "social" | "extension";

const variantClasses: Record<WalletOptionButtonVariant, string> = {
  social:
    "bg-modal px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-[#f0f0f0] hover:border-[#9c9c9c] font-bold duration-150 flex items-center justify-center gap-x-3",
  extension:
    "bg-hinkal-blue-900 text-white px-4 py-2 min-w-[180px] w-[80%] rounded-lg border-[2.5px] border-hinkal-blue-200 hover:border-hinkal-lavender-200 hover:bg-hinkal-blue-200 font-bold transition-all duration-300 flex items-center justify-start gap-x-3",
};

interface WalletOptionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: WalletOptionButtonVariant;
  icon?: ReactNode;
}

export const WalletOptionButton = ({
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = "extension",
  icon,
}: WalletOptionButtonProps) => (
  <button
    type="button"
    className={variantClasses[variant]}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
    <span className={variant === "social" ? "text-white" : undefined}>
      {label}
    </span>
    {loading && <Spinner />}
  </button>
);
