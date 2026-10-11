# TrueTrack

Verifiable track records for Hyperliquid traders. Paste a wallet, read the live account from Hyperliquid's public info API, and check the latest attestation stored in `TrackRecordRegistry` on HyperEVM (chain id 999).

## Layout

- `contracts/` — Foundry project. `TrackRecordRegistry` stores attester-signed snapshots.
- `scripts/attest.ts` — keeper. Snapshots watched wallets and calls `attest`.
- `web/` — Next.js 14 dashboard. The browser talks only to TrueTrack route handlers.

## Quick start

```bash
# Dashboard
cd web
npm install
npm run dev
```

Open http://localhost:3000. **Load demo data** walks the whole UI without a wallet. **Verify** loads a real Hyperliquid address through `/api/trader`.

```bash
# Contracts
cd contracts
forge install foundry-rs/forge-std   # skip if lib/forge-std is already present
forge build
forge test
```

## Environment

Copy `.env.example` to `.env` at the repo root. The web app reads that file on the server. Do not commit secrets.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Deployed `TrackRecordRegistry` |
| `HYPERLIQUID_RPC` | HyperEVM RPC, default `https://rpc.hyperliquid.xyz/evm` |
| `ATTESTER_PRIVATE_KEY` | Key authorized as an attester |
| `WATCHED_TRADERS` | Comma-separated wallets the keeper snapshots |

`ATTEST_INTERVAL_MINUTES` is optional and defaults to 15.

Until a registry address is set, live verify still shows Hyperliquid performance. The seal explains that the registry is unset.

## Deploy the registry

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$HYPERLIQUID_RPC" \
  --private-key "$ATTESTER_PRIVATE_KEY" \
  --broadcast
```

The deployer is the owner and the first attester. Put the logged address in `NEXT_PUBLIC_REGISTRY_ADDRESS`.

## Keeper

From the repo root, with `.env` filled in:

```bash
npm install
npm run attest:once    # one snapshot per watched trader
npm run attest         # then every 15 minutes
```

For each trader the keeper reads `clearinghouseState` (equity) and all-time `portfolio` PnL. It scales both to 1e8 and sends:

```text
dataHash = keccak256(utf8 `${checksumAddress}:${equity}:${pnl}:${unixSeconds}`)
```

Attestations are sent one at a time so nonces stay in order.

## What the dashboard computes

The route handler POSTs these bodies to `https://api.hyperliquid.xyz/info`:

- `{"type":"clearinghouseState","user":ADDR}`
- `{"type":"portfolio","user":ADDR}`
- `{"type":"userFills","user":ADDR}`

Normalized fields:

- **Equity, margin, withdrawable** from `marginSummary` and `withdrawable`.
- **Unrealized PnL** is the sum of open `position.unrealizedPnl`.
- **Volume** is portfolio `allTime.vlm`. If that is missing or zero, it falls back to the sum of fill price × size.
- **ROI** is the all-time PnL change since the first non-zero account value, divided by that account value.
- **Max drawdown** is the largest peak-to-trough drop in `accountValueHistory`, as a percent of the peak.
- **Trades** is the number of fills Hyperliquid returned (capped at 2,000 by the API).

The seal reads `getLatest` and `recordCount`. When the RPC allows it, the block number comes from the latest `Attested` log.
