const collectErrorChain = (error: unknown, depth = 0): any[] => {
  if (!error || depth > 6) return [];
  const e = error as any;
  return [e, ...collectErrorChain(e.cause, depth + 1)];
};

const isUserRejection = (chain: any[]): boolean =>
  chain.some((e) => {
    if (!e) return false;
    if (e.code === 4001 || e.code === "ACTION_REJECTED") return true;
    if (e.name === "UserRejectedRequestError") return true;
    const msg = String(e.shortMessage ?? e.message ?? "").toLowerCase();
    return (
      msg.includes("user rejected") ||
      msg.includes("user denied") ||
      msg.includes("rejected the request")
    );
  });

const firstMeaningfulLine = (text: string): string => {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l && !/^(details|version|contract call|request arguments):/i.test(l)
    );
  return (line ?? text.trim()).replace(/\.$/, "");
};

export const getFriendlyErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string => {
  const chain = collectErrorChain(error);

  if (isUserRejection(chain)) {
    return "Request rejected in your wallet";
  }

  const combined = chain
    .map((e) => String(e?.shortMessage ?? e?.reason ?? e?.message ?? ""))
    .filter(Boolean)
    .join(" ");

  if (
    /insufficient funds|exceeds balance|transfer amount exceeds/i.test(combined)
  ) {
    return "Insufficient funds for this transaction";
  }
  if (
    /network|timeout|failed to fetch|fetch failed|connection/i.test(combined)
  ) {
    return "Network error — check your connection and try again";
  }

  const best =
    chain.find((e) => e?.shortMessage)?.shortMessage ??
    chain.find((e) => e?.reason)?.reason ??
    (error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "");

  const message = best ? firstMeaningfulLine(String(best)) : "";
  return message || fallback;
};
