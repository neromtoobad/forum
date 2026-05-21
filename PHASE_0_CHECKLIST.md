# PHASE 0 CHECKLIST — Before Writing Any Code

Complete every item in order. Do not start Day 1 build until this is done.

---

## 1. Canteen CLI Setup
- [x] Install CLI: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git`
- [x] Login with GitHub: `arc-canteen login`
- [x] Print RPC URL: `arc-canteen rpc-url`
- [x] Export to shell: `eval $(arc-canteen rpc-url --export)` — confirm $RPC is set
- [x] Add to shell init: `arc-canteen shell-init` → paste snippet into ~/.bashrc or ~/.zshrc
- [x] Sync context: `arc-canteen context sync`
- [x] Verify docs pulled: `ls ~/.arc-canteen/context/`

---

## 2. RPC Validation
- [x] Chain ID check: `arc-canteen rpc eth_chainId` → must return 5042002
- [x] Block number check: `arc-canteen rpc eth_blockNumber` → must return a live number
- [x] Open block explorer: https://testnet.arcscan.app — confirm it loads

---

## 3. Dev Environment
- [x] Node.js 18+: `node --version`
- [x] npm/yarn ready
- [x] Install Hardhat: `npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox`
- [x] Install ethers v6: `npm install ethers`
- [x] Install Anthropic SDK: `npm install @anthropic-ai/sdk`
- [x] Install dotenv: `npm install dotenv`

---

## 4. Environment Variables
Create `.env` at project root. Never commit this file.
```
RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<your-key>
PRIVATE_KEY=<agent-wallet-private-key>
ANTHROPIC_API_KEY=<your-key>
NEWSAPI_KEY=<your-key>
```
- [x] .env created (stub from .env.example)
- [x] .gitignore includes .env
- [ ] PRIVATE_KEY filled in (agent wallet, then fund at https://faucet.circle.com)
- [ ] ANTHROPIC_API_KEY filled in
- [ ] NEWSAPI_KEY filled in (optional — RSS fallback exists)

---

## 5. Arc Testnet Config (hardhat.config.js)
```js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: process.env.RPC_URL,
      chainId: 5042002,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```
- [x] hardhat.config.js created with Arc testnet config
- [x] Test compile: `npx hardhat compile` — no errors

---

## 6. Contract Addresses to Find Before Building
Pull these from arc-canteen context docs before writing any contract interaction code.
All addresses confirmed in [config/addresses.json](config/addresses.json).
- [x] USDC: `0x3600000000000000000000000000000000000000` (6 decimals via ERC-20)
- [x] USYC: `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` (gated — simulated for demo)
- [x] Paymaster v0.7/v0.8 addresses found (deferred — see CLAUDE.md design decisions)
- [x] Circle Wallets SDK — using wagmi/viem EOA path (no SDK needed for Phase 1)

---

## 7. Scope Lock — Answer These Before Coding
Write your answers here. Do not proceed until all are answered.

**Who is the user?**
→ Anyone who wants to bet USDC on real-world events without needing gas tokens

**What is the core action?**
→ User sees a market the agent created, places a USDC bet, wins or loses USDC

**What is the demo moment?**
→ Agent creates market with live reasoning → user bets gaslessly →
market resolves → USDC paid in under 1 second, visible on arcscan.app

**Which 3 market types at launch?**
→ Crypto price events / Macro events / On-chain protocol events

**Max live markets at launch?**
→ 5 markets maximum

**What does the agent NOT do?**
→ Does not hedge, does not trade other protocols, does not manage user portfolios

---

## 8. First Traction Target
Before Day 3 ends, you need real users. Plan this now.
- [ ] Identify 3 people who will bet on testnet (Discord contacts, community)
- [ ] Know which Canteen/Arc Discord channels to post in
- [ ] Draft your "come try this" message now (1–2 lines max)

---

## 9. Kill Switches
If any of these happen, stop and simplify immediately:

| Blocker | Simplification |
|---------|----------------|
| Paymaster integration takes >6 hours | Ship without it. User pays ~$0.01 gas. Still fine. |
| USYC not on testnet | Remove USYC. Mention it in README as planned mainnet feature. |
| Agent reasoning too slow | Pre-cache reasoning. Show stored reasoning trace, not live. |
| Contract bug day 3 | Freeze contracts. Ship with bug-free subset of features. |

---

## Phase 0 Complete When:
- [x] arc-canteen rpc returns live block numbers
- [x] hardhat compiles against Arc testnet config
- [x] All contract addresses confirmed (config/addresses.json)
- [x] Scope lock answers written above
- [ ] First product update sent: `arc-canteen update product`
- [ ] Agent wallet PRIVATE_KEY in .env + funded with testnet USDC (blocks Day 1 deploy)
