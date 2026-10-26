// Deploys the current build as a separate "jamn-good-preview" Worker on its workers.dev address,
// so people can look at changes before they go live. jamn-good.com is not touched.
//
//   pnpm deploy:preview
//
// The preview reads the live content (same D1 database and R2 photos) but gets none of the live
// Worker's secrets, so checkout can't take payments there. It runs no cron jobs, since the live
// Worker already does EmDash's scheduled work against the same database.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = 'jamn-good-preview';
const built = new URL('../dist/server/wrangler.json', import.meta.url);
const preview = new URL('../dist/server/wrangler.preview.json', import.meta.url);

const config = JSON.parse(readFileSync(built, 'utf8'));
config.name = NAME;
config.topLevelName = NAME;
config.routes = [];
config.workers_dev = true;
config.triggers = { crons: [] };
writeFileSync(preview, JSON.stringify(config));

execFileSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', preview.pathname], { stdio: 'inherit' });
