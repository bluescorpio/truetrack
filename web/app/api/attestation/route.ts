import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { readTraderAttestation } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const attestation = await readTraderAttestation(getAddress(address));
  return NextResponse.json(attestation);
}
