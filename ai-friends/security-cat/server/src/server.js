// 보안전문 구공이 서버. 판정과 보고만 한다. 지우기·차단·설정 변경 같은 조치 API는 일부러 없다.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { checkText, analyzeLogs, scanCode, maxLevel, maxVerdict } from './rules.js';
import { aiEnabled, judgeText, judgeImage, judgeLogs, MODEL } from './claude.js';
import { createShield } from './shield.js';

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.GUARD_TOKEN || '';
// 토큰이 없으면 이 컴퓨터 안에서만 받는다.
const HOST = process.env.HOST || (TOKEN ? '0.0.0.0' : '127.0.0.1');
const LIMITS = { text: 20_000, logLines: 2_000, bodyBytes: 8 * 1024 * 1024, imageBytes: 5 * 1024 * 1024 };
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── 공통 ────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function authorized(req) {
  if (!TOKEN) return true;
  const got = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

// 구공이 서버 자신도 지킴이가 지킨다. 검열 API는 남의 서버가 부르는 거라 허용 목록은 비워 둔다.
const shield = createShield({
  ratePerMin: Number(process.env.GUARD_RATE_PER_MIN || 60),
  allowlist: [],
  trustProxy: process.env.GUARD_TRUST_PROXY === '1',
  onEvent: (ev) => console.log(JSON.stringify({ kind: 'shield', ...ev })),
});

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > LIMITS.bodyBytes) throw new HttpError(413, '요청이 너무 커요');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new HttpError(400, 'JSON 형식이 아니에요'); }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body, null, 2));
}

// 원문은 남기지 않고 판정 결과만 남긴다.
function audit(kind, result) {
  console.log(JSON.stringify({ at: new Date().toISOString(), kind, level: result.level, verdict: result.verdict, rules: (result.findings || []).map((f) => f.rule) }));
}

// AI가 실패하면 "통과"가 아니라 "사람 확인"으로 둔다.
async function withAi(fn) {
  if (!aiEnabled()) return { ai: null };
  try {
    const out = await fn();
    if (out.refused) return { ai: { refused: true, category: out.category }, failSafe: true };
    return { ai: out };
  } catch (err) {
    console.error('[ai]', err.status || '', err.message);
    return { ai: { error: 'AI 판정 실패, 규칙 결과만 사용' }, failSafe: true };
  }
}

// ── 핸들러 ───────────────────────────────────────────────
async function moderateText(body) {
  const text = String(body.text ?? '');
  if (!text.trim()) throw new HttpError(400, 'text가 비었어요');
  if (text.length > LIMITS.text) throw new HttpError(413, `text는 ${LIMITS.text}자까지예요`);
  const rule = checkText(text);
  const { ai, failSafe } = await withAi(() => judgeText(rule.masked_text, rule.findings));
  let verdict = rule.verdict;
  let level = rule.level;
  if (ai?.verdict) { verdict = maxVerdict(verdict, ai.verdict); level = maxLevel(level, ai.level); }
  if (failSafe) verdict = maxVerdict(verdict, 'review');
  return { verdict, level, findings: rule.findings, masked_text: rule.masked_text, ai };
}

async function moderateImage(body) {
  const data = String(body.image_base64 ?? '').replace(/^data:[^,]+,/, '');
  const type = String(body.media_type ?? '');
  if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, `media_type은 ${IMAGE_TYPES.join(', ')} 중 하나여야 해요`);
  if (!data) throw new HttpError(400, 'image_base64가 비었어요');
  if (Buffer.byteLength(data, 'base64') > LIMITS.imageBytes) throw new HttpError(413, '이미지는 5MB까지예요');
  const caption = body.caption ? checkText(String(body.caption).slice(0, 2000)) : null;
  if (!aiEnabled()) {
    return { verdict: 'review', level: caption?.level ?? '주의', findings: caption?.findings ?? [], ai: null, note: '이미지는 AI로만 볼 수 있어서, 키가 없으면 사람 확인으로 보내요' };
  }
  const { ai, failSafe } = await withAi(() => judgeImage(data, type, caption?.masked_text));
  let verdict = maxVerdict(caption?.verdict ?? 'allow', ai?.verdict ?? 'allow');
  if (failSafe) verdict = maxVerdict(verdict, 'review');
  const level = maxLevel(caption?.level ?? '정상', ai?.level ?? '정상');
  return { verdict, level, findings: caption?.findings ?? [], ai };
}

async function analyze(body) {
  const lines = (Array.isArray(body.lines) ? body.lines : String(body.text ?? '').split('\n'))
    .map(String).filter((l) => l.trim());
  if (!lines.length) throw new HttpError(400, 'lines 또는 text가 필요해요');
  if (lines.length > LIMITS.logLines) throw new HttpError(413, `로그는 한 번에 ${LIMITS.logLines}줄까지예요`);
  const rule = analyzeLogs(lines);
  const { ai } = await withAi(() => judgeLogs(lines, rule.findings));
  const level = maxLevel(rule.level, ai?.level ?? '정상');
  return {
    level,
    findings: rule.findings,
    stats: rule.stats,
    ai,
    status: level === '정상' ? '이상 없음' : '관리자 확인 필요',
    note: '구공이는 읽기 전용이라 차단·잠금을 실행하지 않았어요. proposed_actions는 승인 후 사람이 실행해 주세요.',
  };
}

function scan(body) {
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) throw new HttpError(400, 'files: [{ path, content }]가 필요해요');
  const findings = [];
  for (const f of files.slice(0, 500)) {
    for (const hit of scanCode(String(f.content ?? '').slice(0, 1_000_000))) findings.push({ path: String(f.path ?? '?'), ...hit });
  }
  const level = findings.reduce((acc, f) => maxLevel(acc, f.level), '정상');
  return { level, findings, files_scanned: Math.min(files.length, 500) };
}

const ROUTES = {
  'POST /v1/moderate/text': moderateText,
  'POST /v1/moderate/image': moderateImage,
  'POST /v1/analyze/logs': analyze,
  'POST /v1/scan/code': scan,
};

export const server = http.createServer(async (req, res) => {
  if (shield.handle(req, res)) return;
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, name: '보안전문 구공이', ai: aiEnabled() ? MODEL : 'off (규칙만 사용)' });
    }
    const handler = ROUTES[`${req.method} ${url.pathname}`];
    if (!handler) throw new HttpError(404, '그런 길은 없어요 냥');
    if (!authorized(req)) throw new HttpError(401, '토큰이 필요해요');
    const result = await handler(await readJson(req));
    audit(url.pathname, result);
    send(res, 200, result);
  } catch (err) {
    const status = err.status && err.status < 500 && err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: status === 500 ? '서버 오류' : err.message });
  }
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT, HOST, () => {
    console.log(`🛡️ 보안전문 구공이 출근! http://${HOST}:${PORT}  (AI: ${aiEnabled() ? MODEL : '꺼짐, 규칙만 사용'})`);
    if (!TOKEN) console.log('   GUARD_TOKEN이 없어서 이 컴퓨터(127.0.0.1)에서만 받아요.');
  });
}
