// agent/scanner.js — surfaces candidate events for the bookmaker to price.
//
// v1: curated watchlist of high-signal binary events across the three launch
// categories (crypto / macro / on-chain). Stable, deterministic, demoable.
//
// v2 (Day 3 polish): swap watchlist for a real news pull (NewsAPI if
// NEWSAPI_KEY is set, RSS fallback otherwise). Same return shape, so the
// orchestrator doesn't change.

const WATCHLIST = [
  // ── Crypto ─────────────────────────────────────────────────────────
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
    id: "sol-300-2026-06-10",
    category: "crypto",
    headline: "Solana network activity at all-time highs",
    description:
      "SOL trading near $260. DEX volume up, validator count growing. ETF rumors continue.",
    question: "Will Solana close above $300 on 2026-06-10?",
    resolutionDate: "2026-06-10",
  },
  {
    id: "btc-110k-2026-07-01",
    category: "crypto",
    headline: "Bitcoin eyeing $110K in early summer",
    description:
      "Spot ETF cumulative inflows passed $200B last week. Realized cap making new highs. Halving narrative tailwinds intact.",
    question: "Will Bitcoin close above $110,000 on 2026-07-01?",
    resolutionDate: "2026-07-01",
  },
  {
    id: "eth-btc-ratio-2026-06-30",
    category: "crypto",
    headline: "ETH/BTC ratio drifting lower",
    description:
      "ETH/BTC sits near 0.045. Bitcoin dominance pushing higher as institutional flows favor BTC.",
    question: "Will the ETH/BTC ratio close above 0.05 on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  {
    id: "btc-dominance-2026-06-30",
    category: "crypto",
    headline: "BTC dominance debate intensifies",
    description:
      "BTC.D currently 53%. Altcoin season historically begins when BTC.D rolls over below 50%.",
    question: "Will Bitcoin dominance be below 50% on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  // ── Macro ──────────────────────────────────────────────────────────
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
    id: "cpi-may-2026",
    category: "macro",
    headline: "May CPI report due June 12",
    description:
      "Last YoY print was 2.9%. Energy prices easing. Shelter inflation sticky but trending lower.",
    question: "Will US CPI YoY print below 3.0% for May 2026?",
    resolutionDate: "2026-06-12",
  },
  {
    id: "unemployment-may-2026",
    category: "macro",
    headline: "May jobs report due June 6",
    description:
      "Unemployment has held in the 4.1-4.3% range for three months. Hiring slowing but no clear breakdown.",
    question: "Will US unemployment rate be below 4.5% for May 2026?",
    resolutionDate: "2026-06-06",
  },
  {
    id: "gold-3000-2026-06-30",
    category: "macro",
    headline: "Gold pushing all-time highs",
    description:
      "Spot gold near $2,900/oz. Central bank buying continues, real yields drifting lower.",
    question: "Will gold close above $3,000/oz on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  // ── On-chain ───────────────────────────────────────────────────────
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
    id: "base-tvl-30b-2026-06-30",
    category: "onchain",
    headline: "Base TVL surging on Coinbase tailwind",
    description:
      "Base TVL near $24B, up from $18B at start of year. Bridges + native issuance both contributing.",
    question: "Will Base TVL exceed $30B on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  {
    id: "usdc-supply-2026-06-30",
    category: "onchain",
    headline: "USDC circulating supply at record highs",
    description:
      "USDC supply ~$180B and growing as Arc, CCTP, and institutional adoption compound.",
    question: "Will USDC total supply exceed $200B on 2026-06-30?",
    resolutionDate: "2026-06-30",
  },
  {
    id: "eth-gas-2026-06-15",
    category: "onchain",
    headline: "Ethereum gas falling on L2 migration",
    description:
      "L1 gas avg ~6 gwei this week. Activity continues moving to L2s; blob throughput at capacity.",
    question: "Will Ethereum L1 avg gas be below 5 gwei for the week of 2026-06-15?",
    resolutionDate: "2026-06-22",
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
