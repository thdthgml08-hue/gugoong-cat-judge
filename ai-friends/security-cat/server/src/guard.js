#!/usr/bin/env node
// 문지기 모드: 사이트 앞에 서서 모든 요청을 먼저 검사한다.
//  - TARGET=http://127.0.0.1:3000  → 검사를 통과한 요청만 그 서버로 넘긴다 (리버스 프록시)
//  - TARGET 없음                     → 정적 파일을 직접 내준다 (기본: 채점소 레포 최상위)
// 관리: GET /__guard/status, POST /__guard/unban?ip=... (GUARD_TOKEN 필요)
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { createShield } from './shield.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const TARGET = process.env.TARGET ? new URL(process.env.TARGET) : null;
const STATIC_DIR = path.resolve(process.argv[2] || process.env.STATIC_DIR || path.join(here, '..', '..', '..', '..'));
const TOKEN = process.env.GUARD_TOKEN || '';

const shield = createShield({
  mode: process.env.GUARD_MODE === 'monitor' ? 'monitor' : 'block',
  ratePerMin: Number(process.env.GUARD_RATE_PER_MIN || 120),
  banMinutes: Number(process.env.GUARD_BAN_MINUTES || 15),
  trustProxy: process.env.GUARD_TRUST_PROXY === '1',
  allowlist: (process.env.GUARD_ALLOWLIST ?? '127.0.0.1,::1').split(',').map((s) => s.trim()).filter(Boolean),
  onEvent: (ev) => console.log(JSON.stringify(ev)),
});

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};

function isAdmin(req) {
  if (!TOKEN) return false;
  const got = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(STATIC_DIR, '.' + rel);
  // 폴더 밖, 숨김 파일(.git, .env 등), node_modules는 절대 내주지 않는다.
  const inside = file === STATIC_DIR || file.startsWith(STATIC_DIR + path.sep);
  const hidden = path.relative(STATIC_DIR, file).split(path.sep).some((p) => p.startsWith('.') || p === 'node_modules');
  let st;
  try { st = statSync(file); } catch { st = null; }
  if (!inside || hidden || !st) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('없어요 냥\n'); }
  if (st.isDirectory()) { res.writeHead(301, { location: rel + '/' }); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

function proxy(req, res, ip) {
  const headers = { ...req.headers, host: TARGET.host, 'x-forwarded-for': ip, 'x-forwarded-proto': 'http' };
  const up = http.request({ hostname: TARGET.hostname, port: TARGET.port || 80, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('뒤쪽 서버가 응답하지 않아요\n'); });
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/__guard/')) {
    if (!isAdmin(req)) { res.writeHead(404); return res.end(); }
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/__guard/status') return res.end(JSON.stringify(shield.status(), null, 2));
    if (req.method === 'POST' && url.pathname === '/__guard/unban') {
      const ip = url.searchParams.get('ip') || '';
      return res.end(JSON.stringify({ ip, unbanned: shield.unban(ip) }));
    }
    res.writeHead(404); return res.end();
  }
  if (shield.handle(req, res)) return;
  if (TARGET) proxy(req, res, (req.socket.remoteAddress || '').replace(/^::ffff:/, ''));
  else serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`🛡️ 사이버 지킴이 구공이 근무 시작! http://${HOST}:${PORT}`);
  console.log(`   지키는 곳: ${TARGET ? TARGET.href + ' (프록시)' : STATIC_DIR + ' (정적 파일)'}`);
  console.log(`   모드: ${process.env.GUARD_MODE === 'monitor' ? '기록만 (monitor)' : '막기 (block)'}`);
});
