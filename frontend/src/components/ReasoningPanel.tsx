import type { ReasoningEntry } from "../lib/reasoning";

export function ReasoningPanel({
  marketId,
  reasoning,
}: {
  marketId: bigint;
  reasoning?: ReasoningEntry;
}) {
  if (!reasoning || reasoning.estimate.model === "manual") {
    return (
      <div>
        <Heading />
        <p className="font-serif text-base text-ink-muted italic leading-relaxed">
          {reasoning?.estimate.reasoning ||
            `No agent reasoning recorded for market #${marketId.toString()}.`}
        </p>
      </div>
    );
  }

  const { probability, reasoning: text, confidence, keyFactors, model } = reasoning.estimate;
  const pct = probability !== null ? Math.round(probability * 100) : null;

  return (
    <div>
      <Heading />
      <blockquote className="border-l-2 border-gold pl-4 my-3">
        <p className="font-serif text-base leading-relaxed text-ink">{text}</p>
      </blockquote>

      <div className="grid grid-cols-2 gap-4 my-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-1">
            P(yes)
          </div>
          <div className="font-mono text-2xl text-ink">{pct !== null ? `${pct}%` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-1">
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <ConfidenceDots level={confidence} />
            <span className="text-sm text-ink-muted capitalize">{confidence}</span>
          </div>
        </div>
      </div>

      {keyFactors.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-2">
            Key factors
          </div>
          <ul className="space-y-1.5">
            {keyFactors.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-muted">
                <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 pt-3 border-t border-line text-[10px] uppercase tracking-widest text-ink-dim font-mono">
        Estimated by {model}
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="size-1.5 rounded-full bg-gold animate-pulse" />
      <span className="text-[10px] uppercase tracking-[0.22em] text-gold">
        The agent's call
      </span>
    </div>
  );
}

function ConfidenceDots({ level }: { level: "low" | "medium" | "high" | null }) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : level === "low" ? 1 : 0;
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`block size-1.5 rounded-full ${
            i < filled ? "bg-gold" : "bg-line-strong"
          }`}
        />
      ))}
    </span>
  );
}
