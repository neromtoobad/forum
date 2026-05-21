// SPDX-License-Identifier: MIT
// PredictionMarket.sol — core binary market on Arc.
// Markets are created by the AI agent, accept USDC bets at agent-set fixed odds,
// and pay out winners on resolution. ODDS_PRECISION=1000 scales decimal odds to uint
// (e.g. 1500 = 1.50x). Payout = stake * winningOdds / ODDS_PRECISION.
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PredictionMarket {
    using SafeERC20 for IERC20;

    struct Market {
        string question;
        uint256 deadline;
        uint256 yesOdds;
        uint256 noOdds;
        uint256 totalYesBets;
        uint256 totalNoBets;
        bool resolved;
        bool outcome;
        bool exists;
    }

    uint256 public constant ODDS_PRECISION = 1000;

    address public immutable agent;
    address public immutable usdcToken;

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 deadline,
        uint256 yesOdds,
        uint256 noOdds
    );
    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        bool isYes,
        uint256 amount
    );
    event OddsUpdated(uint256 indexed marketId, uint256 yesOdds, uint256 noOdds);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    modifier onlyAgent() {
        require(msg.sender == agent, "PredictionMarket: not agent");
        _;
    }

    constructor(address _usdcToken, address _agent) {
        require(_usdcToken != address(0), "PredictionMarket: zero usdc");
        require(_agent != address(0), "PredictionMarket: zero agent");
        usdcToken = _usdcToken;
        agent = _agent;
    }

    function createMarket(
        string memory question,
        uint256 deadline,
        uint256 yesOdds,
        uint256 noOdds
    ) external onlyAgent returns (uint256 marketId) {
        require(deadline > block.timestamp, "PredictionMarket: deadline in past");
        require(yesOdds > 0 && noOdds > 0, "PredictionMarket: zero odds");

        marketId = marketCount++;
        markets[marketId] = Market({
            question: question,
            deadline: deadline,
            yesOdds: yesOdds,
            noOdds: noOdds,
            totalYesBets: 0,
            totalNoBets: 0,
            resolved: false,
            outcome: false,
            exists: true
        });

        emit MarketCreated(marketId, question, deadline, yesOdds, noOdds);
    }

    function placeBet(uint256 marketId, bool isYes, uint256 amount) external {
        Market storage m = markets[marketId];
        require(m.exists, "PredictionMarket: no such market");
        require(!m.resolved, "PredictionMarket: market resolved");
        require(block.timestamp < m.deadline, "PredictionMarket: past deadline");
        require(amount > 0, "PredictionMarket: zero amount");

        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);

        if (isYes) {
            yesBets[marketId][msg.sender] += amount;
            m.totalYesBets += amount;
        } else {
            noBets[marketId][msg.sender] += amount;
            m.totalNoBets += amount;
        }

        emit BetPlaced(marketId, msg.sender, isYes, amount);
    }

    function updateOdds(uint256 marketId, uint256 yesOdds, uint256 noOdds)
        external
        onlyAgent
    {
        Market storage m = markets[marketId];
        require(m.exists, "PredictionMarket: no such market");
        require(!m.resolved, "PredictionMarket: market resolved");
        require(yesOdds > 0 && noOdds > 0, "PredictionMarket: zero odds");

        m.yesOdds = yesOdds;
        m.noOdds = noOdds;

        emit OddsUpdated(marketId, yesOdds, noOdds);
    }

    function resolveMarket(uint256 marketId, bool outcome) external onlyAgent {
        Market storage m = markets[marketId];
        require(m.exists, "PredictionMarket: no such market");
        require(!m.resolved, "PredictionMarket: already resolved");

        m.resolved = true;
        m.outcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.exists, "PredictionMarket: no such market");
        require(m.resolved, "PredictionMarket: not resolved");

        uint256 stake;
        uint256 odds;
        if (m.outcome) {
            stake = yesBets[marketId][msg.sender];
            odds = m.yesOdds;
            yesBets[marketId][msg.sender] = 0;
        } else {
            stake = noBets[marketId][msg.sender];
            odds = m.noOdds;
            noBets[marketId][msg.sender] = 0;
        }
        require(stake > 0, "PredictionMarket: nothing to claim");

        uint256 payout = (stake * odds) / ODDS_PRECISION;
        IERC20(usdcToken).safeTransfer(msg.sender, payout);

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }
}
