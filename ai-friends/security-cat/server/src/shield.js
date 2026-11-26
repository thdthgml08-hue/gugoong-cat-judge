// 사이버 지킴이: 들어오는 요청을 보고 해킹 시도를 그 자리에서 막는다.
// 막는 건 AI가 아니라 정해진 규칙이 한다. 빠르고, 예측 가능하고, 차단은 시간이 지나면 저절로 풀린다.
// 데이터를 지우거나 서버 설정을 바꾸지 않는다. 하는 일은 "이 요청을 들여보낼까 말까"뿐이다.
import { ATTACK_RE, PROBE_RE } from './rules.js';

const SCANNER_UA = /(sqlmap|nikto|nmap|masscan|wpscan|dirbuster|gobuster|feroxbuster|nuclei|zgrab|acunetix|nessus|openvas|hydra|w3af|havij|fimap)/i;
const BAD_METHODS = new Set(['TRACE', 'TRACK', 'CONNECT']);

function safeDecode(s) {
  let out = s;
  for (let i = 0; i < 2; i++) {
    try { const d = decodeURIComponent(out.replace(/\+/g, ' ')); if (d === out) break; out = d; }
    catch { break; }
  }
  return out;
}

export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

export function createShield(opts = {}) {
  const cfg = {
    mode: opts.mode || 'block',            // 'block' = 막기, 'monitor' = 기록만
    ratePerMin: opts.ratePerMin ?? 120,     // IP당 분당 요청
    strikesToBan: opts.strikesToBan ?? 3,   // 공격 몇 번이면 잠시 차단할지
    banMinutes: opts.banMinutes ?? 15,      // 차단 시간 (지나면 자동 해제)
    maxUrl: opts.maxUrl ?? 4096,
    allowlist: new Set(opts.allowlist || ['127.0.0.1', '::1']),
    trustProxy: Boolean(opts.trustProxy),
    onEvent: opts.onEvent || (() => {}),
    now: opts.now || (() => Date.now()),
  };
  const hits = new Map();     // ip -> [timestamps]
  const strikes = new Map();  // ip -> count
  const bans = new Map();     // ip -> until(ms)
  const events = [];          // 최근 기록 (최대 500)

  function record(ev) {
    events.push(ev);
    if (events.length > 500) events.shift();
    cfg.onEvent(ev);
  }

  function strike(ip, now) {
    const n = (strikes.get(ip) || 0) + 1;
    strikes.set(ip, n);
    if (n >= cfg.strikesToBan && cfg.mode === 'block') {
      bans.set(ip, now + cfg.banMinutes * 60_000);
      strikes.delete(ip);
      record({ at: new Date(now).toISOString(), ip, action: 'ban', rule: 'strikes', detail: `공격 ${n}번이라 ${cfg.banMinutes}분 차단` });
    }
  }

  // 메모리가 끝없이 늘지 않게 오래된 기록을 치운다.
  function sweep(now) {
    if (hits.size < 10_000 && bans.size < 10_000) return;
    for (const [ip, ts] of hits) if (!ts.length || now - ts[ts.length - 1] > 60_000) hits.delete(ip);
    for (const [ip, until] of bans) if (until <= now) bans.delete(ip);
    if (strikes.size > 10_000) strikes.clear();
  }

  // 요청 하나를 검사한다. { action: 'allow' | 'block', status, rule, detail }
  function inspect(req) {
    const now = cfg.now();
    const ip = clientIp(req, cfg.trustProxy);
    sweep(now);
    if (cfg.allowlist.has(ip)) return { action: 'allow', ip };

    const until = bans.get(ip);
    if (until && until > now) return { action: 'block', status: 403, ip, rule: 'banned', detail: '차단 중인 IP' };
    if (until) bans.delete(ip);

    const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(ip, recent);

    let found = null;
    const rawUrl = String(req.url || '');
    const url = safeDecode(rawUrl);
    const ua = String(req.headers['user-agent'] || '');

    if (recent.length > cfg.ratePerMin) found = { status: 429, rule: 'rate', detail: `1분에 ${recent.length}번 요청` };
    else if (BAD_METHODS.has(String(req.method).toUpperCase())) found = { status: 405, rule: 'method', detail: `${req.method} 메서드` };
    else if (rawUrl.length > cfg.maxUrl) found = { status: 414, rule: 'long_url', detail: '주소가 너무 김' };
    else if (SCANNER_UA.test(ua)) found = { status: 403, rule: 'scanner', detail: '해킹 도구로 보이는 접속' };
    else if (PROBE_RE.test(url)) found = { status: 404, rule: 'probe', detail: '민감한 경로 탐색' };
    else {
      for (const a of ATTACK_RE) {
        if (a.re.test(url) || a.re.test(ua) || a.re.test(String(req.headers.referer || ''))) {
          found = { status: 403, rule: a.id, detail: a.label };
          break;
        }
      }
    }

    if (!found) return { action: 'allow', ip };
    // 너무 잦은 요청은 그 자체로 차단하되 공격 점수는 1분에 한 번만 준다.
    if (found.rule !== 'rate' || recent.length === cfg.ratePerMin + 1) strike(ip, now);
    record({ at: new Date(now).toISOString(), ip, action: cfg.mode === 'block' ? 'block' : 'seen', method: req.method, url: rawUrl.slice(0, 300), ...found });
    return cfg.mode === 'block' ? { action: 'block', ip, ...found } : { action: 'allow', ip, flagged: found };
  }

  function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  // node:http용. 막았으면 true를 돌려주고 응답까지 보낸다.
  function handle(req, res) {
    setSecurityHeaders(res);
    const r = inspect(req);
    if (r.action !== 'block') return false;
    res.writeHead(r.status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(r.status === 429 ? '너무 자주 왔어요. 잠깐 쉬었다 와요 🐾\n' : '보안전문 구공이가 막았어요 🛡️\n');
    return true;
  }

  return {
    inspect,
    handle,
    // Express/Connect 미들웨어로도 쓸 수 있다: app.use(shield.middleware)
    middleware: (req, res, next) => { if (!handle(req, res)) next(); },
    status: () => ({
      mode: cfg.mode,
      bans: [...bans].filter(([, u]) => u > cfg.now()).map(([ip, u]) => ({ ip, until: new Date(u).toISOString() })),
      recent: events.slice(-100),
    }),
    // 사람이 잘못 막힌 IP를 풀어줄 때만 쓴다.
    unban: (ip) => { strikes.delete(ip); return bans.delete(ip); },
  };
}
