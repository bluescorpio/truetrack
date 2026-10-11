"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { isAddress } from "viem";
import PositionsTable from "@/components/PositionsTable";
import SealCard, { Spinner } from "@/components/SealCard";
import { CONTRACT_SOURCE } from "@/lib/contractSource";
import { buildDemoSeal, buildDemoSnapshot } from "@/lib/demo";
import { formatDrawdown, formatPct, formatSignedUsd, formatUsd, pnlClass } from "@/lib/format";
import type { SealModel, TraderSnapshot } from "@/lib/types";

const PerformanceChart = dynamic(() => import("@/components/PerformanceChart"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-white/5" />,
});

type Tab = "verify" | "proof" | "how";

const TABS: { id: Tab; label: string }[] = [
  { id: "verify", label: "Verify" },
  { id: "proof", label: "On-chain Proof" },
  { id: "how", label: "How it works" },
];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("verify");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TraderSnapshot | null>(null);
  const [seal, setSeal] = useState<SealModel | null>(null);
  const [demo, setDemo] = useState(false);

  async function verify() {
    const next = address.trim();
    if (!next) {
      setError("Paste a Hyperliquid wallet address.");
      return;
    }
    if (!isAddress(next)) {
      setError("That address should be a 0x wallet with 40 hex characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [traderResponse, attestationResponse] = await Promise.all([
        fetch(`/api/trader?address=${encodeURIComponent(next)}`),
        fetch(`/api/attestation?address=${encodeURIComponent(next)}`),
      ]);
      const traderBody: unknown = await traderResponse.json();
      const attestationBody: unknown = await attestationResponse.json();

      if (!traderResponse.ok) {
        setError(errorFrom(traderBody, "Couldn't load this trader."));
        return;
      }
      if (!isSnapshot(traderBody)) {
        setError("The trader response was incomplete.");
        return;
      }

      setDemo(false);
      setSnapshot(traderBody);
      setAddress(traderBody.address);
      setSeal(attestationResponse.ok ? sealFromApi(attestationBody) : {
        demo: false,
        configured: true,
        found: false,
        recordCount: 0,
        blockNumber: null,
        message: errorFrom(attestationBody, "Couldn't read the registry."),
        attestation: null,
      });
    } catch {
      setError("Couldn't reach TrueTrack. Check that the dev server is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    const sample = buildDemoSnapshot();
    setDemo(true);
    setError(null);
    setLoading(false);
    setAddress(sample.address);
    setSnapshot(sample);
    setSeal(buildDemoSeal(sample));
    setTab("verify");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-semibold text-ink">
                T
              </span>
              <span className="text-lg font-semibold tracking-tight">TrueTrack</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Verifiable track records for Hyperliquid</p>
          </div>
          <div role="tablist" aria-label="Sections" className="flex w-full rounded-xl bg-white/5 p-1 lg:w-auto">
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition lg:flex-none lg:px-4 ${
                    selected ? "bg-accent text-ink" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "verify" && (
          <section>
            <form
              className="flex flex-col gap-3 md:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void verify();
              }}
            >
              <label className="sr-only" htmlFor="trader-address">
                Hyperliquid wallet address
              </label>
              <input
                id="trader-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="0x… Hyperliquid wallet"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-base text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={loadDemo}
                disabled={loading}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-slate-100 hover:border-emerald-400/40 disabled:opacity-60"
              >
                Load demo data
              </button>
            </form>

            {error && (
              <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
                {error}
              </p>
            )}

            {loading && !snapshot && (
              <div className="mt-8">
                <Spinner label="Fetching account state and the on-chain seal" />
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="card h-24 animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {!snapshot && !loading && !error && (
              <div className="card mt-8 px-6 py-14 text-center">
                <p className="text-lg font-medium text-slate-100">Check a trader before you copy them.</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Paste a Hyperliquid address to load live account value, open positions, and the latest
                  HyperEVM attestation. Or load demo data and walk the whole dashboard offline.
                </p>
              </div>
            )}

            {snapshot && (
              <div className={`mt-8 space-y-4 ${loading ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${demo ? "bg-amber-400/15 text-amber-200" : "bg-emerald-500/15 text-emerald-300"}`}>
                    {demo ? "Demo data" : "Live Hyperliquid"}
                  </span>
                  <span className="font-mono text-slate-300">{snapshot.address}</span>
                  <span>As of {new Date(snapshot.asOf).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Kpi label="Account value" value={formatUsd(snapshot.equity)} hint={`Withdrawable ${formatUsd(snapshot.withdrawable)} · Margin ${formatUsd(snapshot.marginUsed)}`} />
                  <Kpi label="Unrealized PnL" value={formatSignedUsd(snapshot.unrealizedPnl)} valueClass={pnlClass(snapshot.unrealizedPnl)} hint="Sum of open positions" />
                  <Kpi label="ROI" value={formatPct(snapshot.roi)} valueClass={pnlClass(snapshot.roi ?? 0)} hint="All-time PnL ÷ first funded equity" />
                  <Kpi
                    label="Volume"
                    value={formatUsd(snapshot.volume)}
                    hint={snapshot.volumeSource === "portfolio" ? "All-time notional" : "Sum of fill price × size"}
                  />
                  <Kpi
                    label="Trades"
                    value={snapshot.tradesCount.toLocaleString("en-US")}
                    hint={snapshot.fillsTruncated ? "Latest 2,000 fills" : "Fills returned by Hyperliquid"}
                  />
                  <Kpi label="Max drawdown" value={formatDrawdown(snapshot.maxDrawdown)} hint="Peak to trough, all-time" />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <section className="card p-5 lg:col-span-2">
                    <div className="mb-2 flex items-baseline justify-between">
                      <h2 className="text-sm font-medium text-slate-100">Account value</h2>
                      <span className="text-xs text-slate-500">All-time</span>
                    </div>
                    <PerformanceChart data={snapshot.accountValueHistory} />
                  </section>
                  <SealCard seal={seal} loading={loading && !demo} />
                </div>

                <PositionsTable positions={snapshot.positions} />
              </div>
            )}
          </section>
        )}

        {tab === "proof" && (
          <section className="space-y-4">
            <div className="card space-y-3 p-5 text-sm leading-6 text-slate-300">
              <p>1. The browser calls TrueTrack. The route handler POSTs clearinghouseState, portfolio, and userFills to Hyperliquid&apos;s public info API.</p>
              <p>2. A keeper snapshots equity and PnL, hashes trader:equity:pnl:timestamp, and calls TrackRecordRegistry.attest on HyperEVM.</p>
              <p>3. This page reads getLatest and recordCount, so the seal is the same record anyone can load from chain id 999.</p>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-white/5 px-5 py-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                contracts/src/TrackRecordRegistry.sol
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-emerald-100/90">{CONTRACT_SOURCE}</pre>
            </div>
            <div className="max-w-xl">
              <SealCard seal={seal} loading={loading} />
            </div>
          </section>
        )}

        {tab === "how" && (
          <section className="space-y-4">
            <ol className="grid gap-3 md:grid-cols-3">
              <Step n="1" title="Read the account">
                Paste a wallet. TrueTrack pulls clearinghouse state, the all-time portfolio, and fills on the server, so the browser never calls Hyperliquid directly.
              </Step>
              <Step n="2" title="Attest the snapshot">
                The keeper scales equity and PnL by 1e8, hashes that snapshot with the timestamp, and writes it through an authorized attester.
              </Step>
              <Step n="3" title="Show the seal">
                The dashboard places the live book next to the registry record: hash, block, and timestamp from HyperEVM.
              </Step>
            </ol>
            <div className="grid gap-3 md:grid-cols-2">
              <article className="card p-5">
                <h2 className="text-sm font-medium text-slate-400">Fake PnL screenshots</h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                  <li>Cropped balances with no source account.</li>
                  <li>Timestamps you cannot recompute.</li>
                  <li>Nothing an outsider can replay.</li>
                </ul>
              </article>
              <article className="card border-emerald-400/30 p-5">
                <h2 className="text-sm font-medium text-emerald-300">Verifiable on-chain record</h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                  <li>Account state comes from Hyperliquid&apos;s public info API.</li>
                  <li>The keeper stores keccak256 of trader, equity, PnL, and time.</li>
                  <li>getLatest on HyperEVM returns that exact attestation.</li>
                </ul>
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  valueClass = "text-slate-50",
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <article className="card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-lg font-medium tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p>
    </article>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="card p-5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 font-mono text-sm text-emerald-300">
        {n}
      </span>
      <h2 className="mt-3 text-sm font-medium text-slate-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </li>
  );
}

function sealFromApi(body: unknown): SealModel {
  const record = asRecord(body);
  const attestation = asRecord(record.attestation);
  const hasAttestation = typeof attestation.dataHash === "string";
  return {
    demo: false,
    configured: record.configured === true,
    found: record.found === true && hasAttestation,
    recordCount: typeof record.recordCount === "number" ? record.recordCount : 0,
    blockNumber: typeof record.blockNumber === "string" ? record.blockNumber : null,
    message: typeof record.message === "string" ? record.message : null,
    attestation: hasAttestation
      ? {
          trader: String(attestation.trader ?? ""),
          timestamp: Number(attestation.timestamp ?? 0),
          equityUsd: Number(attestation.equityUsd ?? 0),
          pnlUsd: Number(attestation.pnlUsd ?? 0),
          dataHash: String(attestation.dataHash),
        }
      : null,
  };
}

function isSnapshot(value: unknown): value is TraderSnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TraderSnapshot>;
  return typeof record.address === "string" && typeof record.equity === "number" && Array.isArray(record.positions);
}

function errorFrom(body: unknown, fallback: string): string {
  const record = asRecord(body);
  return typeof record.error === "string" ? record.error : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}
