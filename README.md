<div align="center">

# FORUM

**Where AI prices information.**

[![Live demo](https://img.shields.io/badge/demo-forum--xi--eight.vercel.app-d4af37?style=flat-square)](https://forum-xi-eight.vercel.app)
[![Network](https://img.shields.io/badge/network-Arc%20Testnet-d4af37?style=flat-square)](https://testnet.arcscan.app)
[![Tests](https://img.shields.io/badge/tests-124%20passing-3fb950?style=flat-square)](#tests)
[![License](https://img.shields.io/badge/license-MIT-737373?style=flat-square)](LICENSE)

*The agora was where Athens priced information. FORUM is where AI prices it now.*

</div>

---

## The idea

Prediction markets are only as good as the intelligence pricing them. Today they're set by slow, distracted humans. **FORUM puts an AI agent in the bookmaker's seat** — it scans events, estimates probabilities with live reasoning, opens binary markets on Arc, and earns the spread. Users bet USDC against its odds. Everything settles in sub-second.

We're not automating a script. The agent makes economic decisions — picking what to price, calibrating probabilities, setting odds with overround, and persisting its reasoning on-chain-adjacent so every call is auditable.

**USDC in, USDC out. No gas tokens. No waiting.**

---

## Live

| | |
|---|---|
| 🟡 **App** | <https://forum-xi-eight.vercel.app> |
| 📦 **Repo** | <https://github.com/neromtoobad/forum> |
| 🔭 **Explorer** | <https://testnet.arcscan.app> |
| 🏷 **Chain** | Arc Testnet (chainId `5042002`) |

### Try it in 60 seconds

1. Get testnet USDC from <https://faucet.circle.com> — select **Arc Testnet** + USDC
2. Open <https://forum-xi-eight.vercel.app>
3. Connect MetaMask (the app auto-prompts to add Arc Testnet if missing)
4. Pick a market → expand → read the agent's reasoning + key factors
5. Place a bet on YES or NO. Approve → bet. Done.

The whole interaction costs **~$0.01 in USDC gas**.

---

## What the agent does

The differentiated value lives here. The agent doesn't run a static script — it makes real economic decisions:

- **Picks events.** A curated watchlist across crypto / macro / on-chain, filtered for binary outcomes within a sensible time window.
- **Estimates probability.** Structured prompt to Claude (`claude-haiku-4-5`) with today's date, time-to-resolution, headline + description. Returns a calibrated `probability ∈ (0, 1)`, `confidence` (low/medium/high), and 2–4 `keyFactors`.
- **Prices with overround.** Converts P(yes) to decimal odds with a fixed 5% bookmaker margin. The implied probabilities sum to exactly 1.05 — clean edge, calibrated per event.
- **Submits on-chain.** Signs and sends `MarketFactory.createMarket()` from a regular EOA. Reasoning is auto-persisted to [`deployments/reasoning.json`](deployments/reasoning.json) so the frontend can render it.
- **Operates via CLI.** `node agent/index.js status | markets | run [N] | resolve <id> <yes|no>`.

### Live evidence of agent variance

Same model, very different calls — calibration, not anchoring:

| # | Market | P(yes) | Confidence | The agent's call |
|---|--------|--------|------------|----------|
| 7 | CPI < 3% for May 2026 | **72%** | **high** | "Previous print 2.9% already below threshold" |
| 4 | BTC > $110K by 2026-07-01 | 72% | medium | "Modest appreciation over 40 days" |
| 6 | BTC dominance < 50% by 2026-06-30 | 42% | medium | "3+ pp decline in 39 days" |
| 3 | SOL > $300 by 2026-06-10 | 28% | medium | "15% rally needed in 19 days — challenging" |
| 5 | ETH/BTC > 0.05 by 2026-06-30 | 28% | medium | "11% relative move in 39 days" |

A static script would anchor on one number. The agent's range is 28% → 72% across categories, and odds visibly track the underlying call.

---

## Architecture

```
                     ┌──────────────────────────────┐
                     │  agent/  (Node.js · ESM)     │
                     │                              │
        watchlist ─► │  scanner   →   estimator     │ ──► Anthropic API
                     │                (Claude)       │      (P(yes), reasoning,
                     │      │                        │       confidence, factors)
                     │      ▼                        │
                     │   odds.js  (5% overround)     │
                     │      │                        │
                     │      ▼                        │
                     │   executor.js   (ethers v6)   │
                     └──────────────┬───────────────┘
                                    │ tx
                                    ▼
                     ┌──────────────────────────────┐
                     │  Arc Testnet                  │
                     │  chainId 5042002 · USDC gas   │
                     │                               │
                     │  MarketFactory.sol            │
                     │       │ deploys + proxies     │
                     │       ▼                       │
                     │  PredictionMarket.sol  ◄──────┤ ◄── user bets here
                     │                               │
                     │  Treasury.sol                 │
                     └──────────────┬───────────────┘
                                    │ reads
                                    ▼
                     ┌──────────────────────────────┐
                     │  frontend/                    │
                     │  React · Vite · TypeScript    │
                     │  Tailwind · wagmi · viem      │
                     │                               │
                     │  forum-xi-eight.vercel.app    │
                     └──────────────────────────────┘
```

### Deployed contracts (Arc Testnet)

| Contract | Address |
|---|---|
| MarketFactory | [`0x510D2aa93030Fb6C31F530d4Db36f12293f05686`](https://testnet.arcscan.app/address/0x510D2aa93030Fb6C31F530d4Db36f12293f05686) |
| PredictionMarket | [`0xf6E733FE9Eb4D0662348eadf6bCf42FcA42fE258`](https://testnet.arcscan.app/address/0xf6E733FE9Eb4D0662348eadf6bCf42FcA42fE258) |
| Treasury | [`0xf42d7680666D9295f345f9082879C2C2DB82e308`](https://testnet.arcscan.app/address/0xf42d7680666D9295f345f9082879C2C2DB82e308) |
| USDC (native gas token) | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |

### Contract design

- **`PredictionMarket.sol`** is a multi-market registry. One contract holds every market, keyed by `marketId`. Fixed-odds payout: `payout = stake × winningOdds / 1000`. State per market: question · deadline · YES/NO odds · YES/NO totals · resolved · outcome · exists.
- **`MarketFactory.sol`** is a thin agent gateway. It *deploys PredictionMarket in its own constructor* — so the factory IS the PM's authorized `agent`. The EOA agent talks only to the factory; PM writes are proxied through. Single deploy tx, no chicken-and-egg ordering.
- **`Treasury.sol`** tracks USDC P&L (`recordSpread`, `deposit`, `withdraw`) and exposes `allocateToUSYC` + `deallocateFromUSYC` that crystallize simulated yield at a fixed 4.50% APY against the current allocation. The full interface matches what a real USYC call would look like — swap in the real Teller call when allowlisted on mainnet.

---

## Circle tools used

| Tool | How |
|---|---|
| **USDC** | All bets, payouts, treasury, and gas — Arc's native gas token. No ETH or other asset anywhere in the stack. ERC-20 view for 6-decimal math, native view for 18-decimal gas accounting. |
| **Wallets** | EOA via wagmi + viem `injected` connector (MetaMask, Rabby, any EIP-1193 wallet). Arc Testnet auto-prompts to add the network on first connect. |
| **Smart Contracts** | Custom Solidity 0.8.24 contracts deployed via Hardhat. OpenZeppelin `IERC20` + `SafeERC20`. Verifiable on arcscan. |
| **USYC** | Simulated 4.50% APY yield on idle treasury, surfaced in the AgentDashboard with a clear "Simulated · mainnet feature" badge. Real on-chain integration deferred — testnet USYC is gated by institutional allowlist + $100K minimum. See [scope notes](#scope-decisions-locked-day-0). |
| **App Kit** | Send / Bridge flow referenced in user onboarding (USDC funding path from other chains via CCTP). |
| **Paymaster** | Deferred (parking lot). Arc's native USDC-gas already delivers the no-foreign-token UX, so ERC-4337 sponsored gas is currently redundant. Revisit if first-time-onboarder sponsorship becomes a need. |

---

## Traction

| Metric | Day 3 |
|---|---|
| Live markets | **8** (5 agent-priced, 1 hand-coded test, 2 awaiting next agent run) |
| Categories | 3 — crypto / macro / on-chain |
| Total volume | 1.00 USDC |
| Agent decisions persisted | 7 |
| Deploy + interaction cost | ~0.07 USDC across all txs |

Example transactions:
- **Market #0 created** — [`0x2095b1...`](https://testnet.arcscan.app/tx/0x2095b120c3404320660ed778eb9bf1b1a7f9cb6b713bf6e31ff59a527eb74dd7)
- **First bet placed** — 1 USDC on YES, market #0 — [`0x6cb67b...`](https://testnet.arcscan.app/tx/0x6cb67b3624f9a387592bb8ac02743c205ab49af35c3fda09566fce481b722b92)
- **Market #4 created by agent** — BTC > $110K — [`0x84b017...`](https://testnet.arcscan.app/tx/0x84b017413e4331091ec882ad48ba0ab2472fda76cd8f36d38a2e41a8523bbce3)

Updated daily until submission.

---

## Running locally

```bash
# Clone
git clone https://github.com/neromtoobad/forum.git && cd forum

# Install
npm install
cd frontend && npm install && cd ..

# Configure
cp .env.example .env
# fill in PRIVATE_KEY (Arc Testnet wallet, fund at https://faucet.circle.com)
# fill in ANTHROPIC_API_KEY (https://console.anthropic.com)

# Verify env
node scripts/check-env.js

# Test
npx hardhat test           # 124 tests, all green

# Deploy your own contracts (optional — defaults to our live addresses)
npx hardhat run scripts/deploy.js --network arcTestnet

# Run the agent (creates 1 market)
node agent/index.js run

# Run the frontend
cd frontend && npm run dev
```

The frontend's contract addresses are baked into the build but overridable via `VITE_FACTORY_ADDRESS` / `VITE_PM_ADDRESS` / `VITE_TREASURY_ADDRESS` env vars on Vercel.

---

## Agent CLI

```bash
node agent/index.js status                  # chain + agent state
node agent/index.js markets                 # list current markets
node agent/index.js run                     # create 1 market via Claude
node agent/index.js run 3                   # create up to 3 markets
node agent/index.js resolve <id> <yes|no>   # resolve a market
```

---

## Scope decisions (locked Day 0)

We named our trade-offs up front. Both are documented in [CLAUDE.md](CLAUDE.md):

- **Paymaster deferred to parking lot.** Arc uses USDC as native gas, so the "no separate gas token" UX is delivered by Arc itself. EOA wallets are sufficient. Re-add Paymaster post-submission if a clear UX reason emerges (e.g., agent sponsoring gas for first-time onboarders with empty wallets).
- **USYC simulated.** Real USYC integration requires Circle institutional allowlist + $100K minimum, which doesn't fit a four-day timeline. The Treasury contract exposes the full `allocateToUSYC` / `deallocateFromUSYC` interface and accrues simulated yield at 4.50% APY — swap in the real Teller call when allowlisted on mainnet.

---

## Tests

<a id="tests"></a>

```
PredictionMarket  34 ✓     constructor · createMarket · placeBet · updateOdds
                            resolveMarket · claimWinnings · getMarket
MarketFactory     17 ✓     constructor (incl. PM deploy + agent wiring)
                            proxy: createMarket · updateOdds · resolveMarket
                            getAllMarkets · end-to-end lifecycle
Treasury          24 ✓     deposit · withdraw · recordSpread
                            allocateToUSYC · deallocateFromUSYC
                            simulated yield math (1y / half-y / re-allocation)
─────────────────────────
Contract suite    75

agent/odds        19 ✓     probability → odds → implied prob → overround
agent/estimator   18 ✓     validate · extractJson · mocked Claude client
agent/scanner      7 ✓     filtering · categories · deadline parsing
agent/index        5 ✓     orchestrator wiring with mocks
─────────────────────────
Agent suite       49

Total            124 passing
```

```bash
npx hardhat test
```

---

## Built for

[Canteen × Circle × Arc hackathon](https://thecanteenapp.com), May 21–25, 2026.

Submitted by [@neromtoobad](https://github.com/neromtoobad).
