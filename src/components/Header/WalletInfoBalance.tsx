import { useMemo } from "react";
import { useAppContext } from "../../AppContext";
import { TokenBalance } from "../../types";
import { getAmountInToken } from "../../utils/amount.utils";

interface WalletInfoBalanceProps {
  tokenBalance: TokenBalance;
}

export const WalletInfoBalance = ({ tokenBalance }: WalletInfoBalanceProps) => {
  const { erc20List } = useAppContext();

  const token = useMemo(
    () =>
      erc20List.find(
        (token) => token.erc20TokenAddress === tokenBalance.tokenAddress,
      ),
    [erc20List, tokenBalance.tokenAddress],
  );

  const amount = useMemo(
    () => (token ? Number(getAmountInToken(token, tokenBalance.balance)) : 0),
    [token, tokenBalance.balance],
  );

  const display =
    amount === 0 ? "0" : amount < 0.0001 ? "<0.0001" : amount.toFixed(4);
  return (
    <div className="flex items-center space-x-4">
      <div>
        <img src={token?.logoURI} alt="tokenIcon" className="w-[26px]" />
      </div>
      <div>
        <p className="text-white text-[18px] font-semibold">
          {display} {token?.symbol}
        </p>
      </div>
    </div>
  );
};
