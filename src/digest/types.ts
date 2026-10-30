export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestCounts = Record<RunStatus, number>;

export type NightDigest = {
  rows: DigestRow[];
  malformedLines: number;
  counts: DigestCounts;
};

export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
