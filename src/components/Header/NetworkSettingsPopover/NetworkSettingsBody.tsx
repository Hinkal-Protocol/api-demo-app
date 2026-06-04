import { Fragment } from "react";
import { Popover, Transition } from "@headlessui/react";
import VectorDown from "../../../assets/VectorDown.svg";
import { NetworkSettingsDropdown } from "./NetworkSettingsDropdown";
import { useAppContext } from "../../../AppContext";

type NetworkSettingsBodyProps = {
  open: boolean;
};
export const NetworkSettingsBody = ({ open }: NetworkSettingsBodyProps) => {
  const { selectedNetwork, isTron } = useAppContext();
  if (isTron) {
    return (
      <div className="rounded-[12px] text-white font-semibold flex items-center gap-2 px-3 min-[375px]:px-4 py-[0.875rem] text-base bg-hinkal-blue-200">
        <div>{selectedNetwork?.name || "Unsupported Network"}</div>
      </div>
    );
  }

  return (
    <>
      <Popover.Button
        as="button"
        type="button"
        className="rounded-[12px] text-white font-semibold flex items-center gap-2 cursor-pointer transition-all duration-300 hover:bg-hinkal-blue-900 px-3 min-[375px]:px-4 py-[0.875rem] text-base bg-hinkal-blue-200 relative z-20"
      >
        {!selectedNetwork && (
          <i className="bi bi-exclamation-triangle text-white" />
        )}

        <div>{selectedNetwork?.name || "Unsupported"}</div>
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
          {({ close }) => <NetworkSettingsDropdown close={close} />}
        </Popover.Panel>
      </Transition>
    </>
  );
};
