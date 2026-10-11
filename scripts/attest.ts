/**
 * TrueTrack keeper.
 *
 * From the repo root:
 *   npm install
 *   npm run attest:once
 *   npm run attest          # repeats every ATTEST_INTERVAL_MINUTES (default 15)
 *
 * For each watched trader it reads Hyperliquid clearinghouse + all-time portfolio,
 * scales equity and PnL to 1e8, and calls TrackRecordRegistry.attest.
 * dataHash = keccak256(utf8 `${checksumAddress}:${equity}:${pnl}:${timestamp}`).
 */
import { config } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

config();

const INFO_URL = "https://api.hyperliquid.xyz/info";
const DEFAULT_RPC = "https://rpc.hyperliquid.xyz/evm";
const INTERVAL_MINUTES = positiveInt(process.env.ATTEST_INTERVAL_MINUTES, 15);

const registryAbi = [
  {
    type: "function",
    name: "attest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "trader", type: "address" },
      { name: "timestamp", type: "uint64" },
      { name: "equity", type: "int256" },
      { name: "pnl", type: "int256" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [process.env.HYPERLIQUID_RPC || DEFAULT_RPC] } },
});

type RunStats = { ok: number; failed: number };

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const registry = requiredAddress("NEXT_PUBLIC_REGISTRY_ADDRESS");
  const traders = requiredTraders();
  const account = privateKeyToAccount(requiredPrivateKey());
  const transport = http(process.env.HYPERLIQUID_RPC || DEFAULT_RPC);
  const wallet = createWalletClient({ account, chain: hyperEvm, transport });
  const publicClient = createPublicClient({ chain: hyperEvm, transport });

  console.log(
    `Keeper ${account.address} watching ${traders.length} trader(s) on registry ${registry}`,
  );

  do {
    const stats = await runOnce(wallet, publicClient, account, registry, traders);
    console.log(`Pass complete: ${stats.ok} attested, ${stats.failed} failed`);
    if (once) {
      if (stats.ok === 0) process.exitCode = 1;
      return;
    }
    console.log(`Sleeping ${INTERVAL_MINUTES} minute(s)`);
    await sleep(INTERVAL_MINUTES * 60_000);
  } while (true);
}

async function runOnce(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  registry: Address,
  traders: Address[],
): Promise<RunStats> {
  const stats: RunStats = { ok: 0, failed: 0 };
  for (const trader of traders) {
    try {
      const snapshot = await loadSnapshot(trader);
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const equity = scale1e8(snapshot.equity);
      const pnl = scale1e8(snapshot.pnl);
      const preimage = `${trader}:${equity.toString()}:${pnl.toString()}:${timestamp.toString()}`;
      const dataHash = keccak256(toBytes(preimage));
      console.log(
        `Attesting ${trader} equity=${snapshot.equity} pnl=${snapshot.pnl} hash=${dataHash}`,
      );
      const hash = await wallet.writeContract({
        address: registry,
        abi: registryAbi,
        functionName: "attest",
        args: [trader, timestamp, equity, pnl, dataHash],
        account,
        chain: hyperEvm,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Confirmed ${hash} in block ${receipt.blockNumber.toString()}`);
      stats.ok += 1;
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${trader}: ${message}`);
    }
  }
  return stats;
}

async function loadSnapshot(trader: Address): Promise<{ equity: string; pnl: string }> {
  const [state, portfolio] = await Promise.all([
    postInfo({ type: "clearinghouseState", user: trader }),
    postInfo({ type: "portfolio", user: trader }),
  ]);
  const margin = asRecord(asRecord(state).marginSummary);
  const equity = stringValue(margin.accountValue);
  if (equity === null) {
    throw new Error("clearinghouseState did not include marginSummary.accountValue");
  }
  const pnl = allTimePnl(portfolio) ?? sumUnrealized(state);
  return { equity, pnl };
}

function allTimePnl(portfolio: unknown): string | null {
  if (!Array.isArray(portfolio)) return null;
  const windows = new Map<string, Record<string, unknown>>();
  for (const entry of portfolio) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    if (entry[1] && typeof entry[1] === "object") windows.set(entry[0], entry[1] as Record<string, unknown>);
  }
  const chosen = windows.get("allTime") ?? windows.get("perpAllTime");
  if (!chosen || !Array.isArray(chosen.pnlHistory) || chosen.pnlHistory.length === 0) return null;
  const last = chosen.pnlHistory[chosen.pnlHistory.length - 1];
  if (!Array.isArray(last)) return null;
  return stringValue(last[1]);
}

function sumUnrealized(state: unknown): string {
  const positions = asRecord(state).assetPositions;
  if (!Array.isArray(positions)) return "0";
  let sum = 0;
  for (const item of positions) {
    const position = asRecord(asRecord(item).position);
    const pnl = Number(position.unrealizedPnl ?? 0);
    if (Number.isFinite(pnl)) sum += pnl;
  }
  return sum.toFixed(8);
}

async function postInfo(body: { type: string; user: Address }): Promise<unknown> {
  const response = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid info API returned HTTP ${response.status}`);
  }
  return response.json();
}

function scale1e8(raw: string): bigint {
  const text = raw.trim();
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

function requiredAddress(name: string): Address {
  const value = process.env[name]?.trim() ?? "";
  if (!isAddress(value)) {
    throw new Error(`Set ${name} to the deployed TrackRecordRegistry address`);
  }
  return getAddress(value);
}

function requiredTraders(): Address[] {
  const raw = process.env.WATCHED_TRADERS?.trim() ?? "";
  if (!raw) throw new Error("Set WATCHED_TRADERS to one or more comma-separated addresses");
  const traders = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (traders.length === 0) throw new Error("WATCHED_TRADERS is empty");
  return traders.map((trader) => {
    if (!isAddress(trader)) throw new Error(`Invalid watched trader: ${trader}`);
    return getAddress(trader);
  });
}

function requiredPrivateKey(): Hex {
  const value = process.env.ATTESTER_PRIVATE_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Set ATTESTER_PRIVATE_KEY to a 0x-prefixed 32-byte hex key");
  }
  return value as Hex;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
