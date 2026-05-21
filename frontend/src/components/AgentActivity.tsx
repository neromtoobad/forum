import { useState } from "react";
import { allReasonings, type ReasoningEntry } from "../lib/reasoning";

export function AgentActivity() {
  const entries = allReasonings()
    .filter((e) => e.estimate.model !== "manual")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold mb-0.5 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold animate-pulse" />
            Agent log
          </div>
          <div className="font-serif text-lg leading-none">
            {entries.length} decisions
          </div>
        </div>
        <Stats entries={entries} />
      </div>

      <ol className="space-y-3">
        {entries.slice(0, 8).map((entry) => (
          <ActivityRow key={entry.marketId} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function Stats({ entries }: { entries: ReasoningEntry[] }) {
  const probs = entries
    .map((e) => e.estimate.probability)
    .filter((p): p is number => typeof p === "number");
  const min = probs.length ? Math.min(...probs) : 0;
  const max = probs.length ? Math.max(...probs) : 0;
  const cats = new Set(entries.map((e) => e.category));

  return (
    <div className="text-right">
      <div className="font-mono text-xs text-ink-dim">
        p ∈ [{(min * 100).toFixed(0)}%, {(max * 100).toFixed(0)}%]
      </div>
      <div className="font-mono text-xs text-ink-dim">
        {cats.size} categor{cats.size === 1 ? "y" : "ies"}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ReasoningEntry }) {
  const [open, setOpen] = useState(false);
  const pct =
    typeof entry.estimate.probability === "number"
      ? Math.round(entry.estimate.probability * 100)
      : null;
  const ago = timeAgo(new Date(entry.createdAt));
  const conf = entry.estimate.confidence;

  return (
    <li className="border-l-2 border-line hover:border-gold/60 transition pl-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left group"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono text-[10px] text-ink-dim shrink-0">
              #{entry.marketId}
            </span>
            <span className="text-sm text-ink truncate group-hover:text-gold transition">
              {entry.question}
            </span>
          </div>
          <span className="shrink-0 font-mono text-xs text-ink-dim">
            {pct !== null ? `${pct}%` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-dim">
          <span className="font-mono">{ago}</span>
          {conf && (
            <>
              <span className="text-ink-dim/40">·</span>
              <span className="capitalize">{conf} confidence</span>
            </>
          )}
          <span className="text-ink-dim/40">·</span>
          <span className="font-mono">{entry.category}</span>
        </div>
      </button>
      {open && (
        <p className="mt-2 mb-2 text-sm text-ink-muted italic font-serif leading-relaxed">
          "{entry.estimate.reasoning}"
        </p>
      )}
    </li>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
