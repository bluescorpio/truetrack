export type HistoryPoint = {
  t: number;
  v: number;
};

export type Position = {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number | null;
  liquidationPx: number | null;
  leverage: number | null;
  unrealizedPnl: number;
};

export type TraderSnapshot = {
  address: string;
  equity: number;
  marginUsed: number;
  withdrawable: number;
  positions: Position[];
  unrealizedPnl: number;
  tradesCount: number;
  fillsTruncated: boolean;
  volume: number;
  volumeSource: "portfolio" | "fills";
  pnlHistory: HistoryPoint[];
  accountValueHistory: HistoryPoint[];
  roi: number | null;
  maxDrawdown: number | null;
  asOf: number;
};

export type AttestationPayload = {
  trader: string;
  timestamp: number;
  equity: string;
  pnl: string;
  equityUsd: number;
  pnlUsd: number;
  dataHash: string;
};

export type AttestationResponse = {
  configured: boolean;
  found: boolean;
  recordCount: number;
  blockNumber: string | null;
  message: string | null;
  attestation: AttestationPayload | null;
};

export type SealModel = {
  demo: boolean;
  configured: boolean;
  found: boolean;
  recordCount: number;
  blockNumber: string | null;
  message: string | null;
  attestation: {
    trader: string;
    timestamp: number;
    equityUsd: number;
    pnlUsd: number;
    dataHash: string;
  } | null;
};
