const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const usdc = (n) => ethers.parseUnits(String(n), 6);
const YEAR = 365 * 24 * 60 * 60;

describe("Treasury", function () {
  async function deployFixture() {
    const [deployer, agent, alice] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(token.target, agent.address);
    await treasury.waitForDeployment();

    await token.mint(agent.address, usdc(10_000));
    await token.mint(alice.address, usdc(1_000));

    return { treasury, token, deployer, agent, alice };
  }

  describe("constructor", function () {
    it("reverts on zero usdc", async function () {
      const { agent } = await loadFixture(deployFixture);
      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(Treasury.deploy(ethers.ZeroAddress, agent.address)).to.be.revertedWith(
        "Treasury: zero usdc"
      );
    });

    it("reverts on zero agent", async function () {
      const { token } = await loadFixture(deployFixture);
      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(Treasury.deploy(token.target, ethers.ZeroAddress)).to.be.revertedWith(
        "Treasury: zero agent"
      );
    });

    it("stores constructor args and constants", async function () {
      const { treasury, token, agent } = await loadFixture(deployFixture);
      expect(await treasury.agent()).to.equal(agent.address);
      expect(await treasury.usdcToken()).to.equal(token.target);
      expect(await treasury.SIMULATED_USYC_APY_BPS()).to.equal(450n);
      expect(await treasury.totalSpreadEarned()).to.equal(0n);
      expect(await treasury.totalAllocatedToUSYC()).to.equal(0n);
    });
  });

  describe("deposit", function () {
    it("reverts on zero amount", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).deposit(0)).to.be.revertedWith(
        "Treasury: zero amount"
      );
    });

    it("transfers USDC in and emits Deposited", async function () {
      const { treasury, token, alice } = await loadFixture(deployFixture);
      const amount = usdc(100);
      await token.connect(alice).approve(treasury.target, amount);

      await expect(treasury.connect(alice).deposit(amount))
        .to.emit(treasury, "Deposited")
        .withArgs(alice.address, amount);
      expect(await treasury.usdcBalance()).to.equal(amount);
    });

    it("accumulates multiple deposits", async function () {
      const { treasury, token, alice } = await loadFixture(deployFixture);
      await token.connect(alice).approve(treasury.target, usdc(50));
      await treasury.connect(alice).deposit(usdc(20));
      await treasury.connect(alice).deposit(usdc(30));
      expect(await treasury.usdcBalance()).to.equal(usdc(50));
    });
  });

  describe("withdraw", function () {
    it("reverts when called by non-agent", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      await expect(treasury.connect(alice).withdraw(usdc(1))).to.be.revertedWith(
        "Treasury: not agent"
      );
    });

    it("reverts on zero amount", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).withdraw(0)).to.be.revertedWith(
        "Treasury: zero amount"
      );
    });

    it("transfers USDC to agent and emits Withdrawn", async function () {
      const { treasury, token, agent } = await loadFixture(deployFixture);
      const amount = usdc(100);
      await token.connect(agent).approve(treasury.target, amount);
      await treasury.connect(agent).deposit(amount);

      const before = await token.balanceOf(agent.address);
      await expect(treasury.connect(agent).withdraw(amount))
        .to.emit(treasury, "Withdrawn")
        .withArgs(agent.address, amount);
      const after = await token.balanceOf(agent.address);
      expect(after - before).to.equal(amount);
    });
  });

  describe("recordSpread", function () {
    it("reverts when called by non-agent", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      await expect(treasury.connect(alice).recordSpread(usdc(1))).to.be.revertedWith(
        "Treasury: not agent"
      );
    });

    it("reverts on zero amount", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).recordSpread(0)).to.be.revertedWith(
        "Treasury: zero amount"
      );
    });

    it("accumulates and emits SpreadRecorded", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).recordSpread(usdc(5)))
        .to.emit(treasury, "SpreadRecorded")
        .withArgs(usdc(5), usdc(5));
      await treasury.connect(agent).recordSpread(usdc(3));
      expect(await treasury.totalSpreadEarned()).to.equal(usdc(8));
    });
  });

  describe("allocateToUSYC / deallocateFromUSYC", function () {
    it("allocateToUSYC reverts when called by non-agent", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      await expect(treasury.connect(alice).allocateToUSYC(usdc(100))).to.be.revertedWith(
        "Treasury: not agent"
      );
    });

    it("allocateToUSYC reverts on zero amount", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).allocateToUSYC(0)).to.be.revertedWith(
        "Treasury: zero amount"
      );
    });

    it("allocateToUSYC tracks total and emits", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await expect(treasury.connect(agent).allocateToUSYC(usdc(500)))
        .to.emit(treasury, "AllocatedToUSYC")
        .withArgs(usdc(500), usdc(500));
      expect(await treasury.totalAllocatedToUSYC()).to.equal(usdc(500));
      expect(await treasury.lastAllocationAt()).to.be.greaterThan(0);
    });

    it("deallocateFromUSYC reverts on amount exceeding allocation", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(100));
      await expect(
        treasury.connect(agent).deallocateFromUSYC(usdc(200))
      ).to.be.revertedWith("Treasury: amount exceeds allocation");
    });

    it("deallocateFromUSYC decreases total and emits", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(500));
      await expect(treasury.connect(agent).deallocateFromUSYC(usdc(200)))
        .to.emit(treasury, "DeallocatedFromUSYC")
        .withArgs(usdc(200), usdc(300));
      expect(await treasury.totalAllocatedToUSYC()).to.equal(usdc(300));
    });
  });

  describe("simulatedYieldEarned", function () {
    it("returns 0 when nothing allocated", async function () {
      const { treasury } = await loadFixture(deployFixture);
      expect(await treasury.simulatedYieldEarned()).to.equal(0n);
    });

    it("yields ~4.50% APY over 1 year on a 1000 USDC allocation", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(1000));

      await time.increase(YEAR);
      // 1000 * 450 / 10_000 = 45 USDC
      const yieldEarned = await treasury.simulatedYieldEarned();
      const expected = (usdc(1000) * 450n) / 10_000n;
      expect(yieldEarned).to.equal(expected);
    });

    it("yields ~half-APY over half a year", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(1000));

      await time.increase(YEAR / 2);
      const yieldEarned = await treasury.simulatedYieldEarned();
      // ~22.5 USDC; allow tiny rounding (integer math)
      const expected = (usdc(1000) * 450n * BigInt(YEAR / 2)) / (10_000n * BigInt(YEAR));
      expect(yieldEarned).to.equal(expected);
    });

    it("crystallizes yield on re-allocation (new allocation does not erase old yield)", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(1000));

      await time.increase(YEAR);
      // ~45 USDC accrued. Crystallize on next allocate.
      await treasury.connect(agent).allocateToUSYC(usdc(500));
      // Allow small drift: every second of block-time jitter on a 1000-USDC, 4.5% APY
      // principal adds ~14 raw units, so a tolerance of 1000 (= 0.001 USDC) is safe.
      const accrued = await treasury.accruedSimulatedYield();
      const expected = (usdc(1000) * 450n) / 10_000n;
      expect(accrued).to.be.gte(expected);
      expect(accrued).to.be.lt(expected + 1000n);

      // Now wait another year on 1500 total
      await time.increase(YEAR);
      const yieldEarned = await treasury.simulatedYieldEarned();
      const expectedNew = expected + (usdc(1500) * 450n) / 10_000n;
      expect(yieldEarned).to.be.gte(expectedNew);
      expect(yieldEarned).to.be.lt(expectedNew + 1000n);
    });

    it("stops accruing after full deallocation", async function () {
      const { treasury, agent } = await loadFixture(deployFixture);
      await treasury.connect(agent).allocateToUSYC(usdc(1000));

      await time.increase(YEAR);
      await treasury.connect(agent).deallocateFromUSYC(usdc(1000));

      const yieldFrozen = await treasury.simulatedYieldEarned();
      // Wait more — yield should not increase
      await time.increase(YEAR);
      const yieldAfter = await treasury.simulatedYieldEarned();
      expect(yieldAfter).to.equal(yieldFrozen);
    });
  });

  describe("usdcBalance", function () {
    it("returns 0 for an empty treasury", async function () {
      const { treasury } = await loadFixture(deployFixture);
      expect(await treasury.usdcBalance()).to.equal(0n);
    });

    it("matches the underlying ERC-20 balance after a deposit", async function () {
      const { treasury, token, alice } = await loadFixture(deployFixture);
      await token.connect(alice).approve(treasury.target, usdc(77));
      await treasury.connect(alice).deposit(usdc(77));
      expect(await treasury.usdcBalance()).to.equal(usdc(77));
      expect(await token.balanceOf(treasury.target)).to.equal(usdc(77));
    });
  });
});
