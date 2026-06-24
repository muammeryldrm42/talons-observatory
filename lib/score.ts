// Verdict scoring engine. Deterministic and explainable. Every factor is
// derived from real snapshot data, never random. The same engine runs in the
// browser and in scripts/capture-logs.mjs so logged verdicts match the UI.

import type { Candle, MarketSnapshot, ScoreFactor, Verdict, Side } from "@/lib/types";

function sma(values: number[], period: number): number {
  if (values.length < period) return values.length ? avg(values) : 0;
  const slice = values.slice(values.length - period);
  return avg(slice);
}

function avg(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / (v.length || 1);
}

function stdev(v: number[]): number {
  if (v.length < 2) return 0;
  const m = avg(v);
  return Math.sqrt(avg(v.map((x) => (x - m) ** 2)));
}

function returns(candles: Candle[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    out.push((candles[i].c - candles[i - 1].c) / candles[i - 1].c);
  }
  return out;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// RSI over close prices.
function rsi(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const d = candles[i].c - candles[i - 1].c;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

// Lite verdict from ticker only data, no candles. Used for the universe list
// where fetching candles for every pair would be wasteful. Uses momentum and
// range position, the two factors available without history. The full
// scoreSnapshot runs on selection and replaces this.
export function scoreLite(snap: MarketSnapshot): Verdict {
  const factors: ScoreFactor[] = [];

  const momC = clamp(snap.change24h * 3.2, -55, 55);
  factors.push({
    key: "momentum",
    label: "Momentum (24h change)",
    raw: Number(snap.change24h.toFixed(2)),
    weight: 0.7,
    contribution: Number(momC.toFixed(1)),
    note: `${snap.change24h.toFixed(2)}% over 24h`,
  });

  const range = snap.high24h - snap.low24h;
  const pos = range > 0 ? (snap.price - snap.low24h) / range : 0.5;
  const posC = clamp((pos - 0.5) * 60, -30, 30);
  factors.push({
    key: "range",
    label: "24h range position",
    raw: Number((pos * 100).toFixed(1)),
    weight: 0.3,
    contribution: Number(posC.toFixed(1)),
    note: `${(pos * 100).toFixed(0)}% of 24h range`,
  });

  const score = clamp(momC + posC, -100, 100);
  const confidence = Math.round(clamp(Math.abs(score), 0, 100));
  let side: Side = "FLAT";
  if (score >= 15) side = "LONG";
  else if (score <= -15) side = "SHORT";

  return {
    symbol: snap.symbol,
    display: snap.display,
    assetClass: snap.assetClass,
    side,
    score: Number(score.toFixed(1)),
    confidence,
    factors,
    price: snap.price,
    change24h: snap.change24h,
    capturedAt: snap.capturedAt,
    lite: true,
  };
}

export function scoreSnapshot(snap: MarketSnapshot): Verdict {
  const closes = snap.candles.map((c) => c.c);
  const factors: ScoreFactor[] = [];

  // 1. Trend: price vs SMA20 vs SMA50.
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const trendRaw = sma50 ? ((sma20 - sma50) / sma50) * 100 : 0;
  const trendC = clamp(trendRaw * 6, -28, 28);
  factors.push({
    key: "trend",
    label: "Trend (SMA20 vs SMA50)",
    raw: Number(trendRaw.toFixed(3)),
    weight: 0.28,
    contribution: Number(trendC.toFixed(1)),
    note: trendC >= 0 ? "fast MA above slow MA" : "fast MA below slow MA",
  });

  // 2. Momentum: 24h change.
  const momC = clamp(snap.change24h * 2.2, -22, 22);
  factors.push({
    key: "momentum",
    label: "Momentum (24h change)",
    raw: Number(snap.change24h.toFixed(2)),
    weight: 0.22,
    contribution: Number(momC.toFixed(1)),
    note: `${snap.change24h.toFixed(2)}% over 24h`,
  });

  // 3. RSI: distance from neutral 50, capped so extremes mean reversion damps.
  const r = rsi(snap.candles, 14);
  let rsiC = ((r - 50) / 50) * 18;
  if (r > 72) rsiC -= (r - 72) * 0.8; // overbought drag
  if (r < 28) rsiC += (28 - r) * 0.8; // oversold lift
  rsiC = clamp(rsiC, -20, 20);
  factors.push({
    key: "rsi",
    label: "RSI(14)",
    raw: Number(r.toFixed(1)),
    weight: 0.2,
    contribution: Number(rsiC.toFixed(1)),
    note: r > 72 ? "overbought" : r < 28 ? "oversold" : "neutral band",
  });

  // 4. Volatility regime: lower vol gives signals more weight.
  const rets = returns(snap.candles);
  const vol = stdev(rets) * 100;
  const volC = clamp((1.2 - vol) * 8, -16, 16);
  factors.push({
    key: "volatility",
    label: "Volatility regime",
    raw: Number(vol.toFixed(3)),
    weight: 0.16,
    contribution: Number(volC.toFixed(1)),
    note: vol > 1.2 ? "elevated, signal damped" : "contained",
  });

  // 5. Range position: where price sits in the 24h range.
  const range = snap.high24h - snap.low24h;
  const pos = range > 0 ? (snap.price - snap.low24h) / range : 0.5;
  const posC = clamp((pos - 0.5) * 28, -14, 14);
  factors.push({
    key: "range",
    label: "24h range position",
    raw: Number((pos * 100).toFixed(1)),
    weight: 0.14,
    contribution: Number(posC.toFixed(1)),
    note: `${(pos * 100).toFixed(0)}% of 24h range`,
  });

  const score = clamp(
    factors.reduce((a, f) => a + f.contribution, 0),
    -100,
    100
  );
  const confidence = Math.round(clamp(Math.abs(score), 0, 100));
  let side: Side = "FLAT";
  if (score >= 15) side = "LONG";
  else if (score <= -15) side = "SHORT";

  return {
    symbol: snap.symbol,
    display: snap.display,
    assetClass: snap.assetClass,
    side,
    score: Number(score.toFixed(1)),
    confidence,
    factors,
    price: snap.price,
    change24h: snap.change24h,
    capturedAt: snap.capturedAt,
  };
}
