# Talons Agent Observatory

An observation and audit console for AI trading agents, built on Bitget Agent Hub. It scans the full Bitget spot market, scores every pair, and records what an agent sees, why it concludes what it concludes, and what it runs, in one verifiable trail.

🔗 Live: TODO add your Vercel URL
💻 Code: TODO add your GitHub URL
🏷️ Track: Trading Infrastructure, Bitget AI Hackathon S1

## What it does

Most AI trading agents are a black box. When an agent acts you cannot see which data it observed, why it decided, or what it executed. The Observatory wraps Bitget Agent Hub and turns every agent action into a readable, exportable record, then lets you evaluate the strategy behind it before any capital moves.

📡 **Full market scan:** one Bitget call pulls every USDT spot pair at once. Each one gets a lite verdict and the list is searchable and sorted by 24h volume.

🧮 **Explainable scoring:** select any pair and a deterministic engine scores it from five factors (trend, momentum, RSI, volatility regime, range position). Each verdict shows its full factor breakdown, not just a number.

🧾 **Decision ledger:** every scan, observe, evaluate and execute step is logged with its input and output, time stamped, and exportable as JSON. The verifiable usage record the hackathon asks for is the core feature, not an afterthought.

🔬 **Strategy evaluation:** a backtest (SMA crossover with return, win rate, max drawdown, Sharpe) and a Monte Carlo projection bootstrapped from the pair's real candle history, before you execute.

⚡ **Execution hook:** a dry run by default. Wire it to bgc or Skill Hub and the ledger starts recording real order acknowledgements.

## Architecture

```
 Bitget spot v2 (REST / MCP)
        │
        ├─ getAllTickers ─► lite verdict ─► universe list (every USDT pair)
        │
        └─ on select ─► candles ─► MarketSnapshot ─► score engine ─► Verdict
                                          │                              │
                                          ▼                              ▼
                                 backtest + Monte Carlo        decision ledger (JSON export)
```

```
app/
├── page.tsx              # the observatory console
└── layout.tsx
components/
├── MarketRow.tsx         # compact universe row with lite verdict
├── StrategyPanel.tsx     # factor breakdown, backtest, Monte Carlo
└── AgentLogTimeline.tsx  # the decision ledger, the signature element
lib/
├── types.ts              # the one normalized data model
├── adapters/
│   └── bitgetCrypto.ts   # Bitget public v2 market data, swappable to MCP
├── score.ts              # lite and full deterministic scoring engines
├── backtest.ts           # SMA crossover backtest
├── montecarlo.ts         # bootstrap Monte Carlo
└── logStore.ts           # ledger entries and JSON export
scripts/
└── capture-logs.mjs      # writes real ledgers from the live API
logs/                     # verifiable usage records land here
```

The adapter boundary is the whole idea. The crypto adapter is the only file that talks to the network. Everything else, the scoring engine, backtest, Monte Carlo and ledger, runs on the normalized `MarketSnapshot`, so moving onto the Bitget MCP Server is a drop in. See BITGET_INTEGRATION.md.

## How it uses Bitget Agent Hub

- **MCP Server:** live market data and verdicts. The crypto adapter is written so its REST calls swap one for one to MCP tool calls.
- **CLI / bgc:** the data pipeline and the execute step. The capture script mirrors the bgc style of shell driven JSON output.
- **Skill Hub:** the execute action is the hook for an automatic trade intent skill that confirms and places the order.
- **REST and WebSocket API:** Bitget public v2 spot market endpoints. The full universe in one call, candle history on demand.

Full detail, including the exact endpoints and the swap path for each primitive, is in **BITGET_INTEGRATION.md**.

## Scoring engine

Lite verdict, ticker only, for the universe list:
- Momentum from 24h change
- 24h range position

Full verdict, candle based, on selection:
1. Trend, SMA20 against SMA50
2. Momentum, 24h change
3. RSI(14) with overbought and oversold damping
4. Volatility regime, signals damped in high volatility
5. 24h range position

The engine is deterministic. The same logic runs in the browser and in the capture script, so logged verdicts match what you see on screen.

## Progress

**Completed**
- Full Bitget spot universe in one call, searchable and volume sorted
- Lite verdict per pair, full five factor verdict on selection
- Deterministic scoring shared between the app and the capture script
- Decision ledger with scan, observe, evaluate and execute phases, JSON export
- Backtest with return, win rate, max drawdown and Sharpe
- Monte Carlo bootstrapped from real candle history
- Real log capture script over the live universe
- Bitget Agent Hub integration documented end to end

**Not yet done**
- Live bgc execution instead of dry run
- MCP Server wired in place of REST
- Per user persistent ledger history

**Next steps**
- Replace the REST calls in the crypto adapter with Bitget MCP tool calls
- Wire bgc for real order submission and acknowledgement logging
- Persist ledgers and add a session timeline view

## Tech stack

Next.js 14, TypeScript, Tailwind CSS, deployed on Vercel. Custom TypeScript scoring, backtest and Monte Carlo engines, no external model dependency.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The full market streams immediately, no keys required.

## Verifiable usage records

```bash
node scripts/capture-logs.mjs
```

Pulls the full Bitget spot market, deep scores the most liquid pairs, and writes a real, time stamped ledger to `logs/`. Run it across the day to build a record, then commit the files. You can also export the same ledger from the running app with the Export JSON button. See `logs/README.md`.

## Deploy

Push to GitHub and import the repo in Vercel. No build configuration and no environment variables needed. Market data is public.

## License

MIT
