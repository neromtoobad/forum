// agent/odds.js — convert a probability to decimal YES/NO odds with a
// fixed bookmaker overround, then to the uint representation used by
// PredictionMarket (yesOdds * ODDS_PRECISION, ODDS_PRECISION=1000).
//
// Margin semantics: with `margin` = 0.05, sum of implied probabilities
// on YES and NO equals 1.05 — a 5% overround. The bookmaker is
// profit-protected when bet flow comes in at the implied ratio.

const ODDS_PRECISION = 1000;
const DEFAULT_MARGIN = 0.05;

function probabilityToOdds(p, margin = DEFAULT_MARGIN) {
  if (typeof p !== "number" || !Number.isFinite(p)) {
    throw new Error(`probabilityToOdds: p must be a finite number, got ${p}`);
  }
  if (p <= 0 || p >= 1) {
    throw new Error(`probabilityToOdds: p must be in (0, 1), got ${p}`);
  }
  if (typeof margin !== "number" || !Number.isFinite(margin) || margin < 0 || margin >= 1) {
    throw new Error(`probabilityToOdds: margin must be in [0, 1), got ${margin}`);
  }

  const overround = 1 + margin;
  const yesDecimal = 1 / p / overround;
  const noDecimal = 1 / (1 - p) / overround;

  return {
    yesDecimal,
    noDecimal,
    yesOdds: Math.round(yesDecimal * ODDS_PRECISION),
    noOdds: Math.round(noDecimal * ODDS_PRECISION),
  };
}

function contractOddsToImpliedProb(uintOdds, precision = ODDS_PRECISION) {
  if (typeof uintOdds !== "number" && typeof uintOdds !== "bigint") {
    throw new Error(`contractOddsToImpliedProb: uintOdds must be a number or bigint, got ${typeof uintOdds}`);
  }
  const n = Number(uintOdds);
  if (n <= 0) {
    throw new Error(`contractOddsToImpliedProb: uintOdds must be > 0, got ${n}`);
  }
  return precision / n;
}

function overround(yesUintOdds, noUintOdds, precision = ODDS_PRECISION) {
  const impliedYes = contractOddsToImpliedProb(yesUintOdds, precision);
  const impliedNo = contractOddsToImpliedProb(noUintOdds, precision);
  return impliedYes + impliedNo - 1;
}

module.exports = {
  ODDS_PRECISION,
  DEFAULT_MARGIN,
  probabilityToOdds,
  contractOddsToImpliedProb,
  overround,
};
