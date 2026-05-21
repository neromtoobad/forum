const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const usdc = (n) => ethers.parseUnits(String(n), 6);

describe("MarketFactory", function () {
  async function deployFixture() {
    const [deployer, agent, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();

    const MF = await ethers.getContractFactory("MarketFactory");
    const factory = await MF.deploy(token.target, agent.address);
    await factory.waitForDeployment();

    const pmAddress = await factory.predictionMarket();
    const pm = await ethers.getContractAt("PredictionMarket", pmAddress);

    await token.mint(alice.address, usdc(1000));
    await token.mint(bob.address, usdc(1000));

    return { factory, pm, token, deployer, agent, alice, bob };
  }

  describe("constructor", function () {
    it("reverts on zero usdc address", async function () {
      const { agent } = await loadFixture(deployFixture);
      const MF = await ethers.getContractFactory("MarketFactory");
      await expect(MF.deploy(ethers.ZeroAddress, agent.address)).to.be.revertedWith(
        "MarketFactory: zero usdc"
      );
    });

    it("reverts on zero agent address", async function () {
      const { token } = await loadFixture(deployFixture);
      const MF = await ethers.getContractFactory("MarketFactory");
      await expect(MF.deploy(token.target, ethers.ZeroAddress)).to.be.revertedWith(
        "MarketFactory: zero agent"
      );
    });

    it("deploys a PredictionMarket with the factory as its agent", async function () {
      const { factory, pm } = await loadFixture(deployFixture);
      expect(await pm.agent()).to.equal(factory.target);
    });

    it("PM is wired to the same USDC token", async function () {
      const { pm, token } = await loadFixture(deployFixture);
      expect(await pm.usdcToken()).to.equal(token.target);
    });

    it("stores the EOA agent on the factory", async function () {
      const { factory, agent } = await loadFixture(deployFixture);
      expect(await factory.agent()).to.equal(agent.address);
    });
  });

  describe("createMarket", function () {
    it("reverts when called by non-agent", async function () {
      const { factory, alice } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(
        factory.connect(alice).createMarket("Q?", deadline, 1500, 2500)
      ).to.be.revertedWith("MarketFactory: not agent");
    });

    it("proxies to PM.createMarket and increments count", async function () {
      const { factory, pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(factory.connect(agent).createMarket("Q?", deadline, 1500, 2500))
        .to.emit(pm, "MarketCreated")
        .withArgs(0n, "Q?", deadline, 1500n, 2500n);
      expect(await factory.marketCount()).to.equal(1n);
    });
  });

  describe("updateOdds", function () {
    it("reverts when called by non-agent", async function () {
      const { factory, agent, alice } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);
      await expect(
        factory.connect(alice).updateOdds(0, 1800, 2200)
      ).to.be.revertedWith("MarketFactory: not agent");
    });

    it("proxies to PM.updateOdds", async function () {
      const { factory, pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);
      await expect(factory.connect(agent).updateOdds(0, 1800, 2200))
        .to.emit(pm, "OddsUpdated")
        .withArgs(0n, 1800n, 2200n);
      const m = await pm.getMarket(0);
      expect(m.yesOdds).to.equal(1800n);
      expect(m.noOdds).to.equal(2200n);
    });
  });

  describe("resolveMarket", function () {
    it("reverts when called by non-agent", async function () {
      const { factory, agent, alice } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);
      await expect(
        factory.connect(alice).resolveMarket(0, true)
      ).to.be.revertedWith("MarketFactory: not agent");
    });

    it("proxies to PM.resolveMarket", async function () {
      const { factory, pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);
      await expect(factory.connect(agent).resolveMarket(0, true))
        .to.emit(pm, "MarketResolved")
        .withArgs(0n, true);
      const m = await pm.getMarket(0);
      expect(m.resolved).to.equal(true);
      expect(m.outcome).to.equal(true);
    });
  });

  describe("getAllMarkets", function () {
    it("returns an empty array when no markets exist", async function () {
      const { factory } = await loadFixture(deployFixture);
      const markets = await factory.getAllMarkets();
      expect(markets.length).to.equal(0);
    });

    it("returns a single market populated correctly", async function () {
      const { factory, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q1", deadline, 1500, 2500);

      const markets = await factory.getAllMarkets();
      expect(markets.length).to.equal(1);
      expect(markets[0].marketId).to.equal(0n);
      expect(markets[0].market.question).to.equal("Q1");
      expect(markets[0].market.deadline).to.equal(BigInt(deadline));
      expect(markets[0].market.yesOdds).to.equal(1500n);
      expect(markets[0].market.noOdds).to.equal(2500n);
      expect(markets[0].market.exists).to.equal(true);
    });

    it("returns multiple markets in creation order", async function () {
      const { factory, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q1", deadline, 1500, 2500);
      await factory.connect(agent).createMarket("Q2", deadline, 1800, 2200);
      await factory.connect(agent).createMarket("Q3", deadline, 1100, 9000);

      const markets = await factory.getAllMarkets();
      expect(markets.length).to.equal(3);
      expect(markets[0].market.question).to.equal("Q1");
      expect(markets[1].market.question).to.equal("Q2");
      expect(markets[2].market.question).to.equal("Q3");
      expect(markets[2].market.yesOdds).to.equal(1100n);
    });

    it("reflects updated odds in subsequent reads", async function () {
      const { factory, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);
      await factory.connect(agent).updateOdds(0, 1800, 2200);

      const markets = await factory.getAllMarkets();
      expect(markets[0].market.yesOdds).to.equal(1800n);
      expect(markets[0].market.noOdds).to.equal(2200n);
    });
  });

  describe("end-to-end via factory", function () {
    it("user can bet directly on the underlying PM after a factory-created market", async function () {
      const { factory, pm, token, agent, alice } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);

      await token.connect(alice).approve(pm.target, usdc(10));
      await expect(pm.connect(alice).placeBet(0, true, usdc(10)))
        .to.emit(pm, "BetPlaced")
        .withArgs(0n, alice.address, true, usdc(10));

      const m = await pm.getMarket(0);
      expect(m.totalYesBets).to.equal(usdc(10));
    });

    it("full lifecycle: create → bet → resolve → claim", async function () {
      const { factory, pm, token, agent, alice } = await loadFixture(deployFixture);
      // Pre-fund PM to cover 1.5x payout
      await token.mint(pm.target, usdc(100));

      const deadline = (await time.latest()) + 3600;
      await factory.connect(agent).createMarket("Q?", deadline, 1500, 2500);

      const stake = usdc(10);
      await token.connect(alice).approve(pm.target, stake);
      await pm.connect(alice).placeBet(0, true, stake);

      await factory.connect(agent).resolveMarket(0, true);

      const before = await token.balanceOf(alice.address);
      await pm.connect(alice).claimWinnings(0);
      const after = await token.balanceOf(alice.address);
      expect(after - before).to.equal((stake * 1500n) / 1000n);
    });
  });
});
