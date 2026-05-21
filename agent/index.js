// agent/index.js — orchestrator. Scanner picks an event, estimator asks
// Claude for P(yes) + reasoning, odds.js converts to uint odds with a 5%
// overround, executor.js fires the createMarket tx on Arc.
//
// Usage:
//   . ~/.arc-canteen/env
//   node agent/index.js status                # chain + agent state
//   node agent/index.js markets               # list current markets
//   node agent/index.js run                   # create 1 market
//   node agent/index.js run 3                 # create up to 3 markets
//   node agent/index.js resolve <id> <yes|no> # resolve a market

// Load .env with override so the file is the source of truth. Without
// override, an empty-string ANTHROPIC_API_KEY in the user's shell would
// shadow the real value from .env (dotenv refuses to overwrite existing vars
// by default).
require("dotenv").config({ override: true });

const odds = require("./odds");
const scanner = require("./scanner");
const estimator = require("./estimator");
const { ArcExecutor } = require("./executor");

async function runOnce({
  executor,
  scanner: scn = scanner,
  estimator: est = estimator,
  oddsLib = odds,
  estimatorOpts = {},
} = {}) {
  if (!executor) throw new Error("runOnce: missing executor");

  const existing = await executor.getAllMarkets();
  const existingQuestions = new Set(existing.map((m) => m.market.question));

  const candidate = scn.fetch().find((c) => !existingQuestions.has(c.question));
  if (!candidate) {
    return { skipped: true, reason: "no candidates available" };
  }

  const estimation = await est.estimate(candidate, estimatorOpts);
  const computedOdds = oddsLib.probabilityToOdds(estimation.probability);

  const deadline = scn.deadlineFor(candidate);
  const result = await executor.createMarket({
    question: candidate.question,
    deadline,
    yesOdds: computedOdds.yesOdds,
    noOdds: computedOdds.noOdds,
  });

  return {
    skipped: false,
    candidate,
    estimation,
    odds: computedOdds,
    result,
  };
}

async function runMany({ executor, target = 1, ...rest }) {
  const results = [];
  for (let i = 0; i < target; i++) {
    const r = await runOnce({ executor, ...rest });
    results.push(r);
    if (r.skipped) break;
  }
  return results;
}

async function status({ executor }) {
  return executor.status();
}

module.exports = { runOnce, runMany, status };

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const cmd = process.argv[2] || "run";
  const arg = process.argv[3];

  (async () => {
    const executor = new ArcExecutor();

    if (cmd === "status") {
      const s = await status({ executor });
      console.log(JSON.stringify(s, null, 2));
      return;
    }

    if (cmd === "markets") {
      const all = await executor.getAllMarkets();
      if (all.length === 0) {
        console.log("No markets yet.");
        return;
      }
      for (const m of all) {
        const yesPct = (1000 / Number(m.market.yesOdds) * 100).toFixed(1);
        const noPct = (1000 / Number(m.market.noOdds) * 100).toFixed(1);
        console.log(
          `#${m.marketId}  ${m.market.question}\n` +
            `       odds:    YES ${Number(m.market.yesOdds) / 1000}x (${yesPct}% implied) · NO ${Number(m.market.noOdds) / 1000}x (${noPct}% implied)\n` +
            `       bets:    YES ${Number(m.market.totalYesBets) / 1e6} USDC · NO ${Number(m.market.totalNoBets) / 1e6} USDC\n` +
            `       status:  ${m.market.resolved ? `RESOLVED ${m.market.outcome ? "YES" : "NO"}` : "open"}` +
            `   deadline: ${new Date(Number(m.market.deadline) * 1000).toISOString()}`
        );
      }
      return;
    }

    if (cmd === "resolve") {
      const marketId = parseInt(process.argv[3], 10);
      const outcomeRaw = (process.argv[4] || "").toLowerCase();
      if (!Number.isFinite(marketId)) throw new Error("resolve: marketId required");
      if (!["yes", "no", "true", "false"].includes(outcomeRaw)) {
        throw new Error("resolve: outcome must be yes|no");
      }
      const outcome = outcomeRaw === "yes" || outcomeRaw === "true";
      console.log(`→ Resolving market #${marketId} as ${outcome ? "YES" : "NO"}...`);
      const r = await executor.resolveMarket(marketId, outcome);
      console.log(`  tx: ${r.txHash}`);
      return;
    }

    if (cmd === "run" || cmd === "create-next") {
      const target = arg ? parseInt(arg, 10) : 1;
      if (!Number.isFinite(target) || target < 1) {
        throw new Error(`invalid target: ${arg}`);
      }
      const results = await runMany({ executor, target });
      for (const [i, r] of results.entries()) {
        console.log(`\n── attempt ${i + 1} ──`);
        if (r.skipped) {
          console.log(`Skipped: ${r.reason}`);
          continue;
        }
        const pct = (r.estimation.probability * 100).toFixed(1);
        console.log(`→ Candidate:   ${r.candidate.question}`);
        console.log(`→ p(yes):      ${pct}%   confidence: ${r.estimation.confidence}`);
        console.log(`→ reasoning:   ${r.estimation.reasoning}`);
        console.log(`→ key factors: ${r.estimation.keyFactors.join(" · ")}`);
        console.log(
          `→ odds:        YES ${r.odds.yesDecimal.toFixed(2)}x (${r.odds.yesOdds}) / ` +
            `NO ${r.odds.noDecimal.toFixed(2)}x (${r.odds.noOdds})`
        );
        console.log(`→ marketId:    ${r.result.marketId}`);
        console.log(`→ tx:          ${r.result.txHash}`);
      }
      return;
    }

    console.error("Usage: node agent/index.js [status | markets | run [N] | resolve <id> <yes|no>]");
    process.exit(1);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
