// agent/executor.js — ethers.js client that signs and submits createMarket /
// updateOdds / resolveMarket transactions to the live Arc contracts.
//
// Loads contract addresses from deployments/<network>.json and ABIs from
// hardhat artifacts. Reads RPC_URL/RPC and PRIVATE_KEY from env unless
// overridden via constructor options.

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const factoryArtifact = require("../artifacts/contracts/MarketFactory.sol/MarketFactory.json");
const pmArtifact = require("../artifacts/contracts/PredictionMarket.sol/PredictionMarket.json");
const treasuryArtifact = require("../artifacts/contracts/Treasury.sol/Treasury.json");

class ArcExecutor {
  constructor({ rpcUrl, privateKey, deployment, network = "arcTestnet" } = {}) {
    rpcUrl = rpcUrl || process.env.RPC_URL || process.env.RPC;
    privateKey = privateKey || process.env.PRIVATE_KEY;
    if (!rpcUrl) throw new Error("ArcExecutor: missing RPC_URL or RPC");
    if (!privateKey) throw new Error("ArcExecutor: missing PRIVATE_KEY");

    if (!deployment) {
      const deployPath = path.join(__dirname, "..", "deployments", `${network}.json`);
      if (!fs.existsSync(deployPath)) {
        throw new Error(
          `ArcExecutor: no deployment file at ${deployPath}. Run scripts/deploy.js first.`
        );
      }
      deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.deployment = deployment;

    this.factory = new ethers.Contract(
      deployment.contracts.MarketFactory,
      factoryArtifact.abi,
      this.signer
    );
    this.pm = new ethers.Contract(
      deployment.contracts.PredictionMarket,
      pmArtifact.abi,
      this.signer
    );
    this.treasury = new ethers.Contract(
      deployment.contracts.Treasury,
      treasuryArtifact.abi,
      this.signer
    );
    this._pmInterface = new ethers.Interface(pmArtifact.abi);
  }

  get agentAddress() {
    return this.signer.address;
  }

  async status() {
    const [chainHex, blockNumber, balance, count] = await Promise.all([
      this.provider.send("eth_chainId", []),
      this.provider.getBlockNumber(),
      this.provider.getBalance(this.signer.address),
      this.factory.marketCount(),
    ]);
    return {
      chainId: parseInt(chainHex, 16),
      blockNumber,
      agent: this.signer.address,
      balanceUsdc: ethers.formatUnits(balance, 18),
      marketCount: Number(count),
      contracts: this.deployment.contracts,
    };
  }

  async createMarket({ question, deadline, yesOdds, noOdds }) {
    if (!question) throw new Error("createMarket: missing question");
    const now = Math.floor(Date.now() / 1000);
    if (typeof deadline !== "number" || deadline <= now) {
      throw new Error(`createMarket: deadline must be a future unix timestamp, got ${deadline}`);
    }
    if (yesOdds <= 0 || noOdds <= 0) {
      throw new Error("createMarket: odds must be > 0");
    }

    const tx = await this.factory.createMarket(question, deadline, yesOdds, noOdds);
    const receipt = await tx.wait();
    const marketId = this._extractMarketId(receipt);
    return { marketId, txHash: tx.hash, receipt };
  }

  async updateOdds(marketId, yesOdds, noOdds) {
    const tx = await this.factory.updateOdds(marketId, yesOdds, noOdds);
    const receipt = await tx.wait();
    return { txHash: tx.hash, receipt };
  }

  async resolveMarket(marketId, outcome) {
    const tx = await this.factory.resolveMarket(marketId, outcome);
    const receipt = await tx.wait();
    return { txHash: tx.hash, receipt };
  }

  async claimWinnings(marketId) {
    const tx = await this.pm.claimWinnings(marketId);
    const receipt = await tx.wait();
    return { txHash: tx.hash, receipt };
  }

  async getAllMarkets() {
    return await this.factory.getAllMarkets();
  }

  async getMarket(marketId) {
    return await this.pm.getMarket(marketId);
  }

  async marketCount() {
    return Number(await this.factory.marketCount());
  }

  /** Native USDC balance of an address (18 decimals — Arc's native gas view). */
  async nativeBalance(address) {
    return await this.provider.getBalance(address || this.signer.address);
  }

  _extractMarketId(receipt) {
    for (const log of receipt.logs) {
      try {
        const parsed = this._pmInterface.parseLog(log);
        if (parsed?.name === "MarketCreated") {
          return parsed.args.marketId;
        }
      } catch {
        // not an event from PM — skip
      }
    }
    return null;
  }
}

module.exports = { ArcExecutor };
