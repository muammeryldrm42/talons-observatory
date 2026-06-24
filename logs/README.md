# Verifiable usage records

This folder holds the agent decision ledgers the Observatory produces. Each
ledger is a time stamped trail of what the agent observed, how it scored it, and
what it executed. Two ways to populate it:

## 1. Capture from the live market (recommended for submission)

```bash
node scripts/capture-logs.mjs
```

This calls the live Bitget public v2 market API, runs the scoring engine, and
writes a `capture-<timestamp>.json` file here. The numbers are real and reflect
the market at the moment you run it. Run it a few times across the day to build
a record, then commit the files.

## 2. Export from the running app

Click **Export JSON** in the Decision ledger panel. The browser downloads the
same ledger shape, including any simulated executions you triggered.

## Schema

See `SCHEMA.example.json` for the field by field structure. That file is a
structure reference with placeholder numbers, clearly marked, so do not treat it
as a captured record. Real captures carry a `note` field stating they came from
the live API.
