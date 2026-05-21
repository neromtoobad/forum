// Verifies .env is wired up correctly. Never prints secrets.
// Usage: node scripts/check-env.js

require("dotenv").config();
const { ethers } = require("ethers");
const addresses = require("../config/addresses.json");

function mask(label, val, expectedPrefix) {
  if (!val) return `  ${label}: ❌ missing`;
  const okPrefix = expectedPrefix ? val.startsWith(expectedPrefix) : true;
  const status = okPrefix ? "✓" : "⚠ wrong prefix";
  return `  ${label}: ${status} (${val.length} chars)`;
}

async function main() {
  console.log("Checking .env...\n");

  const rpc = process.env.RPC_URL || process.env.RPC;
  console.log(`  RPC_URL or $RPC: ${rpc ? "✓ set" : "❌ missing"}`);
  console.log(mask("PRIVATE_KEY", process.env.PRIVATE_KEY, "0x"));
  console.log(mask("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY, "sk-ant-"));
  console.log(mask("NEWSAPI_KEY (optional)", process.env.NEWSAPI_KEY));

  if (!rpc || !process.env.PRIVATE_KEY) {
    console.log("\n❌ Missing required vars. Stopping.");
    process.exit(1);
  }

  console.log("\nConnecting to Arc testnet...");
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const [chainId, blockNumber, balanceWei] = await Promise.all([
    provider.send("eth_chainId", []),
    provider.getBlockNumber(),
    provider.getBalance(wallet.address),
  ]);

  console.log(`  chainId: ${parseInt(chainId, 16)} ${parseInt(chainId, 16) === addresses.chainId ? "✓" : "❌ expected " + addresses.chainId}`);
  console.log(`  blockNumber: ${blockNumber} ✓ (live)`);
  console.log(`\nAgent wallet: ${wallet.address}`);

  // USDC is native gas on Arc, so eth_getBalance returns native USDC in 18 decimals.
  const nativeUsdc = ethers.formatUnits(balanceWei, 18);
  console.log(`  Native USDC (gas balance): ${nativeUsdc}`);

  // Also read ERC-20 view for confirmation (6 decimals).
  const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(addresses.tokens.USDC.address, usdcAbi, provider);
  const erc20Balance = await usdc.balanceOf(wallet.address);
  console.log(`  ERC-20 USDC balance: ${ethers.formatUnits(erc20Balance, 6)}`);

  if (balanceWei === 0n) {
    console.log(`\n⚠  Wallet has 0 USDC. Fund it: https://faucet.circle.com (Arc Testnet → USDC → ${wallet.address})`);
  } else {
    console.log(`\n✓ Wallet funded — ready to deploy contracts.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
