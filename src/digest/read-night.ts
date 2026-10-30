import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

type MutableDigestRow = DigestRow;

const nightPattern = /^\d{4}-\d{2}-\d{2}$/;
const statuses = new Set<RunStatus>(['ok', 'retry', 'fail']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRunEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (typeof value.at !== 'string' || value.at.length === 0) return null;
  if (typeof value.job !== 'string' || value.job.length === 0) return null;
  if (typeof value.status !== 'string' || !statuses.has(value.status as RunStatus)) return null;
  if (value.owner !== null && typeof value.owner !== 'string') return null;
  if (value.error !== undefined && typeof value.error !== 'string') return null;

  return {
    at: value.at,
    job: value.job,
    status: value.status as RunStatus,
    owner: value.owner,
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!nightPattern.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, MutableDigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let malformedLines = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const event = parseRunEvent(line);
    if (!event) {
      malformedLines += 1;
      continue;
    }

    counts[event.status] += 1;
    const row = rows.get(event.job);
    if (!row) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    row.owner = event.owner;
    row.runs += 1;
    if (event.status === 'retry') row.retries += 1;
    row.lastStatus = event.status;
    if (event.error !== undefined) row.lastError = event.error;
    row.lastAt = event.at;
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)),
    malformedLines,
    counts,
  };
};
