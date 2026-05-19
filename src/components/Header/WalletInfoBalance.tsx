import { TokenBalance } from "../../types";
import { getAmountInToken } from "../../utils/amount.utils";

interface WalletInfoBalanceProps {
  tokenBalance: TokenBalance;
}

export const WalletInfoBalance = ({ tokenBalance }: WalletInfoBalanceProps) => {
  const amount = Number(
    getAmountInToken(tokenBalance.token, tokenBalance.balance),
  );
  const display =
    amount === 0 ? "0" : amount < 0.0001 ? "<0.0001" : amount.toFixed(4);
  return (
    <div className="flex items-center space-x-4">
      <div>
        <img
          src={tokenBalance.token.logoURI}
          alt="tokenIcon"
          className="w-[26px]"
        />
      </div>
      <div>
        <p className="text-white text-[18px] font-semibold">
          {display} {tokenBalance.token.symbol}
        </p>
      </div>
    </div>
  );
};
