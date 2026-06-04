import { SetStateAction, useState } from "react";
import { SwapSettingsDropdown } from "./SwapSettingsDropdown";

interface SwapSettingsInterface {
  slippageTolerance: string;
  setSlippageTollerance: (param: SetStateAction<string>) => void;
}

export const SwapSettings = ({
  slippageTolerance,
  setSlippageTollerance,
}: SwapSettingsInterface) => {
  const [swapSettingsDropdownShown, setSwapSettingsDropdownShown] =
    useState(false);

  return (
    <>
      <button
        type="button"
        className="text-white hover:text-hinkal-purple-200 transition-colors duration-300"
        onClick={() => {
          setSwapSettingsDropdownShown(true);
        }}
      >
        <i className="bi bi-gear" />
      </button>
      <SwapSettingsDropdown
        slippageTolerance={slippageTolerance}
        setSlippageTollerance={setSlippageTollerance}
        swapSettingsDropdownShown={swapSettingsDropdownShown}
        setSwapSettingsDropdownShown={setSwapSettingsDropdownShown}
      />
    </>
  );
};
