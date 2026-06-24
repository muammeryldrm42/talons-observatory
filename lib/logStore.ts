// Agent decision ledger. Collects observe / evaluate / execute entries and
// exports them as the verifiable usage record the project is built around.
// In the browser this lives in React state; scripts/capture-logs.mjs writes the
// same shape to disk for the repo.

import type { AgentLogEntry, MarketSnapshot, Verdict } from "@/lib/types";

let counter = 0;

function id(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

// One entry summarizing a full universe scan, so the ledger stays readable
// instead of logging every pair. Captures the count and the strongest leans.
export function universeScanEntry(verdicts: Verdict[]): AgentLogEntry {
  const ranked = verdicts.slice().sort((a, b) => b.score - a.score);
  const topLong = ranked.slice(0, 3).map((v) => `${v.display} ${v.score}`);
  const topShort = ranked
    .slice(-3)
    .reverse()
    .map((v) => `${v.display} ${v.score}`);
  return {
    id: id(),
    ts: Date.now(),
    actor: "observatory.scan",
    symbol: "UNIVERSE",
    assetClass: "crypto",
    phase: "observe",
    input: { request: "full market scan", quote: "USDT" },
    output: {
      pairs: verdicts.length,
      scoring: "lite, ticker only",
      topLong,
      topShort,
    },
    source: "bitget-spot-v2",
  };
}

export function observeEntry(snap: MarketSnapshot): AgentLogEntry {
  return {
    id: id(),
    ts: snap.capturedAt,
    actor: "observatory.scan",
    symbol: snap.symbol,
    assetClass: snap.assetClass,
    phase: "observe",
    input: { request: "market snapshot", symbol: snap.symbol },
    output: {
      price: snap.price,
      change24h: snap.change24h,
      high24h: snap.high24h,
      low24h: snap.low24h,
      volume24h: snap.volume24h,
      candles: snap.candles.length,
    },
    source: snap.source,
  };
}

export function evaluateEntry(verdict: Verdict): AgentLogEntry {
  return {
    id: id(),
    ts: verdict.capturedAt,
    actor: "observatory.score",
    symbol: verdict.symbol,
    assetClass: verdict.assetClass,
    phase: "evaluate",
    input: { price: verdict.price, change24h: verdict.change24h },
    output: {
      side: verdict.side,
      score: verdict.score,
      confidence: verdict.confidence,
      factors: verdict.factors.map((f) => ({
        key: f.key,
        contribution: f.contribution,
      })),
    },
    source: "observatory.score-engine",
  };
}

// Recorded when a user confirms a simulated execution. Wire this to bgc / Skill
// Hub to log the real order acknowledgement instead of the simulated one.
export function executeEntry(verdict: Verdict, simulated = true): AgentLogEntry {
  return {
    id: id(),
    ts: Date.now(),
    actor: "bgc.order",
    symbol: verdict.symbol,
    assetClass: verdict.assetClass,
    phase: "execute",
    input: {
      side: verdict.side,
      score: verdict.score,
      intent: `open ${verdict.side.toLowerCase()} on ${verdict.symbol}`,
    },
    output: {
      simulated,
      status: simulated ? "dry-run, no order sent" : "submitted",
      ref: id(),
    },
    source: simulated ? "observatory.dry-run" : "bgc-cli",
  };
}

export function exportLedger(entries: AgentLogEntry[]): string {
  return JSON.stringify(
    {
      schema: "talons-observatory.ledger.v1",
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    },
    null,
    2
  );
}
