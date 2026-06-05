import { SetStateAction, useState } from "react";
import TolleranceDetailsImage from "../../assets/QuestionIcon.png";
import { Modal } from "../Modal";

interface SwapSettingsDropdownInterface {
  slippageTolerance: string;
  setSlippageTollerance: (param: SetStateAction<string>) => void;
  swapSettingsDropdownShown: boolean;
  setSwapSettingsDropdownShown: (param: SetStateAction<boolean>) => void;
}

export const SwapSettingsDropdown = ({
  slippageTolerance,
  setSlippageTollerance,
  swapSettingsDropdownShown,
  setSwapSettingsDropdownShown,
}: SwapSettingsDropdownInterface) => {
  const [showTolleranceDetails, setShowTolleranceDetails] = useState(false);
  const [isAutoTolleranceSelected, setIsAutoTolleranceSelected] =
    useState(true);

  const MIN_SLIPPAGE = 0.3;
  const MAX_SLIPPAGE = 3;

  const setTokenAmountHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
    setValue: (param: SetStateAction<string>) => void,
  ) => {
    const regExp = /^[0-9]*[.]?[0-9]*$/;
    const next = event.target.value;
    if (!regExp.test(next)) return;
    // Block values above the cap while typing; min is enforced on blur so
    // partial input like "0." isn't rejected mid-typing.
    if (next !== "" && Number(next) > MAX_SLIPPAGE) return;
    setValue(next);
    if (isAutoTolleranceSelected) setIsAutoTolleranceSelected(false);
  };

  const clampMinOnBlur = () => {
    if (slippageTolerance === "" || Number(slippageTolerance) < MIN_SLIPPAGE) {
      setSlippageTollerance(MIN_SLIPPAGE.toFixed(2));
    }
  };

  return (
    <Modal
      isOpen={swapSettingsDropdownShown}
      xBtnAction={() => setSwapSettingsDropdownShown(false)}
      styleProps="md:w-[24.9%] left-[50%] md:left-[50%] -translate-x-1/2 top-[50%] rounded-[13px] bg-transparent "
    >
      <div className="text-white font-poppins bg-hinkal-blue-300 rounded-[13px] p-2">
        <p className="pl-2 text-[16px] font-[600]">Settings</p>
        <div className="p-2">
          <div className="flex gap-x-2">
            <p className="text-[15px] font-[400]">Slippage tolerance</p>
            <div className="flex-1 flex items-center gap-x-3 relative">
              {showTolleranceDetails ? (
                <div className="absolute z-[99] top-[32px] text-white font-[300] text-[10px] md:text-[11px] mb-8 flex items-start">
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setTimeout(() => {
                        setShowTolleranceDetails(true);
                      }, 100);
                    }}
                    onMouseOut={() => {
                      setTimeout(() => {
                        setShowTolleranceDetails(false);
                      }, 100);
                    }}
                    className="conversationBubble cursor-default text-left "
                  >
                    Your transaction will revert if the price changes
                    unfavorably by more than this percentage.
                  </button>
                </div>
              ) : (
                <></>
              )}
              <button
                type="button"
                onMouseEnter={() => setShowTolleranceDetails(true)}
                onMouseOut={() => {
                  setTimeout(() => {
                    setShowTolleranceDetails(false);
                  }, 100);
                }}
              >
                <img src={TolleranceDetailsImage} alt="" />
              </button>
            </div>
          </div>
          <div className="flex gap-x-2 h-9 items-center justify-start mt-2 ">
            <button
              type="button"
              onClick={() => {
                setIsAutoTolleranceSelected(true);
                setSlippageTollerance("0.30");
              }}
              className={` font-[400] border-[1px] border-solid border-primary text-[16px] rounded-xl h-full px-3 transition-all duration-300 hover:bg-hinkal-purple-200 ${
                isAutoTolleranceSelected
                  ? "bg-primary"
                  : "bg-modalBG border-primary"
              } `}
            >
              Auto
            </button>
            <input
              type="text"
              placeholder="0.10"
              className={
                "bg-hinkal-blue-900 w-full h-full text-white text-[14px] rounded-lg px-[25px] outline-none text-right "
              }
              onChange={(event) =>
                setTokenAmountHandler(event, setSlippageTollerance)
              }
              value={slippageTolerance === "0.10" ? "" : slippageTolerance}
            />
            <span className="absolute right-[22px] text-[14px]">%</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
