import { getAddress } from "viem";
import { computeMaxDrawdown, computeRoi } from "./normalize";
import { scale1e8, snapshotHash } from "./scale";
import type { HistoryPoint, SealModel, TraderSnapshot } from "./types";

export const DEMO_ADDRESS = getAddress("0x1111111111111111111111111111111111111111");

const DEMO_TIMESTAMP = Math.floor(Date.UTC(2026, 9, 11, 8, 0, 0) / 1000);

export function buildDemoSnapshot(): TraderSnapshot {
  const accountValueHistory = buildAccountCurve();
  const pnlHistory = accountValueHistory.map((point) => ({
    t: point.t,
    v: round2(point.v - 100_000),
  }));
  const equity = accountValueHistory[accountValueHistory.length - 1].v;
  const marginUsed = round2(equity * 0.27);
  const positions = [
    {
      coin: "BTC",
      side: "long" as const,
      size: 0.25,
      entryPx: 64120,
      liquidationPx: 58200,
      leverage: 5,
      unrealizedPnl: 1840.25,
    },
    {
      coin: "ETH",
      side: "short" as const,
      size: 8.4,
      entryPx: 2520.5,
      liquidationPx: 2890,
      leverage: 4,
      unrealizedPnl: 620.1,
    },
    {
      coin: "SOL",
      side: "long" as const,
      size: 420,
      entryPx: 148.2,
      liquidationPx: 121.4,
      leverage: 3,
      unrealizedPnl: -210.4,
    },
  ];

  return {
    address: DEMO_ADDRESS,
    equity,
    marginUsed,
    withdrawable: round2(equity - marginUsed),
    positions,
    unrealizedPnl: round2(positions.reduce((sum, position) => sum + position.unrealizedPnl, 0)),
    tradesCount: 186,
    fillsTruncated: false,
    volume: 18420550.4,
    volumeSource: "portfolio",
    pnlHistory,
    accountValueHistory,
    roi: computeRoi(pnlHistory, accountValueHistory),
    maxDrawdown: computeMaxDrawdown(accountValueHistory),
    asOf: DEMO_TIMESTAMP * 1000,
  };
}

export function buildDemoSeal(snapshot: TraderSnapshot): SealModel {
  const pnl = snapshot.pnlHistory[snapshot.pnlHistory.length - 1]?.v ?? 0;
  const equity = scale1e8(snapshot.equity.toFixed(8));
  const pnlScaled = scale1e8(pnl.toFixed(8));
  return {
    demo: true,
    configured: true,
    found: true,
    recordCount: 36,
    blockNumber: null,
    message: "Sample seal computed locally. It was not read from HyperEVM.",
    attestation: {
      trader: snapshot.address,
      timestamp: DEMO_TIMESTAMP,
      equityUsd: snapshot.equity,
      pnlUsd: pnl,
      dataHash: snapshotHash(snapshot.address, equity, pnlScaled, BigInt(DEMO_TIMESTAMP)),
    },
  };
}

function buildAccountCurve(): HistoryPoint[] {
  const random = mulberry32(0x7a11);
  const start = DEMO_TIMESTAMP * 1000 - 89 * 86_400_000;
  let equity = 100_000;
  let peak = equity;
  const points: HistoryPoint[] = [];
  for (let day = 0; day < 90; day += 1) {
    const shock = day === 48 ? -0.09 : day === 49 ? -0.025 : 0;
    const drift = 0.0042;
    const noise = (random() - 0.46) * 0.012;
    equity = Math.max(20_000, equity * (1 + drift + noise + shock));
    if (equity > peak) peak = equity;
    points.push({ t: start + day * 86_400_000, v: round2(equity) });
  }
  return points;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
