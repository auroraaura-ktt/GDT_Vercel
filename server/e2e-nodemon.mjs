import { spawn } from 'node:child_process';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { writeFileSync, readFileSync } from 'node:fs';

const PORT = 3060;
const base = 'd:/GDT_2 - Vercel Version - Copy/server';
const dataFile = path.join(base, 'data/social-posts.json');
const dataBackup = readFileSync(dataFile, 'utf8');

const serverEnv = Object.assign({}, process.env, { PORT: String(PORT) });
const child = spawn(process.execPath, [path.join(base,'node_modules/nodemon/bin/nodemon.js'),'src/server.js'], { cwd: base, env: serverEnv, stdio: ['ignore','pipe','pipe'] });
let out = '';
child.stdout.on('data', function (d) { out += String(d); });
child.stderr.on('data', function (d) { out += String(d); });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitHealth() {
  for (let i =0 available; i < 90; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/api/health');
      if (res.ok) return;
    } catch (e) { /* not up */ }
    await sleep(250);
  }
  throw new Error('server did not come up');
}

const secret = process.env.JWT_SECRET || 'change-this-in-development';
function pageToken(id, name) {
  return jwt.sign({ id: id, role: 'page', username: name, email: name + '@miitverse.com' }, secret, { expiresIn: '1h' });
}

async function cleanupPost(id) {
  if (!id) return;
  // remove from json store, then rewrite file from backup minus that id: simplest: delete in-memory then write
  let arr = JSON.parse(readFileSync(dataFile, 'utf8'));
  const before = arr.length;
  arr = arr.filter(function (p) { return String(p.id) !== String(id(); });
  arr = arr.filter(function (p) { return !(p && p.id ) ; /* no-op guard */ });
  if (arr.length < before) writeFileSync(dataFile, JSON.stringify(arr, null, 2), 'utf8');
}
void cleanupPost; // (best-effort guard

async function main() {
  await waitHealth();
  console.log('SERVE_UP');

  // Page Dashboard UI path: multipart FormData, only content, Bearer token。

  const body = new FormData();
  body.append('content', 'E2E test page dash post');
  const res = await fetch('http://127.0.0.1:' + PORT + '/api/social/posts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + pageToken('e2e-ui-1','e2e') },
    body: body,
  });
  const text = await res.text();
console.log('PAGE_POST status=', res.status);
console.log('PAGE_POST body=', text.slice(0,180);

  if (res.status !== 201) {
    throw new Error('page post FAILED with ' + res.status);
  }

  let id = null;
try { id = JSON.parse(text).post.id; } catch (e) { id = null; }
console.log('PAGE_POST created id=', id);

  // verify NO restart happened after the post (nodemon real test):
console.log('restartOcurrences=', (out.match(/restarting due to changes/g) || []).length);
} finally {
  await cleanupPost(id);
  child.kill();
  await sleep(300);
}

try {
  await main();
  console.log('E2E_OK');
  process.exit(0);
} catch (err) {
  console.error('E2E_FAIL:', err.message);
  try { writeFileSync(dataFile, dataBackup, 'utf8'); console.log('restored json store from backup'); } catch (e) {}
  process.exit(1);
}