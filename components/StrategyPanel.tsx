"use client";

import type { BacktestResult, MonteCarloResult, Verdict } from "@/lib/types";

function Spark({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const w = 260;
  const h = 56;
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const span = max - min || 1;
  const pts = curve
    .map((v, i) => {
      const x = (i / (curve.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = curve[curve.length - 1] >= curve[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#2DD4A7" : "#FF5C6C"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-grid bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`mt-0.5 text-sm tnum ${tone || "text-text"}`}>{value}</div>
    </div>
  );
}

export default function StrategyPanel({
  verdict,
  backtest,
  mc,
  onExecute,
  busy,
}: {
  verdict: Verdict | null;
  backtest: BacktestResult | null;
  mc: MonteCarloResult | null;
  onExecute: () => void;
  busy: boolean;
}) {
  if (!verdict) {
    return (
      <section className="flex h-full min-h-[300px] items-center justify-center border border-edge bg-panel">
        <p className="max-w-[240px] text-center text-[12px] text-faint">
          Select an asset to evaluate. The panel runs a backtest and a Monte
          Carlo projection on its real history.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-edge bg-panel">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-base font-600 text-text">
            {verdict.display}
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-faint">
            strategy evaluation
          </span>
        </div>
        <span
          className={`font-display text-sm font-700 ${
            verdict.side === "LONG"
              ? "text-long"
              : verdict.side === "SHORT"
              ? "text-short"
              : "text-dim"
          }`}
        >
          {verdict.side} {verdict.score > 0 ? "+" : ""}
          {verdict.score}
        </span>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* factor breakdown */}
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">
            score factors
          </div>
          <div className="space-y-1.5">
            {verdict.factors.map((f) => {
              const pos = f.contribution >= 0;
              return (
                <div key={f.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-36 shrink-0 truncate text-dim">{f.label}</span>
                  <div className="relative h-1 flex-1 bg-grid">
                    <div
                      className="absolute top-0 h-full"
                      style={{
                        left: pos ? "50%" : `${50 - Math.abs(f.contribution) * 1.5}%`,
                        width: `${Math.abs(f.contribution) * 1.5}%`,
                        background: pos ? "#2DD4A7" : "#FF5C6C",
                      }}
                    />
                    <span className="absolute left-1/2 top-0 h-full w-px bg-edge" />
                  </div>
                  <span className="w-10 shrink-0 text-right tnum text-dim">
                    {pos ? "+" : ""}
                    {f.contribution}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* backtest */}
        {backtest && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-faint">
                backtest, {backtest.strategy}
              </span>
              <span className="text-[10px] tnum text-faint">{backtest.bars} bars</span>
            </div>
            <Spark curve={backtest.equityCurve} />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="return"
                value={`${backtest.totalReturn > 0 ? "+" : ""}${backtest.totalReturn}%`}
                tone={backtest.totalReturn >= 0 ? "text-long" : "text-short"}
              />
              <Stat label="trades" value={`${backtest.trades}`} />
              <Stat label="win rate" value={`${(backtest.winRate * 100).toFixed(0)}%`} />
              <Stat
                label="max dd"
                value={`${backtest.maxDrawdown}%`}
                tone="text-short"
              />
            </div>
          </div>
        )}

        {/* monte carlo */}
        {mc && mc.runs > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-faint">
                monte carlo, {mc.runs} runs over {mc.horizonBars}h
              </span>
              <span className="text-[10px] tnum text-faint">
                p(profit) {(mc.probProfit * 100).toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="p05" value={`${mc.p05}%`} tone="text-short" />
              <Stat
                label="median"
                value={`${mc.median > 0 ? "+" : ""}${mc.median}%`}
                tone={mc.median >= 0 ? "text-long" : "text-short"}
              />
              <Stat label="p95" value={`+${mc.p95}%`} tone="text-long" />
              <Stat label="worst / best" value={`${mc.worst} / ${mc.best}`} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-grid pt-3">
          <p className="max-w-[260px] text-[10px] leading-relaxed text-faint">
            Execute is a dry run. Wire it to bgc or Skill Hub to send a real
            order and log the acknowledgement.
          </p>
          <button
            onClick={onExecute}
            disabled={busy || verdict.side === "FLAT"}
            className="shrink-0 border border-signal px-4 py-2 text-[11px] uppercase tracking-wider text-signal transition-colors hover:bg-signal/10 disabled:cursor-not-allowed disabled:border-faint disabled:text-faint disabled:hover:bg-transparent"
          >
            Simulate {verdict.side}
          </button>
        </div>
      </div>
    </section>
  );
}
