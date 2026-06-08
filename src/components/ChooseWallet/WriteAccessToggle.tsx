import { ToggleSwitch } from "../withdraw/ToggleSwitch";

interface WriteAccessToggleProps {
  writeAccessEnabled: boolean;
  onToggle: () => void;
}

export const WriteAccessToggle = ({
  writeAccessEnabled,
  onToggle,
}: WriteAccessToggleProps) => (
  <div className="px-5 pb-2 pt-3 flex items-center justify-between gap-3">
    <div className="text-sm text-white">
      <p className="font-semibold">24h session for transactions</p>
      <p className="text-hinkal-gray-100 text-xs mt-0.5">
        {writeAccessEnabled
          ? "Reuse one signature for txs for 24 hours"
          : "Read-only session; each tx requires a new signature"}
      </p>
    </div>
    <ToggleSwitch isOff={!writeAccessEnabled} setIsOff={() => onToggle()} />
  </div>
);
