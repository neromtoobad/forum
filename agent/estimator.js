// agent/estimator.js — asks Claude for P(yes) + reasoning + confidence on a
// candidate event. Returns a structured object the rest of the agent can use.
//
// Requires ANTHROPIC_API_KEY in env. Model defaults to the cheap Haiku for
// fast estimates; you can pass `model` to override.

const Anthropic = require("@anthropic-ai/sdk");

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are a prediction market analyst pricing binary events.

Given a real-world event, estimate the probability it resolves YES.
You MUST output valid JSON, nothing else. No prose, no markdown fences.

Schema:
{
  "probability": <number in (0, 1) exclusive>,
  "reasoning": "<2-4 sentence explanation>",
  "confidence": "low" | "medium" | "high",
  "keyFactors": ["<short factor>", ...]
}

Rules:
- Be calibrated, not confident. A market priced at 50% says you don't know.
- probability ∈ (0.02, 0.98) — never 0, 1, or extreme values. If you're certain, market is uninteresting.
- "low" confidence: little data or far-out timeframe. "high": clear base rates and proximity.
- keyFactors: 2-4 short bullets, no full sentences.`;

function buildUserPrompt(event, { today = new Date() } = {}) {
  const parts = [];
  const todayISO = today.toISOString().slice(0, 10);
  parts.push(`Today's date: ${todayISO}`);
  if (event.resolutionDate) {
    const days = Math.round(
      (new Date(event.resolutionDate + "T00:00:00Z").getTime() - today.getTime()) /
        86_400_000
    );
    parts.push(`Resolution date: ${event.resolutionDate} (${days} days from today)`);
  }
  if (event.headline) parts.push(`Headline: ${event.headline}`);
  if (event.description) parts.push(`Description: ${event.description}`);
  if (event.category) parts.push(`Category: ${event.category}`);
  if (event.question) parts.push(`Market question: ${event.question}`);
  parts.push("\nReturn JSON only.");
  return parts.join("\n");
}

function validate(parsed) {
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`estimator: response is not an object — got ${typeof parsed}`);
  }
  const { probability, reasoning, confidence, keyFactors } = parsed;
  if (typeof probability !== "number" || !Number.isFinite(probability)) {
    throw new Error(`estimator: probability must be a finite number, got ${probability}`);
  }
  if (probability <= 0 || probability >= 1) {
    throw new Error(`estimator: probability must be in (0, 1), got ${probability}`);
  }
  if (typeof reasoning !== "string" || !reasoning.trim()) {
    throw new Error("estimator: reasoning must be a non-empty string");
  }
  if (!["low", "medium", "high"].includes(confidence)) {
    throw new Error(`estimator: confidence must be low|medium|high, got ${confidence}`);
  }
  if (!Array.isArray(keyFactors) || keyFactors.length === 0) {
    throw new Error("estimator: keyFactors must be a non-empty array");
  }
  return { probability, reasoning, confidence, keyFactors };
}

function extractJson(text) {
  // Be forgiving: strip code fences if present, then locate the first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`estimator: no JSON object found in response:\n${text}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function estimate(event, { apiKey, model = DEFAULT_MODEL, client } = {}) {
  apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !client) {
    throw new Error("estimator: missing ANTHROPIC_API_KEY (set in .env or pass apiKey)");
  }
  client = client || new Anthropic({ apiKey });

  const resp = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(event) }],
  });

  const textBlock = resp.content.find((c) => c.type === "text");
  if (!textBlock) {
    throw new Error("estimator: no text block in Claude response");
  }

  const parsed = extractJson(textBlock.text);
  return {
    ...validate(parsed),
    model,
    usage: resp.usage,
    raw: textBlock.text,
  };
}

module.exports = {
  estimate,
  buildUserPrompt,
  validate,
  extractJson,
  SYSTEM_PROMPT,
  DEFAULT_MODEL,
};
