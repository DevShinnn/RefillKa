/**
 * Always deploys this repo to DevShinnn's Vercel project (refillika).
 * Does not use the local GitHub login — only the Vercel project IDs below.
 *
 * Usage: npm run deploy
 */
import { spawnSync } from 'node:child_process';

const SCOPE = 'shin-8802';
const PROJECT = 'refillika';

const result = spawnSync(
  'npx',
  ['vercel', 'deploy', '--prod', '--yes', `--scope=${SCOPE}`, `--name=${PROJECT}`],
  { stdio: 'inherit', shell: true }
);

process.exit(result.status ?? 1);
