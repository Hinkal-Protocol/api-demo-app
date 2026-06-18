import { ToggleSwitch } from "../withdraw/ToggleSwitch";

interface AuthModeToggleProps {
  useEIP712Enabled: boolean;
  onToggle: () => void;
}

export const AuthModeToggle = ({
  useEIP712Enabled,
  onToggle,
}: AuthModeToggleProps) => (
  <div className="px-5 pb-2 pt-3 flex items-center justify-between gap-3">
    <div className="text-sm text-white">
      <p className="font-semibold">EIP-712 auth mode</p>
      <p className="text-hinkal-gray-100 text-xs mt-0.5">
        {useEIP712Enabled
          ? "Sign each transaction with EIP-712"
          : "Normal mode"}
      </p>
    </div>
    <ToggleSwitch isOff={!useEIP712Enabled} setIsOff={() => onToggle()} />
  </div>
);
