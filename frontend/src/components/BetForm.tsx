import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { ADDRESSES, EXPLORER, erc20Abi, pmAbi } from "../lib/contracts";
import { arcTestnet } from "../lib/chain";
import { formatUsdc, ODDS_PRECISION, oddsToDecimal } from "../lib/format";

type Side = "yes" | "no";

export function BetForm({
  marketId,
  yesOdds,
  noOdds,
}: {
  marketId: bigint;
  yesOdds: bigint;
  noOdds: bigint;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongChain = isConnected && chainId !== arcTestnet.id;

  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState<string>("1");

  const amountWei = useMemo(() => {
    try {
      return parseUnits(amount || "0", 6);
    } catch {
      return 0n;
    }
  }, [amount]);

  const allowance = useReadContract({
    address: ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    chainId: arcTestnet.id,
    args: address ? [address, ADDRESSES.pm] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const needsApproval = (allowance.data ?? 0n) < amountWei && amountWei > 0n;

  const odds = side === "yes" ? yesOdds : noOdds;
  const payout = (amountWei * odds) / ODDS_PRECISION;
  const profit = payout - amountWei;

  const { writeContract, isPending, data: txHash, reset, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  // Auto-refresh allowance + clear when bet confirms
  useEffect(() => {
    if (receipt.isSuccess) {
      allowance.refetch();
    }
  }, [receipt.isSuccess]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || amountWei <= 0n || wrongChain) return;

    if (needsApproval) {
      writeContract({
        chainId: arcTestnet.id,
        address: ADDRESSES.usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [ADDRESSES.pm, amountWei],
      });
      return;
    }
    writeContract({
      chainId: arcTestnet.id,
      address: ADDRESSES.pm,
      abi: pmAbi,
      functionName: "placeBet",
      args: [marketId, side === "yes", amountWei],
    });
  };

  const status: "idle" | "approving" | "betting" | "confirming" | "done" =
    !txHash
      ? "idle"
      : receipt.isLoading
      ? needsApproval
        ? "approving"
        : "confirming"
      : receipt.isSuccess
      ? "done"
      : "betting";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {wrongChain && (
        <div className="rounded-md border border-no/40 bg-no/10 px-3 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-no">
            Wallet is on the wrong network. Switch to Arc Testnet to bet.
          </span>
          <button
            type="button"
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            disabled={switching}
            className="btn btn-no text-xs px-3 py-1"
          >
            {switching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-2">
          Place a bet
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("yes")}
            className={`btn ${side === "yes" ? "btn-yes" : "text-ink-muted"}`}
          >
            YES · {oddsToDecimal(yesOdds).toFixed(2)}×
          </button>
          <button
            type="button"
            onClick={() => setSide("no")}
            className={`btn ${side === "no" ? "btn-no" : "text-ink-muted"}`}
          >
            NO · {oddsToDecimal(noOdds).toFixed(2)}×
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-1.5 block">
          Amount (USDC)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            min="0"
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-bg border border-line rounded-md px-3 py-2 font-mono text-lg text-ink focus:outline-none focus:border-gold/60 transition"
            placeholder="1.00"
          />
          {[1, 5, 25].map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setAmount(String(v))}
              className="btn text-xs px-3"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-0.5">
            Payout if {side.toUpperCase()}
          </div>
          <div className="font-mono text-ink">
            {amountWei > 0n ? formatUsdc(payout, { decimals: 2 }) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-0.5">
            Profit
          </div>
          <div className={`font-mono ${profit > 0n ? "text-yes" : "text-ink"}`}>
            {amountWei > 0n ? formatUsdc(profit, { decimals: 2 }) : "—"}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={
          !isConnected ||
          wrongChain ||
          isPending ||
          receipt.isLoading ||
          amountWei <= 0n
        }
        className={`btn w-full ${side === "yes" ? "btn-yes" : "btn-no"} font-medium`}
      >
        {!isConnected
          ? "Connect wallet to bet"
          : wrongChain
          ? "Switch to Arc Testnet"
          : isPending
          ? "Sign in wallet…"
          : receipt.isLoading
          ? needsApproval
            ? "Approving USDC…"
            : "Confirming bet…"
          : needsApproval
          ? `Approve ${amount} USDC`
          : `Bet ${amount} USDC on ${side.toUpperCase()}`}
      </button>

      {status === "done" && txHash && (
        <div className="text-xs text-yes flex items-center gap-2">
          <span>✓ Confirmed.</span>
          <a
            href={`${EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline hover:text-ink"
          >
            View on Arcscan ↗
          </a>
          <button
            type="button"
            onClick={() => reset()}
            className="ml-auto text-ink-dim hover:text-ink"
          >
            Reset
          </button>
        </div>
      )}
      {writeError && (
        <div className="text-xs text-no break-words">
          {writeError.message.split("\n")[0]}
        </div>
      )}
    </form>
  );
}
