// SPDX-License-Identifier: MIT
// MarketFactory.sol — thin registry on top of PredictionMarket.
// Deploys PredictionMarket in its constructor, making the factory the sole
// `agent` known by PM. The EOA agent talks only to the factory.
// Provides getAllMarkets() so the frontend can list markets in a single call
// instead of looping marketCount + getMarket on the PM directly.
pragma solidity 0.8.24;

import {PredictionMarket} from "./PredictionMarket.sol";

contract MarketFactory {
    struct MarketInfo {
        uint256 marketId;
        PredictionMarket.Market market;
    }

    address public immutable agent;
    PredictionMarket public immutable predictionMarket;

    modifier onlyAgent() {
        require(msg.sender == agent, "MarketFactory: not agent");
        _;
    }

    constructor(address _usdcToken, address _agent) {
        require(_usdcToken != address(0), "MarketFactory: zero usdc");
        require(_agent != address(0), "MarketFactory: zero agent");
        agent = _agent;
        predictionMarket = new PredictionMarket(_usdcToken, address(this));
    }

    function createMarket(
        string memory question,
        uint256 deadline,
        uint256 yesOdds,
        uint256 noOdds
    ) external onlyAgent returns (uint256) {
        return predictionMarket.createMarket(question, deadline, yesOdds, noOdds);
    }

    function updateOdds(uint256 marketId, uint256 yesOdds, uint256 noOdds)
        external
        onlyAgent
    {
        predictionMarket.updateOdds(marketId, yesOdds, noOdds);
    }

    function resolveMarket(uint256 marketId, bool outcome) external onlyAgent {
        predictionMarket.resolveMarket(marketId, outcome);
    }

    function marketCount() external view returns (uint256) {
        return predictionMarket.marketCount();
    }

    function getAllMarkets() external view returns (MarketInfo[] memory) {
        uint256 n = predictionMarket.marketCount();
        MarketInfo[] memory out = new MarketInfo[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = MarketInfo({marketId: i, market: predictionMarket.getMarket(i)});
        }
        return out;
    }
}
