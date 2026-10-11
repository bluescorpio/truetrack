import type { HistoryPoint, Position, TraderSnapshot } from "./types";

export function normalizeTrader(
  address: string,
  state: unknown,
  portfolio: unknown,
  fills: unknown,
): TraderSnapshot {
  const clearing = asRecord(state);
  if (!clearing.marginSummary || typeof clearing.marginSummary !== "object") {
    throw new Error("Hyperliquid returned an unexpected account payload.");
  }
  const margin = asRecord(clearing.marginSummary);
  const positions = parsePositions(clearing.assetPositions);
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const fillList = Array.isArray(fills) ? fills : [];
  const { accountValueHistory, pnlHistory, vlm } = parsePortfolio(portfolio);
  const fillVolume = sumFillNotional(fillList);
  const volumeSource = vlm > 0 ? "portfolio" : "fills";

  return {
    address,
    equity: num(margin.accountValue),
    marginUsed: num(margin.totalMarginUsed),
    withdrawable: num(clearing.withdrawable),
    positions,
    unrealizedPnl,
    tradesCount: fillList.length,
    fillsTruncated: fillList.length >= 2000,
    volume: vlm > 0 ? vlm : fillVolume,
    volumeSource,
    pnlHistory,
    accountValueHistory,
    roi: computeRoi(pnlHistory, accountValueHistory),
    maxDrawdown: computeMaxDrawdown(accountValueHistory),
    asOf: num(clearing.time) || Date.now(),
  };
}

export function computeRoi(pnlHistory: HistoryPoint[], accountValueHistory: HistoryPoint[]): number | null {
  if (pnlHistory.length === 0) return null;
  const startIdx = accountValueHistory.findIndex((point) => point.v > 0);
  if (startIdx === -1) return null;
  const base = accountValueHistory[startIdx].v;
  if (!(base > 0)) return null;
  const startTime = accountValueHistory[startIdx].t;
  let startPnl = pnlHistory[0].v;
  for (const point of pnlHistory) {
    if (point.t >= startTime) {
      startPnl = point.v;
      break;
    }
  }
  const endPnl = pnlHistory[pnlHistory.length - 1].v;
  const roi = ((endPnl - startPnl) / base) * 100;
  return Number.isFinite(roi) ? roi : null;
}

export function computeMaxDrawdown(history: HistoryPoint[]): number | null {
  if (history.length < 2) return null;
  let peak = history[0].v;
  let maxDrawdown = 0;
  for (const point of history) {
    if (point.v > peak) peak = point.v;
    if (peak > 0 && point.v < peak) {
      const drawdown = ((peak - point.v) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

function parsePortfolio(portfolio: unknown): {
  accountValueHistory: HistoryPoint[];
  pnlHistory: HistoryPoint[];
  vlm: number;
} {
  const empty = { accountValueHistory: [] as HistoryPoint[], pnlHistory: [] as HistoryPoint[], vlm: 0 };
  if (!Array.isArray(portfolio)) return empty;
  const windows = new Map<string, Record<string, unknown>>();
  for (const entry of portfolio) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    if (entry[1] && typeof entry[1] === "object") windows.set(String(entry[0]), entry[1] as Record<string, unknown>);
  }
  const chosen = windows.get("allTime") ?? windows.get("perpAllTime");
  if (!chosen) return empty;
  return {
    accountValueHistory: parseHistory(chosen.accountValueHistory),
    pnlHistory: parseHistory(chosen.pnlHistory),
    vlm: num(chosen.vlm),
  };
}

function parseHistory(raw: unknown): HistoryPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: HistoryPoint[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const t = num(row[0]);
    const v = num(row[1]);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    points.push({ t, v });
  }
  return points;
}

function parsePositions(raw: unknown): Position[] {
  if (!Array.isArray(raw)) return [];
  const positions: Position[] = [];
  for (const item of raw) {
    const position = asRecord(asRecord(item).position);
    const sizeSigned = num(position.szi);
    if (sizeSigned === 0) continue;
    const leverage = asRecord(position.leverage);
    const leverageValue = num(leverage.value);
    positions.push({
      coin: String(position.coin ?? ""),
      side: sizeSigned > 0 ? "long" : "short",
      size: Math.abs(sizeSigned),
      entryPx: nullableNum(position.entryPx),
      liquidationPx: nullableNum(position.liquidationPx),
      leverage: leverageValue > 0 ? leverageValue : null,
      unrealizedPnl: num(position.unrealizedPnl),
    });
  }
  positions.sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl));
  return positions;
}

function sumFillNotional(fills: unknown[]): number {
  let sum = 0;
  for (const fill of fills) {
    const row = asRecord(fill);
    sum += Math.abs(num(row.px) * num(row.sz));
  }
  return sum;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
