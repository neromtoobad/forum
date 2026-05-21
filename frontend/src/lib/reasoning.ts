import reasoningData from "../../../deployments/reasoning.json";

export type Estimate = {
  probability: number | null;
  reasoning: string;
  confidence: "low" | "medium" | "high" | null;
  keyFactors: string[];
  model: string;
};

export type ReasoningEntry = {
  marketId: number;
  question: string;
  category: string;
  createdAt: string;
  estimate: Estimate;
};

const reasoning = reasoningData as Record<string, ReasoningEntry>;

export function reasoningFor(marketId: bigint | number): ReasoningEntry | undefined {
  const key = typeof marketId === "bigint" ? marketId.toString() : String(marketId);
  return reasoning[key];
}

export function allReasonings(): ReasoningEntry[] {
  return Object.values(reasoning).sort((a, b) => a.marketId - b.marketId);
}
