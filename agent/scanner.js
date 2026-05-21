// agent/scanner.js — surfaces candidate events for the bookmaker to price.
//
// v1: curated watchlist of high-signal binary events across the three launch
// categories (crypto / macro / on-chain). Stable, deterministic, demoable.
//
// v2 (Day 3 polish): swap watchlist for a real news pull (NewsAPI if
// NEWSAPI_KEY is set, RSS fallback otherwise). Same return shape, so the
// orchestrator doesn't change.

const WATCHLIST = [
  {
    id: "btc-100k-2026-06-01",
    category: "crypto",
    headline: "Bitcoin holding near $100K psychological level",
    description:
      "BTC has hovered around the $100K level for the past week. Spot ETF inflows steady, macro tailwinds intact.",
    question: "Will Bitcoin close above $100,000 on 2026-06-01?",
    resolutionDate: "2026-06-01",
  },
  {
    id: "eth-5k-2026-06-15",
    category: "crypto",
    headline: "Ethereum approaches $5K resistance",
    description:
      "ETH price has been consolidating in the $4.6K-$4.9K range. L2 fee revenue at all-time highs.",
    question: "Will Ethereum close above $5,000 on 2026-06-15?",
    resolutionDate: "2026-06-15",
  },
  {
    id: "fed-jun-2026-hold",
    category: "macro",
    headline: "FOMC June 2026 meeting: rate decision pending",
    description:
      "Fed funds futures pricing implies a high probability of a hold. CPI cooling, labor market mixed.",
    question: "Will the FOMC hold rates at the June 2026 meeting?",
    resolutionDate: "2026-06-18",
  },
  {
    id: "uniswap-tvl-10b-2026-06-30",
    category: "onchain",
    headline: "Uniswap TVL approaching $10B threshold",
    description:
      "Uniswap V4 has been gaining TVL steadily. Currently around $8.5B across all chains.",
    question: "Will Uniswap protocol TVL exceed $10B on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  {
    id: "sol-300-2026-06-10",
    category: "crypto",
    headline: "Solana network activity at all-time highs",
    description:
      "SOL trading near $260. DEX volume up, validator count growing. ETF rumors continue.",
    question: "Will Solana close above $300 on 2026-06-10?",
    resolutionDate: "2026-06-10",
  },
];

function _toUnix(dateStr) {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

/**
 * Return all candidate events with a future resolutionDate.
 * @param {object} [opts]
 * @param {number} [opts.now] - Unix seconds; defaults to Date.now() / 1000.
 * @param {string[]} [opts.excludeIds] - candidate ids to skip (e.g. already-active markets).
 * @param {string[]} [opts.categories] - allowlist of categories.
 */
function fetch({ now, excludeIds = [], categories } = {}) {
  const cutoff = now != null ? now : Math.floor(Date.now() / 1000);
  return WATCHLIST.filter((c) => {
    if (excludeIds.includes(c.id)) return false;
    if (categories && !categories.includes(c.category)) return false;
    return _toUnix(c.resolutionDate) > cutoff;
  });
}

/** Return the next available candidate (or null). */
function next(opts = {}) {
  const list = fetch(opts);
  return list[0] || null;
}

function getWatchlist() {
  return WATCHLIST.slice();
}

function deadlineFor(event) {
  return _toUnix(event.resolutionDate);
}

module.exports = {
  WATCHLIST,
  fetch,
  next,
  getWatchlist,
  deadlineFor,
};
