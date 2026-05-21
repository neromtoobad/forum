const { expect } = require("chai");
const {
  ODDS_PRECISION,
  DEFAULT_MARGIN,
  probabilityToOdds,
  contractOddsToImpliedProb,
  overround,
} = require("../agent/odds");

describe("agent/odds", function () {
  describe("probabilityToOdds", function () {
    it("symmetric: p=0.5, margin=0.05 → both sides 1.905x", function () {
      const { yesDecimal, noDecimal, yesOdds, noOdds } = probabilityToOdds(0.5);
      expect(yesDecimal).to.be.closeTo(1 / 1.05 * 2, 1e-9);
      expect(noDecimal).to.equal(yesDecimal);
      expect(yesOdds).to.equal(1905);
      expect(noOdds).to.equal(1905);
    });

    it("biased: p=0.6 → yes 1.587x, no 2.381x", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.6);
      expect(yesOdds).to.equal(Math.round((1 / 0.6 / 1.05) * 1000));
      expect(noOdds).to.equal(Math.round((1 / 0.4 / 1.05) * 1000));
      expect(yesOdds).to.equal(1587);
      expect(noOdds).to.equal(2381);
    });

    it("extreme low: p=0.05 → very long YES, very short NO", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.05);
      expect(yesOdds).to.equal(Math.round((1 / 0.05 / 1.05) * 1000));
      expect(noOdds).to.equal(Math.round((1 / 0.95 / 1.05) * 1000));
      expect(yesOdds).to.equal(19048);
      expect(noOdds).to.equal(1003);
    });

    it("zero margin → fair decimal odds", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.5, 0);
      expect(yesOdds).to.equal(2000);
      expect(noOdds).to.equal(2000);
    });

    it("custom margin: 20%", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.5, 0.2);
      // 1 / 0.5 / 1.20 = 1.6667
      expect(yesOdds).to.equal(1667);
      expect(noOdds).to.equal(1667);
    });

    it("implied probs sum to (1 + margin) — 5% overround on default", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.42);
      const sum = ODDS_PRECISION / yesOdds + ODDS_PRECISION / noOdds;
      expect(sum).to.be.closeTo(1 + DEFAULT_MARGIN, 1e-3);
    });

    it("rejects p=0", function () {
      expect(() => probabilityToOdds(0)).to.throw(/in \(0, 1\)/);
    });

    it("rejects p=1", function () {
      expect(() => probabilityToOdds(1)).to.throw(/in \(0, 1\)/);
    });

    it("rejects negative p", function () {
      expect(() => probabilityToOdds(-0.1)).to.throw(/in \(0, 1\)/);
    });

    it("rejects p>1", function () {
      expect(() => probabilityToOdds(1.5)).to.throw(/in \(0, 1\)/);
    });

    it("rejects non-number p", function () {
      expect(() => probabilityToOdds("0.5")).to.throw(/finite number/);
    });

    it("rejects NaN p", function () {
      expect(() => probabilityToOdds(NaN)).to.throw(/finite number/);
    });

    it("rejects margin < 0", function () {
      expect(() => probabilityToOdds(0.5, -0.1)).to.throw(/margin must be in/);
    });

    it("rejects margin >= 1", function () {
      expect(() => probabilityToOdds(0.5, 1)).to.throw(/margin must be in/);
    });
  });

  describe("contractOddsToImpliedProb", function () {
    it("inverts probabilityToOdds within rounding", function () {
      const { yesOdds } = probabilityToOdds(0.6); // overround built in
      // implied = 1000 / 1587 ≈ 0.63 (which is 0.6 * 1.05)
      const implied = contractOddsToImpliedProb(yesOdds);
      expect(implied).to.be.closeTo(0.63, 1e-3);
    });

    it("accepts bigint (from ethers contract calls)", function () {
      const implied = contractOddsToImpliedProb(2000n);
      expect(implied).to.equal(0.5);
    });

    it("rejects zero", function () {
      expect(() => contractOddsToImpliedProb(0)).to.throw(/> 0/);
    });
  });

  describe("overround", function () {
    it("matches the margin used to generate the odds", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.42, 0.05);
      expect(overround(yesOdds, noOdds)).to.be.closeTo(0.05, 1e-3);
    });

    it("returns ~0 for fair odds", function () {
      const { yesOdds, noOdds } = probabilityToOdds(0.5, 0);
      expect(overround(yesOdds, noOdds)).to.be.closeTo(0, 1e-3);
    });
  });
});
