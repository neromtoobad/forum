# BUILD GUIDE — FORUM
## 4-Day Build Plan · May 21–24 · Submit May 25

---

## Day 1 — Smart Contracts on Arc
**Goal: PredictionMarket.sol deployed and verified on Arc testnet**

### Morning — Read Before Writing
- [ ] Run `arc-canteen context` — read AGENTS.md
- [ ] Browse `~/.arc-canteen/context/` — find the escrow and commerce examples
- [ ] Read Circle Contracts docs — understand USDC transfer patterns on Arc
- [ ] Identify USDC token address on Arc testnet

### Afternoon — Write Contracts
**PredictionMarket.sol**
```solidity
// Core functions to implement
createMarket(string memory question, uint256 deadline, uint256 yesOdds)
  → emits MarketCreated(marketId, question, yesOdds)

placeBet(uint256 marketId, bool isYes, uint256 amount)
  → transfers USDC from user to contract
  → records bet position
  → emits BetPlaced(marketId, user, isYes, amount)

resolveMarket(uint256 marketId, bool outcome)
  → onlyAgent modifier
  → sets winner side
  → emits MarketResolved(marketId, outcome)

claimWinnings(uint256 marketId)
  → calculates payout based on odds + position
  → transfers USDC to winner
  → emits WinningsClaimed(user, amount)
```

**MarketFactory.sol**
```solidity
// Deploys and indexes PredictionMarket instances
// Keeps registry of all markets for frontend to read
deployMarket(string memory question, uint256 deadline, uint256 yesOdds)
getAllMarkets() → returns address[]
```

- [ ] PredictionMarket.sol written
- [ ] MarketFactory.sol written
- [ ] Unit tests pass: `npx hardhat test`

### Evening — Deploy + Verify
- [ ] Deploy to Arc testnet: `npx hardhat run scripts/deploy.js --network arcTestnet`
- [ ] Save deployed addresses to `deployments/arcTestnet.json`
- [ ] Verify on arcscan.app — find your contract
- [ ] Run manual test: create 1 market, place 1 bet via hardhat script
- [ ] Send first update: `arc-canteen update product`

**Day 1 Done When**: contract address live on arcscan.app, bet placed in test script ✓

---

## Day 2 — AI Agent
**Goal: agent autonomously creates markets and sets odds**

### Morning — Data + Reasoning Layer
```
agent/
  index.js          — main loop
  scanner.js        — reads news, selects marketable events
  estimator.js      — Claude estimates P(yes) with reasoning
  odds.js           — converts probability to decimal odds with edge
  executor.js       — calls Arc contracts via ethers.js
```

**scanner.js** — Event Scanner
- Pull from NewsAPI (or RSS feeds as fallback)
- Filter for events that are: binary, time-bounded, verifiable
- Return: { headline, description, resolutionDate, category }

**estimator.js** — Probability Estimator
```js
// Claude prompt structure
const systemPrompt = `You are a prediction market analyst.
Given a real-world event, estimate the probability it resolves YES.
Return JSON only: { probability: 0.0-1.0, reasoning: string, confidence: low|medium|high }
Base your estimate on available facts. Be calibrated, not confident.`;
```

- [ ] Scanner pulls live events
- [ ] Estimator returns P(yes) + reasoning for 3 test events

### Afternoon — Odds Engine + Contract Execution
**odds.js** — Bookmaker Odds
```js
// Convert probability to decimal odds with 5% bookmaker margin
function probabilityToOdds(p) {
  const margin = 0.05;
  const yesOdds = (1 / p) * (1 + margin);   // decimal odds for YES
  const noOdds  = (1 / (1-p)) * (1 + margin); // decimal odds for NO
  return { yesOdds, noOdds };
}
// Store odds * 1000 as uint in contract (avoid floats in Solidity)
```

**executor.js** — Arc Contract Calls
```js
// createMarket on Arc
async function createMarket(question, deadline, yesOdds) {
  const factory = new ethers.Contract(FACTORY_ADDRESS, abi, signer);
  const tx = await factory.deployMarket(question, deadline, yesOdds);
  await tx.wait();
  return tx.hash;
}
```

- [ ] Agent creates 3 live markets on Arc testnet
- [ ] Each market visible on arcscan.app with reasoning stored

### Evening — Odds Updater + Resolver
**Odds Updater** — runs every 10 minutes
- Re-estimates probability if new relevant news appears
- Adjusts odds if one side is heavily over-bet (balance the book)
- Calls updateOdds() on contract

**Resolver** — checks for event outcomes
- Monitors resolution dates
- Fetches outcome from data source
- Calls resolveMarket() on contract

- [ ] Odds updater running
- [ ] Manual resolver test: resolve 1 market, confirm USDC claimable
- [ ] Send traction update: `arc-canteen update traction`

**Day 2 Done When**: 3 live markets on Arc, agent loop running, resolver tested ✓

---

## Day 3 — Frontend + Circle Tools
**Goal: users can bet, reasoning visible, Paymaster working**

### Morning — React Scaffold + Market Listing
```
frontend/
  src/
    App.jsx
    components/
      MarketList.jsx      — lists all active markets
      MarketCard.jsx      — single market: question, odds, volume, deadline
      ReasoningPanel.jsx  — agent's reasoning for this market
      BetForm.jsx         — USDC amount + YES/NO + submit
      AgentDashboard.jsx  — P&L, spread earned, USYC yield, volume
```

**MarketList.jsx** — reads from MarketFactory.getAllMarkets()
- Shows: question, current odds, total volume, time remaining
- Clicking opens MarketCard with full reasoning

**BetForm.jsx** — core user action
- Input: USDC amount
- Toggle: YES / NO
- Submit: calls placeBet() via ethers.js
- Show estimated payout before confirming

- [ ] MarketList renders live markets from contract
- [ ] BetForm submits a real bet to Arc testnet

### Afternoon — Paymaster + USYC + Reasoning Panel
**Paymaster Integration**
- Wrap bet submission in Paymaster call
- User sees zero gas cost
- All fees paid in USDC internally
- Read Circle Paymaster docs from arc-canteen context

**USYC Panel** (show idle treasury yield)
- Read agent treasury USDC balance
- Read USYC balance + current yield
- Show: "Treasury: X USDC | Earning Y% in USYC"
- Note: if USYC not on testnet, display as simulated with note

**ReasoningPanel.jsx**
- Fetch reasoning stored per market (store in backend or contract event)
- Display: probability estimate, key factors, confidence level
- This is the trust layer — users see why the agent priced it this way

- [ ] Paymaster working — bet goes through with zero gas UX
- [ ] USYC panel showing treasury yield (real or simulated with note)
- [ ] Reasoning visible per market

### Evening — Get Real Users
- [ ] Deploy frontend to Vercel: `vercel deploy`
- [ ] Share link in Canteen Discord with 1-line description
- [ ] Share in Arc builder Discord
- [ ] Get minimum 3 real wallets placing bets
- [ ] Screenshot all bets + transactions for traction submission
- [ ] Send traction update: `arc-canteen update traction`

**Day 3 Done When**: live URL, 3+ real users, Paymaster working, reasoning visible ✓

---

## Day 4 — Polish + Demo + Submit
**Goal: recorded demo, clean repo, submitted before deadline**

### Morning — Fix + Polish
- [ ] Test full user flow end-to-end (fresh wallet, no prior setup)
- [ ] Fix any broken states from Day 3 testing
- [ ] AgentDashboard showing real P&L numbers
- [ ] Make sure arcscan.app links work for all transactions

### Afternoon — Record Demo (3 minutes max)
**Script**:
```
0:00 — "Prediction markets are only as good as the intelligence pricing them.
        FORUM puts an AI agent in the bookmaker's seat."

0:20 — Show agent scanning live news, selecting an event
0:35 — Show agent reasoning: probability estimate, key factors
0:50 — Show market appearing on Arc (arcscan.app tx)

1:00 — User flow: connect wallet, see market, see reasoning
1:20 — Place USDC bet — zero gas confirmation
1:35 — Show odds updating in real time

1:50 — Show agent treasury + USYC yield
2:05 — Resolve a test market, show USDC paid in <1 second

2:20 — Traction numbers: X users, X markets, X USDC volume
2:35 — "Everything on Arc. USDC in, USDC out. No gas tokens."
2:45 — End
```

- [ ] Loom/YouTube recorded and unlisted link ready

### Evening — README + Submit
**README structure**
```md
# FORUM — AI Bookmaker on Arc

[one-line description]
[live demo link]

## The Idea
[3 sentences: problem, solution, why Arc]

## How It Works
[5 bullet points — user journey]

## Circle Tools Used
[table: tool → how used]

## Traction
- X users onboarded
- X markets created  
- X USDC wagered
- Tx examples: [arcscan links]

## Architecture
[diagram or bullet list]

## Running Locally
[setup steps]
```

- [ ] README written and pushed
- [ ] GitHub repo public
- [ ] All contract addresses in README
- [ ] Arcscan links for real transactions included

### Submit
- [ ] forms.gle/ok3Gr9zhmHnApvK48
  - GitHub repo link
  - Loom/YouTube demo link
  - Live product URL
  - Traction numbers written in form
- [ ] Submit early (you can resubmit — do it now, improve later)
- [ ] Final traction update: `arc-canteen update traction`

---

## Traction Tracking (update daily)
| Day | Markets Live | Users | Bets Placed | USDC Volume |
|-----|-------------|-------|-------------|-------------|
| 1   |             |       |             |             |
| 2   |             |       |             |             |
| 3   |             |       |             |             |
| 4   |             |       |             |             |

---

## Narrative for Judges (memorize this)
"Prediction markets are only useful if the odds are right.
Today they're priced by slow, distracted humans.
FORUM puts an AI agent in the bookmaker's chair —
it scans events, estimates probabilities with live reasoning,
and creates markets that actually reflect what's true.
Everything settles on Arc in under a second.
USDC in, USDC out. No gas tokens. No waiting."
