import { useBlockNumber, useReadContract } from "wagmi";
import { arcTestnet } from "../lib/chain";
import { ADDRESSES, factoryAbi, type MarketInfo } from "../lib/contracts";
import { formatUsdc } from "../lib/format";
import { allReasonings } from "../lib/reasoning";

export function StatsStrip() {
  const { data: markets } = useReadContract({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    functionName: "getAllMarkets",
    query: { refetchInterval: 12_000 },
  });

  const blockNumber = useBlockNumber({
    chainId: arcTestnet.id,
    watch: true,
  });

  const list = (markets ?? []) as readonly MarketInfo[];
  const active = list.filter((m) => !m.market.resolved).length;
  const totalVolume = list.reduce(
    (acc, m) => acc + m.market.totalYesBets + m.market.totalNoBets,
    0n
  );

  const reasonings = allReasonings().filter((e) => e.estimate.model !== "manual");
  const categories = new Set(reasonings.map((e) => e.category));
  const lastAction = reasonings.sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  )[0];

  return (
    <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
      <Stat label="Markets live" value={`${active}`} sub={`${reasonings.length} agent-priced`} />
      <Stat
        label="Total volume"
        value={formatUsdc(totalVolume, { decimals: 2, suffix: "" })}
        sub="USDC wagered"
      />
      <Stat
        label="Categories"
        value={`${categories.size}`}
        sub={[...categories].join(" · ") || "—"}
      />
      <Stat
        label="Last block"
        value={blockNumber.data ? `#${blockNumber.data.toString()}` : "—"}
        sub={lastAction ? `agent acted ${timeAgo(new Date(lastAction.createdAt))}` : "—"}
        live
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  live,
}: {
  label: string;
  value: string;
  sub?: string;
  live?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-1 flex items-center gap-1.5">
        {live && <span className="size-1 rounded-full bg-gold animate-pulse" />}
        {label}
      </div>
      <div className="font-mono text-xl text-ink leading-none">{value}</div>
      {sub && <div className="text-[11px] text-ink-dim mt-1 truncate">{sub}</div>}
    </div>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
