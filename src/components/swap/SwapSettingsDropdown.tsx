import {
  SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import TolleranceDetailsImage from "../../assets/QuestionIcon.png";
import { Modal } from "../Modal";
import toast from "react-hot-toast";

const MIN_SLIPPAGE = 0.001;
const MAX_SLIPPAGE = 3;
const AUTO_SLIPPAGE = "0.30";

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
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const toleranceInfoRef = useRef<HTMLButtonElement>(null);

  const getSlippageValidationError = useCallback((value: string) => {
    if (value.trim() === "") {
      return "Slippage tolerance cannot be empty";
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      return "Enter a valid slippage tolerance";
    }
    if (num < MIN_SLIPPAGE) {
      return `Slippage tolerance must be at least ${MIN_SLIPPAGE}%`;
    }
    if (num > MAX_SLIPPAGE) {
      return `Slippage tolerance must be at most ${MAX_SLIPPAGE}%`;
    }
    return null;
  }, []);

  useLayoutEffect(() => {
    if (!showTolleranceDetails || !toleranceInfoRef.current) {
      setTooltipPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = toleranceInfoRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showTolleranceDetails]);

  const setTokenAmountHandler = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>,
      setValue: (param: SetStateAction<string>) => void,
    ) => {
      const regExp = /^[0-9]*[.]?[0-9]*$/;
      const next = event.target.value;
      if (!regExp.test(next)) return;
      // Block values above the cap while typing; min is validated on close.
      if (next !== "" && Number(next) > MAX_SLIPPAGE) return;
      setValue(next);
      if (isAutoTolleranceSelected) setIsAutoTolleranceSelected(false);
    },
    [isAutoTolleranceSelected],
  );

  const handleCloseModal = useCallback(() => {
    const error = getSlippageValidationError(slippageTolerance);
    if (error) {
      toast.error(error);
      return;
    }
    setSwapSettingsDropdownShown(false);
  }, [
    getSlippageValidationError,
    slippageTolerance,
    setSwapSettingsDropdownShown,
  ]);

  return (
    <>
      <Modal
        isOpen={swapSettingsDropdownShown}
        xBtnAction={handleCloseModal}
        styleProps="md:w-[24.9%] left-[50%] md:left-[50%] -translate-x-1/2 top-[50%] rounded-[13px] bg-transparent "
      >
        <div className="text-white font-poppins bg-hinkal-blue-300 rounded-[13px] p-2">
          <p className="pl-2 text-[16px] font-[600]">Settings</p>
          <div className="p-2">
            <div className="flex gap-x-2">
              <p className="text-[15px] font-[400]">Slippage tolerance</p>
              <div className="flex-1 flex items-center justify-end gap-x-3">
                <button
                  ref={toleranceInfoRef}
                  type="button"
                  onMouseEnter={() => setShowTolleranceDetails(true)}
                  onMouseOut={() => {
                    setTimeout(() => {
                      setShowTolleranceDetails(false);
                    }, 100);
                  }}
                >
                  <img
                    src={TolleranceDetailsImage}
                    alt="Slippage tolerance info"
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-x-2 h-9 items-center justify-start mt-2 ">
              <button
                type="button"
                onClick={() => {
                  setIsAutoTolleranceSelected(true);
                  setSlippageTollerance(AUTO_SLIPPAGE);
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
                placeholder="Enter percentage"
                className={
                  "bg-hinkal-blue-900 w-full h-full text-white text-[14px] rounded-lg px-[25px] outline-none text-right "
                }
                onChange={(event) =>
                  setTokenAmountHandler(event, setSlippageTollerance)
                }
                value={slippageTolerance}
              />
              <span className="absolute right-[22px] text-[14px]">%</span>
            </div>
          </div>
        </div>
      </Modal>
      {showTolleranceDetails &&
        tooltipPosition &&
        createPortal(
          <div
            className="fixed z-[9999] w-max max-w-[220px] -translate-x-1/2 -translate-y-full pointer-events-none text-white font-[300] text-[10px] md:text-[11px]"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
          >
            <div className="conversationBubble conversationBubble--arrow-bottom cursor-default text-left">
              Your transaction will revert if the price changes unfavorably by
              more than this percentage.
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
