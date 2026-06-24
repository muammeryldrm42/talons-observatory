// Capture real verifiable usage records from the live Bitget public API.
//
//   node scripts/capture-logs.mjs
//
// It pulls the full Bitget spot market in one call, logs a universe scan
// summary, then takes the most liquid pairs, fetches candle history, runs the
// same scoring engine the app uses, and writes a timestamped ledger to logs/.
// Output is real and reflects the market at capture time. Nothing is mocked.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "logs");
const BASE = process.env.BITGET_CRYPTO_URL || "https://api.bitget.com";
const QUOTE = "USDT";
const TOP_N = Number(process.env.CAPTURE_TOP_N || 15); // pairs to deep score

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bitget ${res.status} ${url}`);
  const body = await res.json();
  if (body.code && body.code !== "00000") {
    throw new Error(`bitget code ${body.code}: ${body.msg}`);
  }
  return body.data;
}

async function getAllTickers() {
  const data = await getJson(`${BASE}/api/v2/spot/market/tickers`);
  return data
    .filter((t) => t.symbol.endsWith(QUOTE))
    .map((t) => ({
      symbol: t.symbol,
      display: t.symbol.slice(0, -QUOTE.length),
      price: Number(t.lastPr),
      change24h: Number(t.change24h) * 100,
      high24h: Number(t.high24h),
      low24h: Number(t.low24h),
      volume24h: Number(t.quoteVolume),
    }))
    .filter((s) => Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => b.volume24h - a.volume24h);
}

async function getCandles(symbol) {
  const data = await getJson(
    `${BASE}/api/v2/spot/market/candles?symbol=${symbol}&granularity=1h&limit=200`
  );
  return data
    .map((r) => ({
      t: Number(r[0]),
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c: Number(r[4]),
      v: Number(r[5]),
    }))
    .sort((a, b) => a.t - b.t);
}

// minimal mirror of lib/score.ts so logged verdicts match the UI
function sma(v, p) {
  if (v.length < p) return v.reduce((a, b) => a + b, 0) / (v.length || 1);
  const s = v.slice(v.length - p);
  return s.reduce((a, b) => a + b, 0) / s.length;
}
function rsi(c, p = 14) {
  if (c.length < p + 1) return 50;
  let g = 0,
    l = 0;
  for (let i = c.length - p; i < c.length; i++) {
    const d = c[i].c - c[i - 1].c;
    if (d >= 0) g += d;
    else l -= d;
  }
  if (l === 0) return 100;
  const rs = g / p / (l / p);
  return 100 - 100 / (1 + rs);
}
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
function score(snap) {
  const closes = snap.candles.map((c) => c.c);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const trend = clamp((sma50 ? ((sma20 - sma50) / sma50) * 100 : 0) * 6, -28, 28);
  const mom = clamp(snap.change24h * 2.2, -22, 22);
  const r = rsi(snap.candles, 14);
  let rsiC = ((r - 50) / 50) * 18;
  if (r > 72) rsiC -= (r - 72) * 0.8;
  if (r < 28) rsiC += (28 - r) * 0.8;
  rsiC = clamp(rsiC, -20, 20);
  const rets = [];
  for (let i = 1; i < closes.length; i++)
    rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const vol =
    Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length || 1)) * 100;
  const volC = clamp((1.2 - vol) * 8, -16, 16);
  const range = snap.high24h - snap.low24h;
  const pos = range > 0 ? (snap.price - snap.low24h) / range : 0.5;
  const posC = clamp((pos - 0.5) * 28, -14, 14);
  const total = clamp(trend + mom + rsiC + volC + posC, -100, 100);
  let side = "FLAT";
  if (total >= 15) side = "LONG";
  else if (total <= -15) side = "SHORT";
  return {
    side,
    score: Number(total.toFixed(1)),
    confidence: Math.round(Math.abs(total)),
    factors: {
      trend: Number(trend.toFixed(1)),
      mom: Number(mom.toFixed(1)),
      rsi: Number(rsiC.toFixed(1)),
      vol: Number(volC.toFixed(1)),
      range: Number(posC.toFixed(1)),
    },
    rsi: Number(r.toFixed(1)),
  };
}

let counter = 0;
const id = () => `${Date.now().toString(36)}-${(++counter).toString(36)}`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const entries = [];

  const all = await getAllTickers();
  console.log(`universe: ${all.length} ${QUOTE} pairs`);

  // universe scan summary
  entries.push({
    id: id(),
    ts: Date.now(),
    actor: "observatory.scan",
    symbol: "UNIVERSE",
    assetClass: "crypto",
    phase: "observe",
    input: { request: "full market scan", quote: QUOTE },
    output: {
      pairs: all.length,
      topByVolume: all.slice(0, 5).map((s) => s.symbol),
    },
    source: "bitget-spot-v2",
  });

  // deep score the most liquid pairs
  for (const base of all.slice(0, TOP_N)) {
    try {
      const candles = await getCandles(base.symbol);
      const snap = { ...base, candles };
      entries.push({
        id: id(),
        ts: Date.now(),
        actor: "observatory.scan",
        symbol: snap.symbol,
        assetClass: "crypto",
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
        source: "bitget-spot-v2",
      });
      const v = score(snap);
      entries.push({
        id: id(),
        ts: Date.now(),
        actor: "observatory.score",
        symbol: snap.symbol,
        assetClass: "crypto",
        phase: "evaluate",
        input: { price: snap.price, change24h: snap.change24h, rsi: v.rsi },
        output: { side: v.side, score: v.score, confidence: v.confidence, factors: v.factors },
        source: "observatory.score-engine",
      });
      console.log(
        `  ${snap.symbol.padEnd(12)} ${v.side.padEnd(5)} ${String(v.score).padStart(6)}  px ${snap.price}`
      );
    } catch (e) {
      console.error(`  failed ${base.symbol}:`, e.message);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const payload = {
    schema: "talons-observatory.ledger.v1",
    exportedAt: new Date().toISOString(),
    note: "Real capture from live Bitget public v2 market API. Values reflect actual market state at capture time.",
    count: entries.length,
    entries,
  };
  const file = join(OUT_DIR, `capture-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`\nwrote ${entries.length} entries to ${file}`);
}

main();
