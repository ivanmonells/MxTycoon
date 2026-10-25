#!/usr/bin/env node
/* MX Tycoon - build script. Inlines styles and scripts listed in index.html into
   single-file outputs (no dependencies, Node 18+):
     dist/mx-tycoon.html  complete standalone HTML document (offline)
     dist/artifact.html   body fragment for hosts that add the document skeleton
     dist/web/index.html  public web build with the online mode, when there is a
                          configuration in online.config.json or MX_ONLINE_CONFIG
   node build.mjs --emu  also writes dist/web-emu/index.html wired to the local
                         Firebase emulators (tools/online-test.mjs) */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const index = read('index.html');

const between = (tag) => {
  const m = index.match(new RegExp('<!-- @' + tag + ' -->([\\s\\S]*?)<!-- /@' + tag + ' -->'));
  if (!m) throw new Error('index.html is missing the @' + tag + ' block');
  return m[1].trim();
};
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const styles = [...index.matchAll(/<link rel="stylesheet" href="(src\/[^"]+)">/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('no scripts found in index.html');

const version = (read('src/core/util.js').match(/MX\.VERSION\s*=\s*'([^']+)'/) || [])[1] || 'dev';
const css = styles.map((p) => '/* ' + p + ' */\n' + read(p)).join('\n');
const js = scripts.map((p) => '/* ---- ' + p + ' ---- */\n' + read(p)).join('\n;\n')
  .replace(/<\/script/gi, '<\\/script');
const fonts = between('fonts');
const body = between('body');
const title = '<title>MX Tycoon: Motocross Empire</title>';

const page = (online) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#2b231d">
${title}
${fonts}
<style>
${css}
</style>
</head>
<body>
${body}
${online ? '<script>window.MX_ONLINE = ' + JSON.stringify(online) + ';</script>' : ''}
<script>
${js}
</script>
</body>
</html>
`;
const standalone = page(null);

const fragment = `${title}
${fonts}
<style>
${css}
</style>
${body}
<script>
${js}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/mx-tycoon.html'), standalone);
writeFileSync(join(root, 'dist/artifact.html'), fragment);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log(`MX Tycoon ${version}: ${scripts.length} scripts, ${styles.length} stylesheet(s)`);
console.log('  dist/mx-tycoon.html ' + kb(standalone));
console.log('  dist/artifact.html  ' + kb(fragment));

/* public web build: the Firebase web configuration is public (it only names the
   project); access is controlled by firestore.rules */
const cfgFile = join(root, 'online.config.json');
const onlineCfg = process.env.MX_ONLINE_CONFIG ? JSON.parse(process.env.MX_ONLINE_CONFIG) : existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : null;
if (onlineCfg) {
  if (!onlineCfg.firebase || !onlineCfg.firebase.apiKey || !onlineCfg.firebase.projectId) throw new Error('online.config.json needs firebase.apiKey and firebase.projectId');
  mkdirSync(join(root, 'dist/web'), { recursive: true });
  const web = page(onlineCfg);
  writeFileSync(join(root, 'dist/web/index.html'), web);
  console.log('  dist/web/index.html ' + kb(web) + ' (online: ' + onlineCfg.firebase.projectId + ')');
}
if (process.argv.includes('--emu')) {
  const emu = page({ firebase: { apiKey: 'demo-key', authDomain: 'demo-mxtycoon.firebaseapp.com', projectId: 'demo-mxtycoon' }, emulators: { auth: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8080 } });
  mkdirSync(join(root, 'dist/web-emu'), { recursive: true });
  writeFileSync(join(root, 'dist/web-emu/index.html'), emu);
  console.log('  dist/web-emu/index.html ' + kb(emu) + ' (emulators)');
}
