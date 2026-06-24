// Bitget crypto adapter. The single data source for the Observatory.
//
// Two layers:
//   getAllTickers()  one public call returns every spot pair at once. Used to
//                    populate the full market universe with a lite verdict.
//   getCryptoSnapshot()  fetches candle history for one symbol on demand, for
//                        the full five factor score, backtest and Monte Carlo.
//
// Market data needs no API key, so this runs client side, which also dodges
// server IP blocks. To move onto the Bitget MCP Server, replace the fetch calls
// below with the matching MCP tool calls and keep the return shapes. See
// BITGET_INTEGRATION.md.

import type { Candle, MarketSnapshot } from "@/lib/types";

const BASE =
  process.env.NEXT_PUBLIC_BITGET_CRYPTO_URL || "https://api.bitget.com";

// quote asset shown by default. USDT covers the vast majority of liquid pairs.
export const QUOTE = "USDT";

type RawTicker = {
  symbol: string;
  lastPr: string;
  high24h: string;
  low24h: string;
  change24h: string; // fraction, e.g. -0.0231
  baseVolume: string;
  quoteVolume: string;
};

type RawCandle = [string, string, string, string, string, string, string];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`bitget ${res.status} ${url}`);
  const body = await res.json();
  if (body.code && body.code !== "00000") {
    throw new Error(`bitget code ${body.code}: ${body.msg}`);
  }
  return body.data as T;
}

// strip the quote suffix for a clean display label, e.g. BTCUSDT -> BTC
function labelFor(symbol: string): string {
  return symbol.endsWith(QUOTE) ? symbol.slice(0, -QUOTE.length) : symbol;
}

// One call, the whole market. Returns lite snapshots with no candles. These
// power the universe list and a lite verdict. Candles load on selection.
export async function getAllTickers(): Promise<MarketSnapshot[]> {
  const data = await getJson<RawTicker[]>(`${BASE}/api/v2/spot/market/tickers`);
  const now = Date.now();
  return data
    .filter((t) => t.symbol.endsWith(QUOTE))
    .map((t) => ({
      symbol: t.symbol,
      display: labelFor(t.symbol),
      assetClass: "crypto" as const,
      source: "bitget-spot-v2",
      interval: "1h" as const,
      barsPerYear: 24 * 365,
      price: Number(t.lastPr),
      change24h: Number(t.change24h) * 100,
      high24h: Number(t.high24h),
      low24h: Number(t.low24h),
      volume24h: Number(t.quoteVolume),
      candles: [],
      capturedAt: now,
    }))
    .filter((s) => Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => b.volume24h - a.volume24h);
}

export async function fetchCandles(
  symbol: string,
  granularity = "1h",
  limit = 200
): Promise<Candle[]> {
  const data = await getJson<RawCandle[]>(
    `${BASE}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`
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

// Full snapshot for one symbol, with candle history attached.
export async function getCryptoSnapshot(
  base: MarketSnapshot
): Promise<MarketSnapshot> {
  const candles = await fetchCandles(base.symbol, "1h", 200);
  return { ...base, candles, capturedAt: Date.now() };
}
