import { formatPx, formatSignedUsd, formatSize, pnlClass } from "@/lib/format";
import type { Position } from "@/lib/types";

export default function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-medium text-slate-200">Open positions</h2>
        <span className="font-mono text-xs text-slate-500">{positions.length}</span>
      </div>
      {positions.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-400">No open perp positions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr className="border-t border-white/5">
                <th className="px-5 py-3 font-medium">Coin</th>
                <th className="px-3 py-3 font-medium">Side</th>
                <th className="px-3 py-3 font-medium">Size</th>
                <th className="px-3 py-3 font-medium">Entry</th>
                <th className="px-3 py-3 font-medium">Liq price</th>
                <th className="px-3 py-3 font-medium">Leverage</th>
                <th className="px-5 py-3 text-right font-medium">Unrealized PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={`${position.coin}-${position.side}`} className="border-t border-white/5">
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-ink"
                        style={{ background: coinColor(position.coin) }}
                      >
                        {position.coin.slice(0, 1)}
                      </span>
                      {position.coin}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        position.side === "long"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {position.side === "long" ? "Long" : "Short"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-200">{formatSize(position.size)}</td>
                  <td className="px-3 py-3 font-mono text-slate-200">{formatPx(position.entryPx)}</td>
                  <td className="px-3 py-3 font-mono text-slate-200">{formatPx(position.liquidationPx)}</td>
                  <td className="px-3 py-3 font-mono text-slate-200">
                    {position.leverage === null ? "—" : `${position.leverage}×`}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono ${pnlClass(position.unrealizedPnl)}`}>
                    {formatSignedUsd(position.unrealizedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function coinColor(coin: string): string {
  const colors = ["#10B981", "#38BDF8", "#F59E0B", "#A78BFA", "#FB7185", "#2DD4BF"];
  let hash = 0;
  for (const char of coin) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
