import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const baseConfig: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

const tempDirs: string[] = [];

function createRunsDir(files: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents, 'utf8');
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('renders the HTML page and returns the same sorted rows as JSON', async () => {
    const app = createApp(baseConfig);
    const page = await app.request('/digest/2026-10-28');
    const pageHtml = await page.text();
    const api = await app.request('/api/digest/2026-10-28');
    const rows = await api.json();

    expect(page.status).toBe(200);
    expect(pageHtml).toContain('digest · 2026-10-28');
    expect(pageHtml).toContain('1 malformed line(s) ignored');
    expect(api.status).toBe(200);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.map((row: { job: string }) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 for a night without a file', async () => {
    const app = createApp({ ...baseConfig, runsDir: createRunsDir() });
    expect((await app.request('/digest/2026-10-30')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-30')).status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON array', async () => {
    const app = createApp({
      ...baseConfig,
      runsDir: createRunsDir({ '2026-10-30.jsonl': '' }),
    });
    const page = await app.request('/digest/2026-10-30');
    const api = await app.request('/api/digest/2026-10-30');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await api.json()).toEqual([]);
  });

  it('counts malformed lines without failing either route', async () => {
    const event = JSON.stringify({
      at: '2026-10-30T01:00:00+01:00',
      job: 'sample/job',
      status: 'fail',
      owner: 'lane-07',
      error: 'test failure',
    });
    const app = createApp({
      ...baseConfig,
      runsDir: createRunsDir({ '2026-10-30.jsonl': `not-json\n${event}\n` }),
    });
    const page = await app.request('/digest/2026-10-30');
    const api = await app.request('/api/digest/2026-10-30');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('1 malformed line(s) ignored');
    expect(await api.json()).toMatchObject([{ job: 'sample/job', lastStatus: 'fail' }]);
  });
});
