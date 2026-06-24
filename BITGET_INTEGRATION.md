# Bitget Agent Hub integration

This document explains exactly how the Observatory uses Bitget, which endpoints
it calls today, and how to move each part onto the Agent Hub primitives (MCP
Server, CLI / bgc, Skill Hub).

## What runs today

All market data is real and comes from the Bitget public v2 spot market API. No
key is required for market data, so the calls run client side, which also avoids
server IP blocks.

| Purpose | Endpoint | Where |
| --- | --- | --- |
| Full market universe | `GET /api/v2/spot/market/tickers` | `lib/adapters/bitgetCrypto.ts` -> `getAllTickers()` |
| Candle history for one pair | `GET /api/v2/spot/market/candles?symbol=&granularity=1h&limit=200` | `lib/adapters/bitgetCrypto.ts` -> `fetchCandles()` |

One tickers call returns every USDT spot pair, which fills the universe list with
a lite verdict. Candles load only when a pair is selected, so the app scales to
the whole market without hundreds of requests.

## The adapter boundary

Every source is normalized into one `MarketSnapshot` type in `lib/types.ts`. The
scoring engine, backtest, Monte Carlo and decision ledger never touch the
network. This is what makes the swap to Agent Hub primitives a drop in.

## Moving onto the Agent Hub

### MCP Server

The crypto adapter is the only file that talks to the network. To drive the same
UI from an agent through MCP, replace the two fetch helpers with MCP tool calls
that return the same shapes:

```
getAllTickers()  ->  mcp.call("bitget.market.tickers", { quote: "USDT" })
fetchCandles()   ->  mcp.call("bitget.market.candles", { symbol, granularity, limit })
```

Map the tool result fields into `MarketSnapshot` and `Candle`. Nothing else in
the app changes. The verdicts, ledger and strategy panel keep working as is.

### CLI / bgc

`scripts/capture-logs.mjs` is written in the bgc spirit: a shell invocable script
that pulls Bitget data and emits JSON. It is the offline twin of the in app
scan. Use it in a cron or a CI step to build a continuous record of agent
decisions. To capture through bgc instead of raw REST, swap the `getJson` calls
for `bgc` shell invocations and parse their JSON output.

### Skill Hub

The execute action in `lib/logStore.ts` (`executeEntry`) is the integration
point for a trade intent skill. Today it logs a dry run. Wire it to a Skill Hub
skill that:

1. receives the verdict (symbol, side, score),
2. asks the user to confirm,
3. places the order through bgc or the Bitget trade API,
4. returns the order acknowledgement,

then log that acknowledgement as the execute entry instead of the dry run. The
ledger then records real executions with full provenance.

## Why this matters for an agent

The whole point is auditability. An agent that trades through Bitget Agent Hub
produces a stream of observe, evaluate and execute steps. The Observatory turns
that stream into a record a developer can read, replay and export. That is the
verifiable usage trail the Trading Infrastructure track asks for, and it is the
core feature rather than a logging afterthought.
