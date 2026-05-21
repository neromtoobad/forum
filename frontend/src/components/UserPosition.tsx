import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ADDRESSES, EXPLORER, pmAbi, type Market } from "../lib/contracts";
import { arcTestnet } from "../lib/chain";
import { formatUsdc, ODDS_PRECISION } from "../lib/format";
import { useEffect } from "react";

export function UserPosition({
  marketId,
  market,
}: {
  marketId: bigint;
  market: Market;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const yesQuery = useReadContract({
    address: ADDRESSES.pm,
    abi: pmAbi,
    functionName: "yesBets",
    chainId: arcTestnet.id,
    args: address ? [marketId, address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const noQuery = useReadContract({
    address: ADDRESSES.pm,
    abi: pmAbi,
    functionName: "noBets",
    chainId: arcTestnet.id,
    args: address ? [marketId, address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const yes = (yesQuery.data ?? 0n) as bigint;
  const no = (noQuery.data ?? 0n) as bigint;

  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (receipt.isSuccess) {
      yesQuery.refetch();
      noQuery.refetch();
    }
  }, [receipt.isSuccess]);

  if (!isConnected || (yes === 0n && no === 0n)) return null;

  const wrongChain = chainId !== arcTestnet.id;
  const winningSide = market.resolved ? (market.outcome ? "yes" : "no") : null;
  const winningStake =
    winningSide === "yes" ? yes : winningSide === "no" ? no : 0n;
  const winningOdds =
    winningSide === "yes" ? market.yesOdds : winningSide === "no" ? market.noOdds : 0n;
  const claimablePayout =
    winningStake > 0n ? (winningStake * winningOdds) / ODDS_PRECISION : 0n;
  const claimable = market.resolved && winningStake > 0n;

  const handleClaim = () => {
    writeContract({
      chainId: arcTestnet.id,
      address: ADDRESSES.pm,
      abi: pmAbi,
      functionName: "claimWinnings",
      args: [marketId],
    });
  };

  return (
    <div className="rounded-md border border-line bg-bg-subtle/60 p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-2">
        Your position
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <PositionCell side="YES" amount={yes} won={winningSide === "yes"} />
        <PositionCell side="NO" amount={no} won={winningSide === "no"} />
      </div>

      {claimable && (
        <button
          type="button"
          onClick={handleClaim}
          disabled={wrongChain || isPending || receipt.isLoading}
          className="btn btn-primary w-full"
        >
          {wrongChain
            ? "Switch to Arc Testnet to claim"
            : isPending
            ? "Sign in wallet…"
            : receipt.isLoading
            ? "Claiming…"
            : `Claim ${formatUsdc(claimablePayout, { decimals: 2 })}`}
        </button>
      )}

      {market.resolved && !claimable && (yes > 0n || no > 0n) && (
        <div className="text-xs text-ink-dim italic">
          You bet against the resolution. No payout.
        </div>
      )}

      {receipt.isSuccess && txHash && (
        <div className="text-xs text-yes mt-2 flex items-center gap-2">
          <span>✓ Claimed.</span>
          <a
            href={`${EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline hover:text-ink"
          >
            tx ↗
          </a>
          <button
            type="button"
            onClick={() => reset()}
            className="ml-auto text-ink-dim hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="text-xs text-no mt-2 break-words">
          {error.message.split("\n")[0]}
        </div>
      )}
    </div>
  );
}

function PositionCell({
  side,
  amount,
  won,
}: {
  side: "YES" | "NO";
  amount: bigint;
  won: boolean | null;
}) {
  const color = side === "YES" ? "text-yes" : "text-no";
  return (
    <div className="rounded-md bg-bg border border-line p-2.5">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] uppercase tracking-[0.22em] ${color}`}>
          {side}
        </span>
        {won && (
          <span className="text-[9px] uppercase tracking-widest text-yes">
            ✓ Won
          </span>
        )}
      </div>
      <div className="font-mono text-base text-ink mt-1">
        {amount > 0n ? formatUsdc(amount, { decimals: 2, suffix: "" }) : "—"}
        {amount > 0n && (
          <span className="text-xs text-ink-dim ml-1">USDC</span>
        )}
      </div>
    </div>
  );
}
