"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllTickers,
  getCryptoSnapshot,
  QUOTE,
} from "@/lib/adapters/bitgetCrypto";
import { scoreLite, scoreSnapshot } from "@/lib/score";
import { backtestSmaCross } from "@/lib/backtest";
import { monteCarlo } from "@/lib/montecarlo";
import {
  observeEntry,
  evaluateEntry,
  executeEntry,
  universeScanEntry,
  exportLedger,
} from "@/lib/logStore";
import type {
  AgentLogEntry,
  BacktestResult,
  MarketSnapshot,
  MonteCarloResult,
  Verdict,
} from "@/lib/types";
import MarketRow from "@/components/MarketRow";
import AgentLogTimeline from "@/components/AgentLogTimeline";
import StrategyPanel from "@/components/StrategyPanel";

type SourceState = "idle" | "live" | "error";

export default function Page() {
  const [universe, setUniverse] = useState<MarketSnapshot[]>([]);
  const [ledger, setLedger] = useState<AgentLogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fullSnap, setFullSnap] = useState<MarketSnapshot | null>(null);
  const [fullVerdict, setFullVerdict] = useState<Verdict | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [cryptoState, setCryptoState] = useState<SourceState>("idle");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const liteVerdicts = useMemo<Verdict[]>(
    () => universe.map((s) => scoreLite(s)),
    [universe]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return liteVerdicts;
    return liteVerdicts.filter(
      (v) => v.display.includes(q) || v.symbol.includes(q)
    );
  }, [liteVerdicts, search]);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const all = await getAllTickers();
      setUniverse(all);
      setCryptoState("live");
      setLastScan(Date.now());
      const lite = all.map((s) => scoreLite(s));
      setLedger((prev) => [...prev, universeScanEntry(lite)]);
    } catch (e) {
      setCryptoState("error");
      // eslint-disable-next-line no-console
      console.error("universe scan failed", e);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    scan();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSymbol = useCallback(async (base: MarketSnapshot) => {
    setSelected(base.symbol);
    setLoadingDetail(true);
    setFullVerdict(null);
    setFullSnap(null);
    try {
      const snap = await getCryptoSnapshot(base);
      const verdict = scoreSnapshot(snap);
      setFullSnap(snap);
      setFullVerdict(verdict);
      setLedger((prev) => [
        ...prev,
        observeEntry(snap),
        evaluateEntry(verdict),
      ]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("detail load failed", base.symbol, e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const backtest: BacktestResult | null = useMemo(() => {
    if (!fullSnap) return null;
    return backtestSmaCross(fullSnap.candles, fullSnap.symbol, 12, 26, fullSnap.barsPerYear);
  }, [fullSnap]);

  const mc: MonteCarloResult | null = useMemo(() => {
    if (!fullSnap) return null;
    return monteCarlo(fullSnap.candles, 2000, 168);
  }, [fullSnap]);

  const onExecute = useCallback(() => {
    if (!fullVerdict) return;
    setLedger((prev) => [...prev, executeEntry(fullVerdict, true)]);
  }, [fullVerdict]);

  const onExport = useCallback(() => {
    const blob = new Blob([exportLedger(ledger)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talons-ledger-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ledger]);

  const longs = liteVerdicts.filter((v) => v.side === "LONG").length;
  const shorts = liteVerdicts.filter((v) => v.side === "SHORT").length;

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      {/* header */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-signal" />
            <span className="text-[11px] uppercase tracking-[0.25em] text-signal">
              Talons Protocol
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-700 leading-none text-text sm:text-3xl">
            Agent Observatory
          </h1>
          <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-dim">
            An observation and audit console for AI trading agents on Bitget
            Agent Hub. It scans the full Bitget spot market, scores every pair,
            and records what an agent sees, why it concludes, and what it runs,
            in one verifiable trail.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="font-display text-lg tnum text-text">
            {new Date(now).toLocaleTimeString("en-GB", {
              hour12: false,
              timeZone: "UTC",
            })}{" "}
            UTC
          </div>
          <button
            onClick={scan}
            disabled={scanning}
            className="border border-signal bg-signal/10 px-4 py-2 text-[12px] uppercase tracking-wider text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Run scan"}
          </button>
        </div>
      </header>

      {/* status bar */}
      <div className="mb-5 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
        <SourceTile
          label="Bitget spot v2"
          state={cryptoState}
          detail={`${universe.length} pairs`}
        />
        <div className="border border-edge bg-panel px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-faint">market lean</div>
          <div className="mt-0.5 text-sm tnum text-text">
            <span className="text-long">{longs}L</span>{" "}
            <span className="text-short">{shorts}S</span>
          </div>
        </div>
        <div className="border border-edge bg-panel px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-faint">ledger</div>
          <div className="mt-0.5 text-sm tnum text-text">{ledger.length} entries</div>
        </div>
        <div className="border border-edge bg-panel px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-faint">last scan</div>
          <div className="mt-0.5 text-sm tnum text-text">
            {lastScan ? new Date(lastScan).toLocaleTimeString("en-GB", { hour12: false }) : "--"}
          </div>
        </div>
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        {/* left: universe list */}
        <div className="border border-edge bg-panel">
          <div className="border-b border-edge px-3 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-600 tracking-wide text-text">
                Market universe
              </h2>
              <span className="text-[10px] tnum text-faint">
                {filtered.length}/{universe.length}
              </span>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${QUOTE} pairs, e.g. BTC`}
              className="mt-2 w-full border border-grid bg-panel2 px-3 py-2 text-xs text-text placeholder:text-faint focus:border-signal focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-faint">
              <span>sorted by 24h volume, lite scored</span>
              <span>L long · S short</span>
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {universe.length === 0 ? (
              <p className="px-3 py-10 text-center text-[12px] text-faint">
                {scanning
                  ? "Fetching the full Bitget spot market..."
                  : cryptoState === "error"
                  ? "Market source unavailable. Try Run scan again."
                  : "No data yet."}
              </p>
            ) : (
              filtered.map((v) => (
                <MarketRow
                  key={v.symbol}
                  verdict={v}
                  selected={selected === v.symbol}
                  onSelect={() => {
                    const base = universe.find((s) => s.symbol === v.symbol);
                    if (base) selectSymbol(base);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* right: strategy + ledger */}
        <div className="space-y-5">
          {loadingDetail && !fullVerdict ? (
            <section className="flex h-full min-h-[300px] items-center justify-center border border-edge bg-panel">
              <p className="text-[12px] text-dim">Loading candles and scoring...</p>
            </section>
          ) : (
            <StrategyPanel
              verdict={fullVerdict}
              backtest={backtest}
              mc={mc}
              onExecute={onExecute}
              busy={loadingDetail}
            />
          )}
          <AgentLogTimeline entries={ledger} onExport={onExport} />
        </div>
      </div>

      {/* Bitget Agent Hub strip */}
      <section className="mt-5 border border-edge bg-panel2 px-4 py-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-signal">
          Built on Bitget Agent Hub
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-[11px] text-dim sm:grid-cols-2 lg:grid-cols-4">
          <HubItem
            title="MCP Server"
            body="Live market data and verdicts. The crypto adapter is written so its REST calls swap one for one to MCP tool calls."
          />
          <HubItem
            title="CLI / bgc"
            body="The data pipeline and the execute step. The capture script mirrors the bgc style of shell driven JSON output."
          />
          <HubItem
            title="Skill Hub"
            body="The execute action is the hook for an automatic trade intent skill that confirms and places the order."
          />
          <HubItem
            title="REST + WebSocket"
            body="Bitget public v2 spot market endpoints. Full universe in one call, candle history on demand."
          />
        </div>
      </section>

      <footer className="mt-6 border-t border-edge pt-4 text-[11px] text-faint">
        Market data is live from the Bitget public v2 API and unmodified.
        Execution is a dry run until bgc is wired. See BITGET_INTEGRATION.md.
      </footer>
    </main>
  );
}

function SourceTile({
  label,
  state,
  detail,
}: {
  label: string;
  state: SourceState;
  detail: string;
}) {
  const map: Record<SourceState, { text: string; color: string }> = {
    idle: { text: "idle", color: "#7C8AA0" },
    live: { text: "live", color: "#2DD4A7" },
    error: { text: "error", color: "#FF5C6C" },
  };
  const s = map[state];
  return (
    <div className="border border-edge bg-panel px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-crypto" />
          <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
        </div>
        <span className="text-[10px] uppercase" style={{ color: s.color }}>
          {s.text}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-text">{detail}</div>
    </div>
  );
}

function HubItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l border-grid pl-3">
      <div className="font-display text-[12px] font-600 text-text">{title}</div>
      <p className="mt-0.5 leading-relaxed">{body}</p>
    </div>
  );
}
