import { getAddress, keccak256, toBytes, type Hex } from "viem";

/** USD string or number → 1e8-scaled signed integer, matching TrackRecordRegistry. */
export function scale1e8(raw: string | number): bigint {
  const text = typeof raw === "number" ? raw.toFixed(8) : raw.trim();
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error(`Cannot scale USD value "${raw}"`);
  }
  const [whole, frac = ""] = unsigned.split(".");
  const fracFixed = `${frac}00000000`.slice(0, 8);
  const scaled = BigInt(whole) * 100_000_000n + BigInt(fracFixed);
  return negative ? -scaled : scaled;
}

export function from1e8(value: bigint): number {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100_000_000n;
  const frac = abs % 100_000_000n;
  const n = Number(whole) + Number(frac) / 1e8;
  return negative ? -n : n;
}

/** Canonical preimage. Address is EIP-55 checksummed so the hash is stable. */
export function snapshotPreimage(trader: string, equity: bigint, pnl: bigint, timestamp: bigint): string {
  return `${getAddress(trader)}:${equity.toString()}:${pnl.toString()}:${timestamp.toString()}`;
}

export function snapshotHash(trader: string, equity: bigint, pnl: bigint, timestamp: bigint): Hex {
  return keccak256(toBytes(snapshotPreimage(trader, equity, pnl, timestamp)));
}
