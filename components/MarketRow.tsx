"use client";

import type { Verdict } from "@/lib/types";

const sideColor: Record<string, string> = {
  LONG: "text-long",
  SHORT: "text-short",
  FLAT: "text-dim",
};

export default function MarketRow({
  verdict,
  selected,
  onSelect,
}: {
  verdict: Verdict;
  selected: boolean;
  onSelect: () => void;
}) {
  const up = verdict.change24h >= 0;
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2 border-l-2 border-l-crypto border-b border-grid px-3 py-2 text-left transition-colors hover:bg-[#141b29] focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
        selected ? "bg-[#141b29] ring-1 ring-signal" : ""
      }`}
    >
      <span className="w-16 shrink-0 truncate font-display text-sm font-600 text-text">
        {verdict.display}
      </span>
      <span className="flex-1 truncate text-right text-xs tnum text-text">
        {verdict.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
      </span>
      <span
        className={`w-16 shrink-0 text-right text-xs tnum ${
          up ? "text-long" : "text-short"
        }`}
      >
        {up ? "+" : ""}
        {verdict.change24h.toFixed(2)}%
      </span>
      <span
        className={`w-12 shrink-0 text-right text-xs font-700 ${sideColor[verdict.side]}`}
      >
        {verdict.side === "FLAT" ? "·" : verdict.side === "LONG" ? "L" : "S"}
        <span className="ml-1 tnum text-[11px] font-400 text-dim">
          {verdict.score > 0 ? "+" : ""}
          {Math.round(verdict.score)}
        </span>
      </span>
    </button>
  );
}
