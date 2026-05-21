import { useState } from "react";
import type { MarketInfo } from "../lib/contracts";
import {
  formatUsdc,
  impliedProbabilityPct,
  oddsToDecimal,
  overroundPct,
  timeUntil,
  formatDate,
} from "../lib/format";
import { ReasoningPanel } from "./ReasoningPanel";
import { BetForm } from "./BetForm";
import { UserPosition } from "./UserPosition";
import { reasoningFor } from "../lib/reasoning";

export function MarketCard({ info }: { info: MarketInfo }) {
  const [open, setOpen] = useState(false);
  const m = info.market;
  const id = info.marketId;

  const yesImpl = impliedProbabilityPct(m.yesOdds);
  const noImpl = impliedProbabilityPct(m.noOdds);
  const overround = overroundPct(m.yesOdds, m.noOdds);
  const volume = m.totalYesBets + m.totalNoBets;
  const closed = Number(m.deadline) * 1000 <= Date.now();
  const reasoning = reasoningFor(id);

  return (
    <article
      className={`card overflow-hidden transition ${
        open ? "ring-1 ring-gold/40" : "hover:border-line-strong"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-6"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-serif text-xl leading-snug pr-3">{m.question}</h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-dim shrink-0 mt-1">
            #{id.toString()}
          </span>
        </div>

        <OddsBar yes={yesImpl} no={noImpl} />

        <div className="grid grid-cols-2 gap-4 mt-4">
          <OddsCell
            side="YES"
            decimal={oddsToDecimal(m.yesOdds)}
            implied={yesImpl}
            volume={m.totalYesBets}
          />
          <OddsCell
            side="NO"
            decimal={oddsToDecimal(m.noOdds)}
            implied={noImpl}
            volume={m.totalNoBets}
          />
        </div>

        <div className="hairline mt-5 pt-4 flex items-center justify-between text-xs text-ink-dim">
          <div className="flex items-center gap-4">
            <span>
              <span className="text-ink-dim">vol </span>
              <span className="font-mono text-ink">{formatUsdc(volume, { decimals: 2 })}</span>
            </span>
            <span>
              <span className="text-ink-dim">overround </span>
              <span className="font-mono text-ink">{overround.toFixed(1)}%</span>
            </span>
          </div>
          <div className="font-mono">
            {closed ? "closed" : `closes in ${timeUntil(m.deadline)}`}{" "}
            <span className="text-ink-dim">· {formatDate(m.deadline)}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-bg-subtle/40 p-6 space-y-6">
          <ReasoningPanel marketId={id} reasoning={reasoning} />
          <UserPosition marketId={id} market={m} />
          {!m.resolved && !closed ? (
            <BetForm marketId={id} yesOdds={m.yesOdds} noOdds={m.noOdds} />
          ) : (
            <div className="text-sm text-ink-muted italic">
              {m.resolved
                ? `Resolved ${m.outcome ? "YES" : "NO"}. Betting closed.`
                : "Deadline passed; betting closed."}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function OddsBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesPct = (yes / total) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle border border-line">
      <div
        className="h-full bg-yes/80"
        style={{ width: `${yesPct}%` }}
      />
    </div>
  );
}

function OddsCell({
  side,
  decimal,
  implied,
  volume,
}: {
  side: "YES" | "NO";
  decimal: number;
  implied: number;
  volume: bigint;
}) {
  const color = side === "YES" ? "text-yes" : "text-no";
  return (
    <div className="rounded-md bg-bg-subtle border border-line p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-[10px] uppercase tracking-[0.22em] ${color}`}>
          {side}
        </span>
        <span className="font-mono text-xs text-ink-dim">{implied.toFixed(1)}%</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl text-ink">{decimal.toFixed(2)}</span>
        <span className="text-xs text-ink-dim">×</span>
      </div>
      <div className="font-mono text-[10px] text-ink-dim mt-1">
        {formatUsdc(volume, { decimals: 2 })}
      </div>
    </div>
  );
}
