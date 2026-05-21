// SPDX-License-Identifier: MIT
// Treasury.sol — agent USDC P&L and (stubbed) USYC allocation.
// Tracks: spread earned from markets, USDC deposits/withdrawals, and a
// SIMULATED USYC yield computed at a fixed APY against the allocated amount.
// USYC is NOT actually called — the real contract is institutional-only on
// testnet (allowlist + $100K min). This stub lets the AgentDashboard show a
// live "earning yield in USYC" number with a clear "planned mainnet feature"
// badge in the UI.
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury {
    using SafeERC20 for IERC20;

    uint256 public constant SIMULATED_USYC_APY_BPS = 450; // 4.50% APY
    uint256 private constant BPS = 10_000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    address public immutable agent;
    address public immutable usdcToken;

    uint256 public totalSpreadEarned;
    uint256 public totalAllocatedToUSYC;
    uint256 public lastAllocationAt;
    uint256 public accruedSimulatedYield;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event AllocatedToUSYC(uint256 amount, uint256 newTotal);
    event DeallocatedFromUSYC(uint256 amount, uint256 newTotal);
    event SpreadRecorded(uint256 amount, uint256 newTotal);

    modifier onlyAgent() {
        require(msg.sender == agent, "Treasury: not agent");
        _;
    }

    constructor(address _usdcToken, address _agent) {
        require(_usdcToken != address(0), "Treasury: zero usdc");
        require(_agent != address(0), "Treasury: zero agent");
        usdcToken = _usdcToken;
        agent = _agent;
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Treasury: zero amount");
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyAgent {
        require(amount > 0, "Treasury: zero amount");
        IERC20(usdcToken).safeTransfer(agent, amount);
        emit Withdrawn(agent, amount);
    }

    function recordSpread(uint256 amount) external onlyAgent {
        require(amount > 0, "Treasury: zero amount");
        totalSpreadEarned += amount;
        emit SpreadRecorded(amount, totalSpreadEarned);
    }

    function allocateToUSYC(uint256 amount) external onlyAgent {
        require(amount > 0, "Treasury: zero amount");
        _crystallizeYield();
        totalAllocatedToUSYC += amount;
        lastAllocationAt = block.timestamp;
        emit AllocatedToUSYC(amount, totalAllocatedToUSYC);
    }

    function deallocateFromUSYC(uint256 amount) external onlyAgent {
        require(amount > 0, "Treasury: zero amount");
        require(amount <= totalAllocatedToUSYC, "Treasury: amount exceeds allocation");
        _crystallizeYield();
        totalAllocatedToUSYC -= amount;
        lastAllocationAt = block.timestamp;
        emit DeallocatedFromUSYC(amount, totalAllocatedToUSYC);
    }

    function simulatedYieldEarned() public view returns (uint256) {
        return accruedSimulatedYield + _pendingYield();
    }

    function usdcBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
    }

    function _pendingYield() internal view returns (uint256) {
        if (totalAllocatedToUSYC == 0 || lastAllocationAt == 0) return 0;
        uint256 elapsed = block.timestamp - lastAllocationAt;
        return (totalAllocatedToUSYC * SIMULATED_USYC_APY_BPS * elapsed)
            / (BPS * SECONDS_PER_YEAR);
    }

    function _crystallizeYield() internal {
        uint256 pending = _pendingYield();
        if (pending > 0) {
            accruedSimulatedYield += pending;
        }
    }
}
