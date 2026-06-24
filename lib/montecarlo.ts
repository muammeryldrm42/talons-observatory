// Monte Carlo projection. Bootstraps from the asset's own realized hourly
// returns and resamples them to build a distribution of outcomes over a
// horizon. The randomness is in the resampling order only, the return pool is
// the asset's real history, so the distribution reflects observed behavior.

import type { Candle, MonteCarloResult } from "@/lib/types";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monteCarlo(
  candles: Candle[],
  runs = 2000,
  horizonBars = 168, // one week of hourly bars
  seed = 1337
): MonteCarloResult {
  const pool: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    pool.push((candles[i].c - candles[i - 1].c) / candles[i - 1].c);
  }
  const rand = mulberry32(seed);
  const endings: number[] = [];

  if (pool.length === 0) {
    return {
      runs: 0,
      horizonBars,
      median: 0,
      p05: 0,
      p95: 0,
      probProfit: 0,
      worst: 0,
      best: 0,
      distribution: [],
    };
  }

  for (let r = 0; r < runs; r++) {
    let equity = 1;
    for (let b = 0; b < horizonBars; b++) {
      const idx = Math.floor(rand() * pool.length);
      equity *= 1 + pool[idx];
    }
    endings.push((equity - 1) * 100);
  }
  endings.sort((a, b) => a - b);

  const q = (p: number) => endings[Math.min(endings.length - 1, Math.floor(p * endings.length))];
  const profit = endings.filter((e) => e > 0).length / endings.length;

  return {
    runs,
    horizonBars,
    median: Number(q(0.5).toFixed(2)),
    p05: Number(q(0.05).toFixed(2)),
    p95: Number(q(0.95).toFixed(2)),
    probProfit: Number(profit.toFixed(3)),
    worst: Number(endings[0].toFixed(2)),
    best: Number(endings[endings.length - 1].toFixed(2)),
    distribution: endings,
  };
}
