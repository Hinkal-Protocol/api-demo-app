import { Fragment } from "react";
import { Popover, Transition } from "@headlessui/react";
import VectorDown from "../../../assets/VectorDown.svg";
import { WalletInfoDropDown } from "../WalletInfoDropDown";
import { shortenAddress } from "../../../utils/shortenAddress";

type WalletSettingsBodyProps = {
  open: boolean;
  shieldedAddress?: string;
};

export const WalletSettingsBody = ({
  open,
  shieldedAddress,
}: WalletSettingsBodyProps) => {
  return (
    <>
      <Popover.Button
        as="button"
        type="button"
        className="flex flex-row gap-2 items-center border-[2px] border-solid border-primary rounded-xl text-white text-base py-3 px-4 relative z-20 transition-all duration-300 hover:border-hinkal-purple-200"
      >
        <span>{shortenAddress(shieldedAddress ?? "")}</span>

        <div
          className={`hidden min-[375px]:block transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          <VectorDown />
        </div>
      </Popover.Button>
      <Transition
        show={open}
        as={Fragment}
        enter="transition ease-out duration-300"
        enterFrom="opacity-0 -translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-200"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-2"
      >
        <Popover.Panel static className="md:relative z-20">
          <WalletInfoDropDown />
        </Popover.Panel>
      </Transition>
    </>
  );
};
