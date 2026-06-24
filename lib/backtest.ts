// Backtest engine. Runs an SMA crossover strategy over real candle history and
// reports trades, win rate, return, max drawdown and Sharpe. No fabricated
// fills: every trade is taken at the next candle close after a cross.

import type { BacktestResult, Candle } from "@/lib/types";

function sma(values: number[], end: number, period: number): number {
  if (end + 1 < period) return NaN;
  let s = 0;
  for (let i = end - period + 1; i <= end; i++) s += values[i];
  return s / period;
}

export function backtestSmaCross(
  candles: Candle[],
  symbol: string,
  fast = 12,
  slow = 26,
  barsPerYear = 24 * 365
): BacktestResult {
  const closes = candles.map((c) => c.c);
  let position = 0; // 0 flat, 1 long
  let entry = 0;
  let equity = 1;
  const equityCurve: number[] = [1];
  const tradeReturns: number[] = [];

  for (let i = slow; i < closes.length; i++) {
    const f = sma(closes, i, fast);
    const s = sma(closes, i, slow);
    const fPrev = sma(closes, i - 1, fast);
    const sPrev = sma(closes, i - 1, slow);
    if (isNaN(f) || isNaN(s) || isNaN(fPrev) || isNaN(sPrev)) continue;

    const crossUp = fPrev <= sPrev && f > s;
    const crossDown = fPrev >= sPrev && f < s;

    if (position === 0 && crossUp) {
      position = 1;
      entry = closes[i];
    } else if (position === 1 && crossDown) {
      const ret = (closes[i] - entry) / entry;
      tradeReturns.push(ret);
      equity *= 1 + ret;
      position = 0;
    }
    // mark to market for the curve
    const mark = position === 1 ? equity * (1 + (closes[i] - entry) / entry) : equity;
    equityCurve.push(mark);
  }
  // close any open position at the last close
  if (position === 1) {
    const ret = (closes[closes.length - 1] - entry) / entry;
    tradeReturns.push(ret);
    equity *= 1 + ret;
    equityCurve.push(equity);
  }

  const wins = tradeReturns.filter((r) => r > 0).length;
  const totalReturn = (equity - 1) * 100;

  // max drawdown on the equity curve
  let peak = equityCurve[0];
  let maxDd = 0;
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    const dd = (e - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }

  // Sharpe on per bar curve returns, annualized for hourly bars
  const curveRets: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    curveRets.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const mean = curveRets.reduce((a, b) => a + b, 0) / (curveRets.length || 1);
  const variance =
    curveRets.reduce((a, b) => a + (b - mean) ** 2, 0) / (curveRets.length || 1);
  const sd = Math.sqrt(variance);
  const sharpe = sd ? (mean / sd) * Math.sqrt(barsPerYear) : 0;

  return {
    strategy: `SMA cross ${fast}/${slow}`,
    symbol,
    bars: closes.length,
    trades: tradeReturns.length,
    winRate: tradeReturns.length ? wins / tradeReturns.length : 0,
    totalReturn: Number(totalReturn.toFixed(2)),
    maxDrawdown: Number((maxDd * 100).toFixed(2)),
    sharpe: Number(sharpe.toFixed(2)),
    equityCurve,
  };
}
