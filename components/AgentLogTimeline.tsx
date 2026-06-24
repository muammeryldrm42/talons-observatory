"use client";

import { useState } from "react";
import type { AgentLogEntry } from "@/lib/types";

const phaseMeta: Record<
  string,
  { label: string; dot: string; tint: string }
> = {
  observe: { label: "OBSERVE", dot: "#5B7FB0", tint: "text-haze" },
  evaluate: { label: "EVALUATE", dot: "#E8B931", tint: "text-signal" },
  execute: { label: "EXECUTE", dot: "#2DD4A7", tint: "text-long" },
};

function timeOf(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function Row({ entry }: { entry: AgentLogEntry }) {
  const [open, setOpen] = useState(false);
  const meta = phaseMeta[entry.phase];
  return (
    <div className="relative pl-6">
      {/* spine node */}
      <span
        className="absolute left-[5px] top-2 h-2 w-2 rounded-full ring-2 ring-ink"
        style={{ background: meta.dot }}
      />
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full py-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className={`text-[10px] font-600 tracking-widest ${meta.tint}`}>
              {meta.label}
            </span>
            <span className="font-display text-sm text-text">{entry.symbol}</span>
            <span className="truncate text-[11px] text-dim">{entry.actor}</span>
          </div>
          <span className="shrink-0 text-[10px] tnum text-faint">{timeOf(entry.ts)}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-faint">
          via {entry.source}
        </div>
      </button>
      {open && (
        <pre className="mb-2 overflow-x-auto border border-grid bg-panel2 p-3 text-[11px] leading-relaxed text-dim">
{JSON.stringify({ input: entry.input, output: entry.output }, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AgentLogTimeline({
  entries,
  onExport,
}: {
  entries: AgentLogEntry[];
  onExport: () => void;
}) {
  return (
    <section className="border border-edge bg-panel">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-600 tracking-wide text-text">
            Decision ledger
          </h2>
          <p className="text-[11px] text-faint">
            every observe, evaluate and execute, time stamped and exportable
          </p>
        </div>
        <button
          onClick={onExport}
          disabled={entries.length === 0}
          className="border border-edge px-3 py-1.5 text-[11px] uppercase tracking-wider text-signal transition-colors hover:bg-signal/10 disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
        >
          Export JSON
        </button>
      </header>

      <div className="max-h-[460px] overflow-y-auto px-4 py-2">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-faint">
            No entries yet. Run a scan to start the audit trail.
          </p>
        ) : (
          <div className="relative">
            {/* the spine */}
            <span className="absolute bottom-2 left-[5px] top-2 w-px bg-grid" />
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <Row key={e.id} entry={e} />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
