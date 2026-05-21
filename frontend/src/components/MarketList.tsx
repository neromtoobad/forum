import { useReadContract } from "wagmi";
import { ADDRESSES, factoryAbi, type MarketInfo } from "../lib/contracts";
import { MarketCard } from "./MarketCard";

export function MarketList() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    functionName: "getAllMarkets",
    query: { refetchInterval: 12_000 },
  });

  const markets = (data ?? []) as readonly MarketInfo[];
  const active = markets.filter((m) => !m.market.resolved);

  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-dim mb-1">
            Active markets
          </h2>
          <div className="font-serif text-3xl text-ink">
            {isLoading
              ? "Loading…"
              : `${active.length} live${markets.length > active.length ? ` · ${markets.length - active.length} resolved` : ""}`}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs uppercase tracking-widest text-ink-dim hover:text-ink transition"
        >
          ↻ Refresh
        </button>
      </div>

      {error ? (
        <div className="card p-6 text-no">
          Could not read MarketFactory. RPC error: {String(error.message)}
        </div>
      ) : isLoading ? (
        <Skeleton />
      ) : active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {active.map((m) => (
            <MarketCard key={m.marketId.toString()} info={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="h-5 w-3/4 bg-line rounded mb-4" />
          <div className="h-3 w-1/2 bg-line rounded mb-6" />
          <div className="h-16 bg-line/60 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="font-serif text-xl text-ink mb-2">No live markets yet.</div>
      <div className="text-sm text-ink-muted">
        The agent hasn't opened any. Run{" "}
        <code className="font-mono text-gold">node agent/index.js run</code> to create one.
      </div>
    </div>
  );
}
