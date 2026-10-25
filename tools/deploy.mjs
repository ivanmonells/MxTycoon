#!/usr/bin/env node
/* Publishes the online version on Firebase Hosting together with the database rules
   and indexes. Needs the web configuration (online.config.json or MX_ONLINE_CONFIG)
   and deploy rights: a service account key in FIREBASE_SERVICE_ACCOUNT (the JSON
   itself) or GOOGLE_APPLICATION_CREDENTIALS (its path), or a firebase CLI logged in
   on this machine. The Firestore database must exist (created once in the console).
   Usage: node tools/deploy.mjs */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.assign({}, process.env);
const cfgText = (env.MX_ONLINE_CONFIG || '').trim() || (existsSync(join(root, 'online.config.json')) ? readFileSync(join(root, 'online.config.json'), 'utf8') : '');
if (!cfgText) { console.error('Falta la configuración web de Firebase: crea online.config.json (ver online.config.example.json) o define MX_ONLINE_CONFIG.'); process.exit(1); }
const cfg = JSON.parse(cfgText);
const project = cfg.firebase && cfg.firebase.projectId;
if (!project) { console.error('La configuración no tiene firebase.projectId.'); process.exit(1); }
env.MX_ONLINE_CONFIG = JSON.stringify(cfg);
if ((env.FIREBASE_SERVICE_ACCOUNT || '').trim() && !env.GOOGLE_APPLICATION_CREDENTIALS) {
  const file = join(mkdtempSync(join(tmpdir(), 'mxt-')), 'sa.json');
  writeFileSync(file, env.FIREBASE_SERVICE_ACCOUNT, { mode: 0o600 });
  env.GOOGLE_APPLICATION_CREDENTIALS = file;
}
const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: root, env });
run('node build.mjs');
run('npx --yes firebase-tools@15 deploy --only hosting,firestore --project ' + project + ' --non-interactive --force');
console.log('\nPublicado: https://' + project + '.web.app');
