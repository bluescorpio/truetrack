import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { normalizeTrader } from "@/lib/normalize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INFO_URL = "https://api.hyperliquid.xyz/info";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!address) {
    return NextResponse.json({ error: "Paste a Hyperliquid wallet address." }, { status: 400 });
  }
  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "That address should be a 0x wallet with 40 hex characters." },
      { status: 400 },
    );
  }

  const user = getAddress(address);
  try {
    const [state, portfolio, fills] = await Promise.all([
      postInfo({ type: "clearinghouseState", user }),
      postInfo({ type: "portfolio", user }).catch((error: unknown) => {
        console.error("portfolio fetch failed", error);
        return null;
      }),
      postInfo({ type: "userFills", user }).catch((error: unknown) => {
        console.error("userFills fetch failed", error);
        return null;
      }),
    ]);
    return NextResponse.json(normalizeTrader(user, state, portfolio, fills));
  } catch (error) {
    console.error("trader route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Couldn't load this trader from Hyperliquid. ${detail}` },
      { status: 502 },
    );
  }
}

async function postInfo(body: { type: string; user: string }): Promise<unknown> {
  const response = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid info API returned HTTP ${response.status}`);
  }
  return response.json();
}
