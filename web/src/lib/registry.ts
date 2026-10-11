import {
  createPublicClient,
  defineChain,
  http,
  isAddress,
  parseAbiItem,
  type Address,
} from "viem";
import { loadRootEnv } from "./env";
import { from1e8 } from "./scale";
import type { AttestationResponse } from "./types";

const DEFAULT_RPC = "https://rpc.hyperliquid.xyz/evm";

export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: [DEFAULT_RPC] },
  },
});

export type Attestation = {
  trader: Address;
  timestamp: bigint;
  equity: bigint;
  pnl: bigint;
  dataHash: `0x${string}`;
};

const registryAbi = [
  {
    type: "function",
    name: "getLatest",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trader", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "equity", type: "int256" },
          { name: "pnl", type: "int256" },
          { name: "dataHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "recordCount",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const attestedEvent = parseAbiItem(
  "event Attested(address indexed trader, uint64 timestamp, int256 equity, int256 pnl, bytes32 dataHash)",
);

export async function readTraderAttestation(trader: Address): Promise<AttestationResponse> {
  loadRootEnv();
  const configuredAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS?.trim() ?? "";
  if (!configuredAddress) {
    return empty(false, "Set NEXT_PUBLIC_REGISTRY_ADDRESS to read attestations from HyperEVM.");
  }
  if (!isAddress(configuredAddress)) {
    return empty(false, "NEXT_PUBLIC_REGISTRY_ADDRESS is not a valid contract address.");
  }

  const rpc = process.env.HYPERLIQUID_RPC?.trim() || DEFAULT_RPC;
  const client = createPublicClient({
    chain: { ...hyperEvm, rpcUrls: { default: { http: [rpc] } } },
    transport: http(rpc, { timeout: 12_000 }),
  });
  const registry = configuredAddress as Address;

  try {
    const [recordCount, latest] = await Promise.all([
      client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "recordCount",
        args: [trader],
      }),
      client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getLatest",
        args: [trader],
      }),
    ]);

    const attestation: Attestation = {
      trader: latest.trader,
      timestamp: latest.timestamp,
      equity: latest.equity,
      pnl: latest.pnl,
      dataHash: latest.dataHash,
    };

    let blockNumber: bigint | null = null;
    try {
      const logs = await client.getLogs({
        address: registry,
        event: attestedEvent,
        args: { trader },
        fromBlock: 0n,
        toBlock: "latest",
      });
      blockNumber = logs.at(-1)?.blockNumber ?? null;
    } catch (error) {
      console.error("Attested log lookup failed", error);
    }

    return {
      configured: true,
      found: true,
      recordCount: Number(recordCount),
      blockNumber: blockNumber?.toString() ?? null,
      message: null,
      attestation: {
        trader: attestation.trader,
        timestamp: Number(attestation.timestamp),
        equity: attestation.equity.toString(),
        pnl: attestation.pnl.toString(),
        equityUsd: from1e8(attestation.equity),
        pnlUsd: from1e8(attestation.pnl),
        dataHash: attestation.dataHash,
      },
    };
  } catch (error) {
    if (isNoRecord(error)) {
      const count = await readCount(client, registry, trader);
      return {
        configured: true,
        found: false,
        recordCount: count,
        blockNumber: null,
        message: "No attestation has been written for this address yet.",
        attestation: null,
      };
    }
    console.error("Registry read failed", error);
    return empty(true, "The registry didn't respond. Check the contract address and HyperEVM RPC.");
  }
}

async function readCount(
  client: ReturnType<typeof createPublicClient>,
  registry: Address,
  trader: Address,
): Promise<number> {
  try {
    const count = await client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "recordCount",
      args: [trader],
    });
    return Number(count);
  } catch {
    return 0;
  }
}

function empty(configured: boolean, message: string): AttestationResponse {
  return {
    configured,
    found: false,
    recordCount: 0,
    blockNumber: null,
    message,
    attestation: null,
  };
}

function isNoRecord(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("no record");
}
