import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

const destination = process.argv[2];
if (!destination) throw new Error('Provide an output path for the HTML preview.');

const response = await createApp(loadConfig()).request('/digest/2026-10-28');
if (!response.ok) throw new Error(`Digest route returned ${response.status}.`);

const outputPath = resolve(destination);
writeFileSync(outputPath, await response.text(), 'utf8');
console.log(`Saved self-contained digest HTML to ${outputPath}`);
