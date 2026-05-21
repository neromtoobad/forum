// scripts/deploy.js — deploys MarketFactory (which deploys PredictionMarket
// in its constructor) and Treasury to Arc Testnet, then writes the addresses
// and tx hashes to deployments/<network>.json.
//
// Usage:
//   . ~/.arc-canteen/env   # if $RPC isn't already in your shell
//   npx hardhat run scripts/deploy.js --network arcTestnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addresses = require("../config/addresses.json");
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;

  console.log(`\nDeploying to ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Agent:    ${deployer.address} (deployer == agent for hack scope)`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${hre.ethers.formatUnits(balance, 18)} USDC (native gas)`);
  if (balance === 0n) {
    throw new Error(
      `Deployer has 0 USDC. Fund at https://faucet.circle.com (Arc Testnet → USDC → ${deployer.address})`
    );
  }

  const usdcAddress = addresses.tokens.USDC.address;
  console.log(`USDC:     ${usdcAddress}\n`);

  console.log("→ Deploying MarketFactory (also deploys PredictionMarket)...");
  const MF = await hre.ethers.getContractFactory("MarketFactory");
  const factory = await MF.deploy(usdcAddress, deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = factory.target;
  const factoryTx = factory.deploymentTransaction();
  console.log(`  MarketFactory:    ${factoryAddr}`);
  console.log(`  tx:               ${factoryTx.hash}`);

  const pmAddr = await factory.predictionMarket();
  console.log(`  PredictionMarket: ${pmAddr}\n`);

  console.log("→ Deploying Treasury...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(usdcAddress, deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddr = treasury.target;
  const treasuryTx = treasury.deploymentTransaction();
  console.log(`  Treasury:         ${treasuryAddr}`);
  console.log(`  tx:               ${treasuryTx.hash}\n`);

  const deployment = {
    network: networkName,
    chainId: addresses.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    agent: deployer.address,
    contracts: {
      MarketFactory: factoryAddr,
      PredictionMarket: pmAddr,
      Treasury: treasuryAddr,
      USDC: usdcAddress,
    },
    txHashes: {
      MarketFactory: factoryTx.hash,
      Treasury: treasuryTx.hash,
    },
  };

  const deployDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });
  const outPath = path.join(deployDir, `${networkName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Saved deployment → ${path.relative(process.cwd(), outPath)}\n`);

  const explorer = addresses.explorer;
  console.log("Verify on arcscan:");
  console.log(`  MarketFactory:    ${explorer}/address/${factoryAddr}`);
  console.log(`  PredictionMarket: ${explorer}/address/${pmAddr}`);
  console.log(`  Treasury:         ${explorer}/address/${treasuryAddr}`);
  console.log(`  Deploy tx (MF):   ${explorer}/tx/${factoryTx.hash}`);
  console.log(`  Deploy tx (Tr):   ${explorer}/tx/${treasuryTx.hash}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
