const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC_DECIMALS = 6;
const usdc = (n) => ethers.parseUnits(String(n), USDC_DECIMALS);

describe("PredictionMarket", function () {
  async function deployFixture() {
    const [deployer, agent, alice, bob, mallory] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();

    const PM = await ethers.getContractFactory("PredictionMarket");
    const pm = await PM.deploy(token.target, agent.address);
    await pm.waitForDeployment();

    await token.mint(alice.address, usdc(1000));
    await token.mint(bob.address, usdc(1000));

    return { pm, token, deployer, agent, alice, bob, mallory };
  }

  async function makeMarket(pm, agent, opts = {}) {
    const deadline = opts.deadline ?? (await time.latest()) + 3600;
    const question = opts.question ?? "Will BTC > $100k by 2026?";
    const yesOdds = opts.yesOdds ?? 1500;
    const noOdds = opts.noOdds ?? 2500;
    await pm.connect(agent).createMarket(question, deadline, yesOdds, noOdds);
    return { marketId: 0n, deadline, question, yesOdds, noOdds };
  }

  describe("constructor", function () {
    it("reverts on zero usdc address", async function () {
      const { agent } = await loadFixture(deployFixture);
      const PM = await ethers.getContractFactory("PredictionMarket");
      await expect(PM.deploy(ethers.ZeroAddress, agent.address)).to.be.revertedWith(
        "PredictionMarket: zero usdc"
      );
    });

    it("reverts on zero agent address", async function () {
      const { token } = await loadFixture(deployFixture);
      const PM = await ethers.getContractFactory("PredictionMarket");
      await expect(PM.deploy(token.target, ethers.ZeroAddress)).to.be.revertedWith(
        "PredictionMarket: zero agent"
      );
    });

    it("stores constructor args and constants", async function () {
      const { pm, token, agent } = await loadFixture(deployFixture);
      expect(await pm.agent()).to.equal(agent.address);
      expect(await pm.usdcToken()).to.equal(token.target);
      expect(await pm.marketCount()).to.equal(0n);
      expect(await pm.ODDS_PRECISION()).to.equal(1000n);
    });
  });

  describe("createMarket", function () {
    it("reverts when called by non-agent", async function () {
      const { pm, alice } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(
        pm.connect(alice).createMarket("Q?", deadline, 1500, 2500)
      ).to.be.revertedWith("PredictionMarket: not agent");
    });

    it("reverts on past deadline", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const past = (await time.latest()) - 1;
      await expect(
        pm.connect(agent).createMarket("Q?", past, 1500, 2500)
      ).to.be.revertedWith("PredictionMarket: deadline in past");
    });

    it("reverts on zero yesOdds", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(
        pm.connect(agent).createMarket("Q?", deadline, 0, 2500)
      ).to.be.revertedWith("PredictionMarket: zero odds");
    });

    it("reverts on zero noOdds", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(
        pm.connect(agent).createMarket("Q?", deadline, 1500, 0)
      ).to.be.revertedWith("PredictionMarket: zero odds");
    });

    it("emits MarketCreated with correct args", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(pm.connect(agent).createMarket("Q?", deadline, 1500, 2500))
        .to.emit(pm, "MarketCreated")
        .withArgs(0n, "Q?", deadline, 1500n, 2500n);
    });

    it("increments marketCount and stores market state", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const { deadline, question, yesOdds, noOdds } = await makeMarket(pm, agent);

      expect(await pm.marketCount()).to.equal(1n);

      const m = await pm.getMarket(0);
      expect(m.question).to.equal(question);
      expect(m.deadline).to.equal(BigInt(deadline));
      expect(m.yesOdds).to.equal(BigInt(yesOdds));
      expect(m.noOdds).to.equal(BigInt(noOdds));
      expect(m.totalYesBets).to.equal(0n);
      expect(m.totalNoBets).to.equal(0n);
      expect(m.resolved).to.equal(false);
      expect(m.outcome).to.equal(false);
      expect(m.exists).to.equal(true);
    });
  });

  describe("placeBet", function () {
    it("reverts on non-existent market", async function () {
      const { pm, alice } = await loadFixture(deployFixture);
      await expect(pm.connect(alice).placeBet(0, true, usdc(10))).to.be.revertedWith(
        "PredictionMarket: no such market"
      );
    });

    it("reverts on zero amount", async function () {
      const { pm, agent, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(alice).placeBet(0, true, 0)).to.be.revertedWith(
        "PredictionMarket: zero amount"
      );
    });

    it("reverts after deadline", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      const { deadline } = await makeMarket(pm, agent);
      await token.connect(alice).approve(pm.target, usdc(10));
      await time.increaseTo(deadline + 1);
      await expect(pm.connect(alice).placeBet(0, true, usdc(10))).to.be.revertedWith(
        "PredictionMarket: past deadline"
      );
    });

    it("reverts after market is resolved", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await pm.connect(agent).resolveMarket(0, true);
      await token.connect(alice).approve(pm.target, usdc(10));
      await expect(pm.connect(alice).placeBet(0, true, usdc(10))).to.be.revertedWith(
        "PredictionMarket: market resolved"
      );
    });

    it("records YES bet, transfers USDC, emits BetPlaced", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      const amount = usdc(10);
      await token.connect(alice).approve(pm.target, amount);

      await expect(pm.connect(alice).placeBet(0, true, amount))
        .to.emit(pm, "BetPlaced")
        .withArgs(0n, alice.address, true, amount);

      expect(await token.balanceOf(pm.target)).to.equal(amount);
      expect(await pm.yesBets(0, alice.address)).to.equal(amount);
      const m = await pm.getMarket(0);
      expect(m.totalYesBets).to.equal(amount);
      expect(m.totalNoBets).to.equal(0n);
    });

    it("records NO bet correctly", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      const amount = usdc(10);
      await token.connect(alice).approve(pm.target, amount);
      await pm.connect(alice).placeBet(0, false, amount);

      expect(await pm.noBets(0, alice.address)).to.equal(amount);
      const m = await pm.getMarket(0);
      expect(m.totalNoBets).to.equal(amount);
    });

    it("accumulates multiple bets from same user", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      const a1 = usdc(5);
      const a2 = usdc(7);
      await token.connect(alice).approve(pm.target, a1 + a2);
      await pm.connect(alice).placeBet(0, true, a1);
      await pm.connect(alice).placeBet(0, true, a2);

      expect(await pm.yesBets(0, alice.address)).to.equal(a1 + a2);
      const m = await pm.getMarket(0);
      expect(m.totalYesBets).to.equal(a1 + a2);
    });

    it("reverts without approval (SafeERC20 propagates)", async function () {
      const { pm, agent, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(alice).placeBet(0, true, usdc(10))).to.be.reverted;
    });
  });

  describe("updateOdds", function () {
    it("reverts when called by non-agent", async function () {
      const { pm, agent, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(alice).updateOdds(0, 1800, 2200)).to.be.revertedWith(
        "PredictionMarket: not agent"
      );
    });

    it("reverts on non-existent market", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await expect(pm.connect(agent).updateOdds(99, 1800, 2200)).to.be.revertedWith(
        "PredictionMarket: no such market"
      );
    });

    it("reverts on resolved market", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await pm.connect(agent).resolveMarket(0, true);
      await expect(pm.connect(agent).updateOdds(0, 1800, 2200)).to.be.revertedWith(
        "PredictionMarket: market resolved"
      );
    });

    it("reverts on zero odds", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(agent).updateOdds(0, 0, 2200)).to.be.revertedWith(
        "PredictionMarket: zero odds"
      );
    });

    it("updates odds and emits", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(agent).updateOdds(0, 1800, 2200))
        .to.emit(pm, "OddsUpdated")
        .withArgs(0n, 1800n, 2200n);
      const m = await pm.getMarket(0);
      expect(m.yesOdds).to.equal(1800n);
      expect(m.noOdds).to.equal(2200n);
    });
  });

  describe("resolveMarket", function () {
    it("reverts when called by non-agent", async function () {
      const { pm, agent, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(alice).resolveMarket(0, true)).to.be.revertedWith(
        "PredictionMarket: not agent"
      );
    });

    it("reverts on non-existent market", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await expect(pm.connect(agent).resolveMarket(99, true)).to.be.revertedWith(
        "PredictionMarket: no such market"
      );
    });

    it("reverts when already resolved", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await pm.connect(agent).resolveMarket(0, true);
      await expect(pm.connect(agent).resolveMarket(0, false)).to.be.revertedWith(
        "PredictionMarket: already resolved"
      );
    });

    it("sets state and emits", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(agent).resolveMarket(0, true))
        .to.emit(pm, "MarketResolved")
        .withArgs(0n, true);
      const m = await pm.getMarket(0);
      expect(m.resolved).to.equal(true);
      expect(m.outcome).to.equal(true);
    });
  });

  describe("claimWinnings", function () {
    it("reverts on non-existent market", async function () {
      const { pm, alice } = await loadFixture(deployFixture);
      await expect(pm.connect(alice).claimWinnings(0)).to.be.revertedWith(
        "PredictionMarket: no such market"
      );
    });

    it("reverts when market not resolved", async function () {
      const { pm, agent, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await expect(pm.connect(alice).claimWinnings(0)).to.be.revertedWith(
        "PredictionMarket: not resolved"
      );
    });

    it("reverts when user has nothing on the winning side", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await makeMarket(pm, agent);
      await token.connect(alice).approve(pm.target, usdc(10));
      await pm.connect(alice).placeBet(0, false, usdc(10)); // bets NO
      await pm.connect(agent).resolveMarket(0, true);        // YES wins
      await expect(pm.connect(alice).claimWinnings(0)).to.be.revertedWith(
        "PredictionMarket: nothing to claim"
      );
    });

    it("pays YES winners stake * yesOdds / 1000 and emits", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      // pre-fund the contract so it can pay 1.5x
      await token.mint(pm.target, usdc(100));
      await makeMarket(pm, agent);
      const stake = usdc(10);
      await token.connect(alice).approve(pm.target, stake);
      await pm.connect(alice).placeBet(0, true, stake);
      await pm.connect(agent).resolveMarket(0, true);

      const before = await token.balanceOf(alice.address);
      const expectedPayout = (stake * 1500n) / 1000n; // 15 USDC
      await expect(pm.connect(alice).claimWinnings(0))
        .to.emit(pm, "WinningsClaimed")
        .withArgs(0n, alice.address, expectedPayout);
      const after = await token.balanceOf(alice.address);
      expect(after - before).to.equal(expectedPayout);
      expect(await pm.yesBets(0, alice.address)).to.equal(0n);
    });

    it("pays NO winners stake * noOdds / 1000", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await token.mint(pm.target, usdc(100));
      await makeMarket(pm, agent);
      const stake = usdc(10);
      await token.connect(alice).approve(pm.target, stake);
      await pm.connect(alice).placeBet(0, false, stake);
      await pm.connect(agent).resolveMarket(0, false);

      const before = await token.balanceOf(alice.address);
      const expectedPayout = (stake * 2500n) / 1000n; // 25 USDC
      await pm.connect(alice).claimWinnings(0);
      expect((await token.balanceOf(alice.address)) - before).to.equal(expectedPayout);
      expect(await pm.noBets(0, alice.address)).to.equal(0n);
    });

    it("prevents double-claim", async function () {
      const { pm, agent, token, alice } = await loadFixture(deployFixture);
      await token.mint(pm.target, usdc(100));
      await makeMarket(pm, agent);
      const stake = usdc(10);
      await token.connect(alice).approve(pm.target, stake);
      await pm.connect(alice).placeBet(0, true, stake);
      await pm.connect(agent).resolveMarket(0, true);
      await pm.connect(alice).claimWinnings(0);
      await expect(pm.connect(alice).claimWinnings(0)).to.be.revertedWith(
        "PredictionMarket: nothing to claim"
      );
    });
  });

  describe("getMarket", function () {
    it("returns the Market struct fields", async function () {
      const { pm, agent } = await loadFixture(deployFixture);
      const { deadline } = await makeMarket(pm, agent);
      const m = await pm.getMarket(0);
      expect(m.question).to.equal("Will BTC > $100k by 2026?");
      expect(m.deadline).to.equal(BigInt(deadline));
      expect(m.yesOdds).to.equal(1500n);
      expect(m.exists).to.equal(true);
    });

    it("returns zeroed (exists=false) for unknown marketId", async function () {
      const { pm } = await loadFixture(deployFixture);
      const m = await pm.getMarket(99);
      expect(m.exists).to.equal(false);
      expect(m.question).to.equal("");
      expect(m.deadline).to.equal(0n);
    });
  });
});
