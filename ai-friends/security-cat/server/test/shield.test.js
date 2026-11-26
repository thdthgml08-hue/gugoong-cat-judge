import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShield } from '../src/shield.js';

const req = (url, { ip = '203.0.113.5', method = 'GET', ua = 'Mozilla/5.0' } = {}) =>
  ({ url, method, headers: { 'user-agent': ua }, socket: { remoteAddress: ip } });

function clock() { let t = 1_000_000; return { now: () => t, add: (ms) => { t += ms; } }; }

test('평범한 요청은 통과', () => {
  const s = createShield({ allowlist: [] });
  assert.equal(s.inspect(req('/index.html')).action, 'allow');
  assert.equal(s.inspect(req('/minigame/?stage=2')).action, 'allow');
});

test('SQL 인젝션·XSS·경로 조작은 막는다 (URL 인코딩 포함)', () => {
  const s = createShield({ allowlist: [] });
  assert.equal(s.inspect(req('/api?id=1%20UNION%20SELECT%20password')).rule, 'sqli');
  assert.equal(s.inspect(req('/search?q=%3Cscript%3Ealert(1)%3C/script%3E', { ip: '1.1.1.2' })).rule, 'xss');
  assert.equal(s.inspect(req('/../../etc/passwd', { ip: '1.1.1.3' })).rule, 'traversal');
  assert.equal(s.inspect(req('/%252e%252e%252f%252e%252e%252fetc/passwd', { ip: '1.1.1.4' })).action, 'block');
});

test('.env 탐색과 해킹 도구는 막는다', () => {
  const s = createShield({ allowlist: [] });
  assert.equal(s.inspect(req('/.env')).rule, 'probe');
  assert.equal(s.inspect(req('/', { ip: '1.1.1.9', ua: 'sqlmap/1.7' })).rule, 'scanner');
});

test('공격 3번이면 잠시 차단, 시간이 지나면 자동 해제', () => {
  const c = clock();
  const s = createShield({ allowlist: [], strikesToBan: 3, banMinutes: 15, now: c.now });
  for (const u of ['/.env', '/wp-admin', '/.git/config']) s.inspect(req(u));
  const r = s.inspect(req('/index.html'));
  assert.equal(r.action, 'block');
  assert.equal(r.rule, 'banned');
  assert.equal(s.status().bans.length, 1);
  c.add(16 * 60_000);
  assert.equal(s.inspect(req('/index.html')).action, 'allow');
});

test('분당 요청이 너무 많으면 429', () => {
  const s = createShield({ allowlist: [], ratePerMin: 5 });
  for (let i = 0; i < 5; i++) assert.equal(s.inspect(req('/')).action, 'allow');
  const r = s.inspect(req('/'));
  assert.equal(r.status, 429);
});

test('monitor 모드는 기록만 하고 통과', () => {
  const s = createShield({ allowlist: [], mode: 'monitor' });
  const r = s.inspect(req('/.env'));
  assert.equal(r.action, 'allow');
  assert.equal(r.flagged.rule, 'probe');
  assert.equal(s.status().recent.length, 1);
});

test('허용 목록과 수동 해제', () => {
  const s = createShield({ allowlist: ['10.0.0.1'], strikesToBan: 1 });
  assert.equal(s.inspect(req('/.env', { ip: '10.0.0.1' })).action, 'allow');
  s.inspect(req('/.env'));
  assert.equal(s.inspect(req('/')).rule, 'banned');
  assert.equal(s.unban('203.0.113.5'), true);
  assert.equal(s.inspect(req('/')).action, 'allow');
});
