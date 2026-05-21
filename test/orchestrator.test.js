const { expect } = require("chai");
const { runOnce, runMany } = require("../agent");
const scanner = require("../agent/scanner");
const odds = require("../agent/odds");

function mockExecutor({ existingQuestions = [] } = {}) {
  const calls = { createMarket: [], getAllMarkets: 0 };
  const existing = existingQuestions.map((q, i) => ({
    marketId: BigInt(i),
    market: { question: q },
  }));
  let nextId = BigInt(existing.length);
  return {
    calls,
    getAllMarkets: async () => {
      calls.getAllMarkets++;
      return existing;
    },
    createMarket: async (args) => {
      calls.createMarket.push(args);
      const marketId = nextId++;
      existing.push({ marketId, market: { question: args.question } });
      return { marketId, txHash: `0x${marketId.toString(16).padStart(64, "0")}` };
    },
  };
}

function mockEstimator({ probability = 0.6 } = {}) {
  return {
    estimate: async () => ({
      probability,
      reasoning: "mock reasoning",
      confidence: "medium",
      keyFactors: ["mock factor"],
    }),
  };
}

describe("agent/index orchestrator", function () {
  it("runOnce wires scanner → estimator → odds → executor", async function () {
    const exec = mockExecutor();
    const r = await runOnce({ executor: exec, estimator: mockEstimator() });

    expect(r.skipped).to.equal(false);
    expect(exec.calls.getAllMarkets).to.equal(1);
    expect(exec.calls.createMarket).to.have.lengthOf(1);

    const submitted = exec.calls.createMarket[0];
    expect(submitted.question).to.equal(r.candidate.question);
    expect(submitted.deadline).to.equal(scanner.deadlineFor(r.candidate));

    const expectedOdds = odds.probabilityToOdds(0.6);
    expect(submitted.yesOdds).to.equal(expectedOdds.yesOdds);
    expect(submitted.noOdds).to.equal(expectedOdds.noOdds);
  });

  it("runOnce skips when all candidates are already live markets", async function () {
    const allQuestions = scanner.WATCHLIST.map((c) => c.question);
    const exec = mockExecutor({ existingQuestions: allQuestions });
    const r = await runOnce({ executor: exec, estimator: mockEstimator() });

    expect(r.skipped).to.equal(true);
    expect(r.reason).to.match(/no candidates/);
    expect(exec.calls.createMarket).to.have.lengthOf(0);
  });

  it("runOnce skips candidates whose question already exists", async function () {
    const exec = mockExecutor({ existingQuestions: [scanner.WATCHLIST[0].question] });
    const r = await runOnce({ executor: exec, estimator: mockEstimator() });
    expect(r.skipped).to.equal(false);
    expect(r.candidate.id).to.not.equal(scanner.WATCHLIST[0].id);
  });

  it("runMany creates up to `target` markets", async function () {
    const exec = mockExecutor();
    const results = await runMany({ executor: exec, target: 3, estimator: mockEstimator() });
    expect(results).to.have.lengthOf(3);
    expect(results.every((r) => !r.skipped)).to.equal(true);
    expect(exec.calls.createMarket).to.have.lengthOf(3);
  });

  it("runMany stops early when scanner runs dry", async function () {
    const allQuestions = scanner.WATCHLIST.map((c) => c.question);
    // pre-fill all but the last
    const exec = mockExecutor({ existingQuestions: allQuestions.slice(0, -1) });
    const results = await runMany({ executor: exec, target: 5, estimator: mockEstimator() });
    expect(results).to.have.lengthOf(2);
    expect(results[0].skipped).to.equal(false);
    expect(results[1].skipped).to.equal(true);
  });
});
