export function formatUsd(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${trimFixed(abs / 1_000_000_000, 2)}B`;
  if (abs >= 1_000_000) return `${sign}$${trimFixed(abs / 1_000_000, 2)}M`;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatSignedUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const core = formatUsd(Math.abs(value));
  if (value > 0) return `+${core}`;
  if (value < 0) return `-${core}`;
  return core;
}

export function formatPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  const abs = Math.abs(value);
  if (abs >= 10_000) return `${sign}${trimFixed(value / 1000, 1)}k%`;
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDrawdown(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatPx(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
}

export function formatSize(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatWhen(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "—";
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function shortHash(hash: string): string {
  if (hash.length < 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function pnlClass(value: number): string {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-slate-200";
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
