import { ToggleSwitch } from "../withdraw/ToggleSwitch";

interface RequestSigningToggleProps {
  useKeySign: boolean;
  onToggle: () => void;
}

export const RequestSigningToggle = ({
  useKeySign,
  onToggle,
}: RequestSigningToggleProps) => (
  <div className="px-5 pb-2 flex items-center justify-between gap-3">
    <div className="text-sm text-white">
      <p className="font-semibold">Request signing</p>
      <p className="text-hinkal-gray-100 text-xs mt-0.5">
        {useKeySign
          ? "Each request signed with a session keypair"
          : "Requests authenticated by session signature only"}
      </p>
    </div>
    <ToggleSwitch isOff={!useKeySign} setIsOff={() => onToggle()} />
  </div>
);
