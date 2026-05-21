// Minimal ABIs + addresses for the live Arc Testnet deployment.
// Override via VITE_*_ADDRESS env vars if you re-deploy.

export const ADDRESSES = {
  factory: (import.meta.env.VITE_FACTORY_ADDRESS ||
    "0x510D2aa93030Fb6C31F530d4Db36f12293f05686") as `0x${string}`,
  pm: (import.meta.env.VITE_PM_ADDRESS ||
    "0xf6E733FE9Eb4D0662348eadf6bCf42FcA42fE258") as `0x${string}`,
  treasury: (import.meta.env.VITE_TREASURY_ADDRESS ||
    "0xf42d7680666D9295f345f9082879C2C2DB82e308") as `0x${string}`,
  usdc: (import.meta.env.VITE_USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000") as `0x${string}`,
};

export const EXPLORER = "https://testnet.arcscan.app";

const MARKET_STRUCT = {
  type: "tuple",
  name: "market",
  components: [
    { type: "string", name: "question" },
    { type: "uint256", name: "deadline" },
    { type: "uint256", name: "yesOdds" },
    { type: "uint256", name: "noOdds" },
    { type: "uint256", name: "totalYesBets" },
    { type: "uint256", name: "totalNoBets" },
    { type: "bool", name: "resolved" },
    { type: "bool", name: "outcome" },
    { type: "bool", name: "exists" },
  ],
} as const;

export const factoryAbi = [
  {
    type: "function",
    name: "agent",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "predictionMarket",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getAllMarkets",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { type: "uint256", name: "marketId" },
          MARKET_STRUCT,
        ],
      },
    ],
  },
] as const;

export const pmAbi = [
  {
    type: "function",
    name: "placeBet",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "bool", name: "isYes" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [MARKET_STRUCT],
  },
  {
    type: "function",
    name: "yesBets",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "address", name: "user" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "noBets",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "address", name: "user" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimWinnings",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [],
  },
] as const;

export const treasuryAbi = [
  {
    type: "function",
    name: "totalSpreadEarned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAllocatedToUSYC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "simulatedYieldEarned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usdcBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "SIMULATED_USYC_APY_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ─── Shape types ──────────────────────────────────────────────────────────
export type Market = {
  question: string;
  deadline: bigint;
  yesOdds: bigint;
  noOdds: bigint;
  totalYesBets: bigint;
  totalNoBets: bigint;
  resolved: boolean;
  outcome: boolean;
  exists: boolean;
};

export type MarketInfo = {
  marketId: bigint;
  market: Market;
};
