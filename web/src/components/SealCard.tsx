"use client";

import { useState, type ReactNode } from "react";
import { formatSignedUsd, formatUsd, formatWhen, shortHash } from "@/lib/format";
import type { SealModel } from "@/lib/types";

export default function SealCard({ seal, loading }: { seal: SealModel | null; loading: boolean }) {
  const [copied, setCopied] = useState(false);
  const attestation = seal?.attestation ?? null;

  async function copyHash() {
    if (!attestation) return;
    try {
      await navigator.clipboard.writeText(attestation.dataHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldIcon />
          </span>
          <div>
            <h2 className="text-sm font-medium text-slate-100">Verification seal</h2>
            <p className="text-xs text-slate-500">HyperEVM registry record</p>
          </div>
        </div>
        <StatusPill seal={seal} loading={loading} />
      </div>

      {loading && !attestation ? (
        <div className="mt-6 flex flex-1 items-center justify-center">
          <Spinner label="Reading registry" />
        </div>
      ) : attestation ? (
        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Record hash">
            <button
              type="button"
              onClick={copyHash}
              className="font-mono text-xs text-emerald-200 hover:text-emerald-100"
              title={attestation.dataHash}
            >
              {copied ? "Copied" : shortHash(attestation.dataHash)}
            </button>
          </Row>
          <Row label="Block">
            <span className="font-mono text-slate-100">{seal?.blockNumber ?? "—"}</span>
          </Row>
          <Row label="Timestamp">
            <span className="font-mono text-xs text-slate-100">{formatWhen(attestation.timestamp)}</span>
          </Row>
          <Row label="Attested equity">
            <span className="font-mono text-slate-100">{formatUsd(attestation.equityUsd)}</span>
          </Row>
          <Row label="Attested PnL">
            <span className="font-mono text-slate-100">{formatSignedUsd(attestation.pnlUsd)}</span>
          </Row>
          <Row label="Records">
            <span className="font-mono text-slate-100">{seal?.recordCount ?? 0}</span>
          </Row>
        </dl>
      ) : (
        <p className="mt-6 flex-1 text-sm leading-6 text-slate-400">
          {seal?.message ?? "Verify an address to load its latest on-chain attestation."}
        </p>
      )}

      <p className="mt-5 text-[11px] leading-5 text-slate-500">
        Hash preimage is <span className="font-mono">trader:equity:pnl:timestamp</span> with equity and PnL scaled by 1e8.
        {seal?.demo ? " This sample was hashed in the browser." : ""}
        {seal?.message && attestation ? ` ${seal.message}` : ""}
      </p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StatusPill({ seal, loading }: { seal: SealModel | null; loading: boolean }) {
  if (loading) return <Pill className="bg-white/10 text-slate-300">Reading</Pill>;
  if (seal?.demo) return <Pill className="bg-amber-400/15 text-amber-200">Demo</Pill>;
  if (seal?.found) return <Pill className="bg-emerald-500/15 text-emerald-300">On-chain</Pill>;
  if (seal && !seal.configured) return <Pill className="bg-white/10 text-slate-300">Unset</Pill>;
  if (seal && seal.configured && !seal.found) return <Pill className="bg-white/10 text-slate-300">No record</Pill>;
  return <Pill className="bg-white/10 text-slate-300">Idle</Pill>;
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-emerald-400" />
      {label}
    </span>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2 19 6v6.2c0 4.2-2.9 7.1-7 8.6-4.1-1.5-7-4.4-7-8.6V6l7-2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="m8.8 12.1 2.2 2.2 4.3-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
