# FORUM — Arc-Native Prediction Market with AI Bookmaker

## What We're Building
FORUM is a live information market built exclusively on Arc. An AI agent acts
as the bookmaker — it creates binary prediction markets for real-world events,
sets odds using news and sentiment analysis, accepts USDC bets from users, and
earns from the spread. Every bet settles in sub-second on Arc. Idle treasury
capital earns yield in USYC.

The agora was where Athens priced information. FORUM is where AI prices it now.

---

## Network
- Chain: Arc Testnet
- Chain ID: 5042002
- Currency: USDC (native)
- RPC: https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
- Explorer: https://testnet.arcscan.app

---

## Architecture
```
[AI Agent] → scans news/events → decides what to price
[AI Agent] → calls createMarket → [MarketFactory.sol on Arc]
[AI Agent] → sets initial odds with edge → [PredictionMarket.sol]
[User]     → places USDC bet (USDC IS native gas on Arc) → [PredictionMarket.sol]
[Idle USDC]→ "earning yield in USYC" (simulated for demo) → [Treasury.sol]
[Event resolves] → agent resolves → [winners claim USDC instantly]
```

**Design decisions locked Day 0** (see Parking Lot for rationale):
- Paymaster deferred. Arc uses USDC as native gas, so the "no separate gas
  token" UX is delivered by Arc itself. EOA wallets are sufficient.
- USYC integration is institutional-only on testnet (Circle allowlist +
  $100K min). AgentDashboard shows simulated yield with a "planned mainnet
  feature" badge. Treasury.sol still tracks idle USDC; USYC allocation
  remains a stub callable interface.

---

## What the Agent Decides (Agentic Sophistication)
- Which real-world events to create markets for
- Initial probability estimate per event (news + sentiment analysis)
- Odds with built-in bookmaker edge (5% margin)
- When to update odds based on new information or bet flow imbalance
- When and how to resolve markets based on outcome data
- How much idle capital to park in USYC vs keep liquid for payouts

The agent is not automating a script. It is making economic decisions with
real consequences on every market it opens.

---

## Circle Tools Used
| Tool       | Usage |
|------------|-------|
| USDC       | Native currency AND native gas token — bets, payouts, treasury, fees |
| Wallets    | EOA via wagmi/viem (browser wallet connect) |
| Contracts  | PredictionMarket.sol + MarketFactory.sol + Treasury.sol on Arc |
| USYC       | Idle agent treasury yield — simulated on testnet (see Parking Lot) |
| App Kit    | Send/Bridge UI for USDC deposits into the platform |
| Paymaster  | (Parking Lot — Arc native USDC-gas covers the no-foreign-token UX) |

---

## Smart Contracts (Solidity, Arc EVM)
1. `PredictionMarket.sol` — Core binary market logic
   - createMarket(string question, uint256 deadline, uint256 yesOdds)
   - placeBet(uint256 marketId, bool isYes) payable
   - resolveMarket(uint256 marketId, bool outcome) onlyAgent
   - claimWinnings(uint256 marketId)
2. `MarketFactory.sol` — Factory, indexes all markets
3. `Treasury.sol` — Agent USDC treasury + USYC allocation logic

---

## AI Agent Stack
- Runtime: Node.js
- LLM: claude-sonnet-4-20250514 via Anthropic API
- Data: News APIs + on-chain data (Arc RPC)
- Reasoning: Claude estimates P(yes), generates reasoning trace per market
- Execution: ethers.js → Arc RPC → contract calls

---

## Frontend
- React + ethers.js
- Live market listing (question, odds, volume, deadline)
- Agent reasoning panel (visible per market — why it priced this way)
- Bet placement UI (USDC amount, YES/NO, gasless submit)
- Agent P&L dashboard (spread earned, USYC yield, total volume)

---

## Market Categories (launch scope — 3 at a time max)
1. Crypto price events (will BTC close above $X on date Y?)
2. Macro events (will Fed hold rates at next meeting?)
3. On-chain events (will protocol X reach $Y TVL by date?)

---

## Judging Criteria Alignment
| Criteria              | Weight | How FORUM scores |
|-----------------------|--------|-----------------|
| Agentic Sophistication| 30%    | Agent decides what to price, what odds, when to adjust — full autonomy |
| Traction              | 30%    | Real bets placed, USDC volume, users onboarded — all on-chain verifiable |
| Circle Tool Usage     | 20%    | USDC + Wallets + Contracts + App Kit + USYC (simulated) — full stack on Arc |
| Innovation            | 20%    | Arc-native prediction market with AI bookmaker — new territory |

---

## Key Commands
```bash
# Canteen CLI
arc-canteen rpc-url --export        # export $RPC
arc-canteen context sync            # pull Arc/Circle docs + examples
arc-canteen rpc eth_blockNumber     # verify RPC live
arc-canteen update product          # log build progress
arc-canteen update traction         # log users + volume

# Hardhat
npx hardhat compile
npx hardhat run scripts/deploy.js --network arc-testnet
npx hardhat verify --network arc-testnet <address>

# Agent
node agent/index.js
```

---

## Demo Flow (3 minutes)
- 0:00 — Problem: prediction markets are mispriced because humans are slow
- 0:30 — Agent scans live news, selects event, estimates probability with reasoning
- 1:00 — Agent creates market on Arc (tx visible on arcscan.app)
- 1:30 — User connects wallet, places USDC bet — only USDC needed, USDC pays the gas
- 2:00 — Odds update in real time as bets come in
- 2:15 — Show treasury panel: simulated USYC yield + clear "mainnet feature" badge
- 2:30 — Market resolves, USDC paid to winner in under 1 second
- 2:45 — Agent P&L screen + traction numbers

---

## Session Prompts
**Start of session**: "Read CLAUDE.md. Tell me what we are building, what phase we
are in, and what the next task is."

**Stuck**: "We are blocked on [X]. What is the simplest version of this that still
works for the demo?"

**Phase complete**: "Phase [X] is done. What are the biggest risks in the next phase
and what should we do first?"

**Commit**: "Summarize what we built today in 3 lines for arc-canteen update product."

---

## Scope Rules
Do not add any feature not listed in this file.
If a new idea comes up, write it at the bottom under PARKING LOT.
Delete a current feature before adding a new one.

## Parking Lot
(ideas that don't make the 4-day cut — revisit post-submission)
- ERC-8004 on-chain agent identity
- x402 micropayments for research data
- Multi-agent bookmakers with competing odds
- EURC multi-currency markets
- Circle Paymaster + ERC-4337 SCAs — currently redundant given Arc native
  USDC-gas. Revisit when a UX reason emerges (e.g. agent sponsoring gas for
  first-time onboarders with empty wallets).
- Real USYC integration — requires Circle institutional allowlist + $100K
  minimum. Pursue for mainnet only.
