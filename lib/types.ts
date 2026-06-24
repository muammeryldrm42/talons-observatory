// Unified data model. Every Bitget source (v2 REST today, MCP next) is
// normalized into MarketSnapshot so the rest of the app never cares where a
// number came from. This adapter boundary keeps the engine source agnostic.

export type AssetClass = "crypto";

export type Candle = {
  t: number; // ms epoch, candle open time
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // base volume
};

export type MarketSnapshot = {
  symbol: string; // canonical, e.g. BTCUSDT or AAPL
  display: string; // human label, e.g. BTC or AAPL
  assetClass: AssetClass;
  source: string; // which adapter produced this, e.g. "bitget-spot-v2"
  interval: "1h" | "1d"; // candle interval
  barsPerYear: number; // used to annualize Sharpe, 8760 hourly, 252 daily
  price: number;
  change24h: number; // percent, e.g. -2.31
  high24h: number;
  low24h: number;
  volume24h: number; // quote volume where available
  candles: Candle[]; // recent history, oldest first
  capturedAt: number; // ms epoch when this snapshot was taken
};

export type Side = "LONG" | "SHORT" | "FLAT";

export type ScoreFactor = {
  key: string;
  label: string;
  raw: number; // the underlying measured value
  weight: number; // contribution weight 0..1
  contribution: number; // signed points added to the score
  note: string;
};

export type Verdict = {
  symbol: string;
  display: string;
  assetClass: AssetClass;
  side: Side;
  score: number; // -100..100, signed conviction
  confidence: number; // 0..100, absolute strength
  factors: ScoreFactor[];
  price: number;
  change24h: number;
  capturedAt: number;
  lite?: boolean; // true if scored from ticker only, no candle factors yet
};

export type BacktestResult = {
  strategy: string;
  symbol: string;
  bars: number;
  trades: number;
  winRate: number; // 0..1
  totalReturn: number; // percent on equity
  maxDrawdown: number; // percent, negative
  sharpe: number;
  equityCurve: number[];
};

export type MonteCarloResult = {
  runs: number;
  horizonBars: number;
  median: number; // median ending return percent
  p05: number;
  p95: number;
  probProfit: number; // 0..1
  worst: number;
  best: number;
  distribution: number[]; // ending returns, sorted
};

// One row in the agent decision ledger. This is the verifiable usage record:
// what the agent saw, what it concluded, and what it executed, time stamped.
export type AgentLogEntry = {
  id: string;
  ts: number;
  actor: string; // e.g. "observatory.scan" or "bgc.order"
  symbol: string;
  assetClass: AssetClass;
  phase: "observe" | "evaluate" | "execute";
  input: Record<string, unknown>; // the snapshot or request the agent acted on
  output: Record<string, unknown>; // the verdict or execution result
  source: string; // tool that produced it: bitget-spot-v2, bgc-cli
};
