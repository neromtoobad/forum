// scripts/interact.js — Day 1 manual test against the LIVE Arc contracts.
// Creates a market via MarketFactory, approves USDC, places a real USDC bet,
// then reads back state to confirm. Each step prints an arcscan link.
//
// Usage:
//   . ~/.arc-canteen/env
//   npx hardhat run scripts/interact.js --network arcTestnet

const hre = require("hardhat");

async function main() {
  const deployment = require("../deployments/arcTestnet.json");
  const addresses = require("../config/addresses.json");
  const explorer = addresses.explorer;

  const [signer] = await hre.ethers.getSigners();
  console.log(`\nSigner: ${signer.address}`);
  const startBal = await hre.ethers.provider.getBalance(signer.address);
  console.log(`USDC balance (native): ${hre.ethers.formatUnits(startBal, 18)} USDC\n`);

  const factory = await hre.ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory,
    signer
  );
  const pm = await hre.ethers.getContractAt(
    "PredictionMarket",
    deployment.contracts.PredictionMarket,
    signer
  );
  const usdcAbi = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];
  const usdc = new hre.ethers.Contract(addresses.tokens.USDC.address, usdcAbi, signer);

  // ─── 1. Create market ────────────────────────────────────────────────────
  const question = "Will Bitcoin close above $100,000 on 2026-06-01?";
  const deadline = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
  const yesOdds = 1500n;
  const noOdds = 2500n;

  console.log("→ Creating market");
  console.log(`  question: ${question}`);
  console.log(`  deadline: ${new Date(deadline * 1000).toISOString()}`);
  console.log(`  yesOdds:  ${yesOdds} (${Number(yesOdds) / 1000}x)`);
  console.log(`  noOdds:   ${noOdds} (${Number(noOdds) / 1000}x)`);

  const before = await factory.marketCount();
  const createTx = await factory.createMarket(question, deadline, yesOdds, noOdds);
  console.log(`  tx:       ${explorer}/tx/${createTx.hash}`);
  await createTx.wait();
  const after = await factory.marketCount();
  const marketId = after - 1n;
  console.log(`  marketId: ${marketId}\n`);

  // ─── 2. Approve USDC ─────────────────────────────────────────────────────
  const betAmount = hre.ethers.parseUnits("1", 6); // 1 USDC (6-decimal ERC-20 view)
  console.log(`→ Approving 1 USDC to PredictionMarket`);
  const approveTx = await usdc.approve(deployment.contracts.PredictionMarket, betAmount);
  console.log(`  tx:        ${explorer}/tx/${approveTx.hash}`);
  await approveTx.wait();
  const allowance = await usdc.allowance(signer.address, deployment.contracts.PredictionMarket);
  console.log(`  allowance: ${hre.ethers.formatUnits(allowance, 6)} USDC\n`);

  // ─── 3. Place bet ────────────────────────────────────────────────────────
  console.log(`→ Placing 1 USDC bet on YES for marketId ${marketId}`);
  const betTx = await pm.placeBet(marketId, true, betAmount);
  console.log(`  tx: ${explorer}/tx/${betTx.hash}`);
  await betTx.wait();

  // ─── 4. Read state to confirm ────────────────────────────────────────────
  const market = await pm.getMarket(marketId);
  const myYes = await pm.yesBets(marketId, signer.address);
  const pmBal = await usdc.balanceOf(deployment.contracts.PredictionMarket);
  const endBal = await hre.ethers.provider.getBalance(signer.address);

  console.log(`\n✓ Market #${marketId} state on-chain:`);
  console.log(`  question:      ${market.question}`);
  console.log(`  totalYesBets:  ${hre.ethers.formatUnits(market.totalYesBets, 6)} USDC`);
  console.log(`  totalNoBets:   ${hre.ethers.formatUnits(market.totalNoBets, 6)} USDC`);
  console.log(`  resolved:      ${market.resolved}`);
  console.log(`  your YES bet:  ${hre.ethers.formatUnits(myYes, 6)} USDC`);
  console.log(`  PM USDC bal:   ${hre.ethers.formatUnits(pmBal, 6)} USDC`);
  // delta = (bet that moved to contract) + (gas paid in native USDC)
  const delta = startBal - endBal;
  const betInNative = betAmount * (10n ** 12n); // 6-dec ERC-20 → 18-dec native
  const gasInNative = delta - betInNative;
  console.log(`  gas spent:     ${hre.ethers.formatUnits(gasInNative, 18)} USDC (3 txs)`);

  console.log(`\nArcscan links:`);
  console.log(`  MarketFactory:    ${explorer}/address/${deployment.contracts.MarketFactory}`);
  console.log(`  PredictionMarket: ${explorer}/address/${deployment.contracts.PredictionMarket}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
