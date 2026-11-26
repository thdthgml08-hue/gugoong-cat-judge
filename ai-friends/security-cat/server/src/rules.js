// 규칙 기반 1차 검사. API 키가 없어도 돌아가고, AI 판정 전에 확실한 것부터 잡는다.
// 이 파일의 함수는 모두 "읽고 판단만" 한다. 아무것도 지우거나 바꾸지 않는다.

export const LEVELS = ['정상', '주의', '위험'];
export const VERDICTS = ['allow', 'review', 'block'];

export function maxLevel(a, b) {
  return LEVELS[Math.max(LEVELS.indexOf(a), LEVELS.indexOf(b))];
}
export function maxVerdict(a, b) {
  return VERDICTS[Math.max(VERDICTS.indexOf(a), VERDICTS.indexOf(b))];
}

// ── 개인정보 ────────────────────────────────────────────────
const PII = [
  { id: 'rrn', label: '주민등록번호', level: '위험', re: /\b\d{6}\s?-\s?[1-4]\d{6}\b/g },
  { id: 'card', label: '카드번호', level: '위험', re: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, check: luhn },
  { id: 'phone', label: '휴대전화번호', level: '주의', re: /\b01[016789][ -.]?\d{3,4}[ -.]?\d{4}\b/g },
  { id: 'email', label: '이메일', level: '주의', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { id: 'account', label: '계좌번호로 보이는 숫자', level: '주의', re: /(?:계좌|입금|송금)[^\d\n]{0,10}(\d{2,6}-\d{2,6}-\d{2,8})/g, group: 1 },
];

function luhn(num) {
  const d = num.replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return d.length >= 13 && sum % 10 === 0;
}

export function mask(value) {
  const s = String(value);
  if (s.length <= 4) return '*'.repeat(s.length);
  return s.slice(0, 2) + '*'.repeat(Math.max(1, s.length - 4)) + s.slice(-2);
}

// ── 욕설·혐오 (최소 목록. 운영하며 data/badwords.txt 등으로 늘리면 된다) ──
const BADWORDS = ['씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '느금', '니애미', '꺼져', 'fuck', 'shit'];
const LOOSE = (w) => new RegExp(w.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.\\-_*0-9]{0,2}'), 'i');
const BADWORD_RES = BADWORDS.map((w) => ({ w, re: LOOSE(w) }));

// ── 프롬프트 인젝션 (AI 친구들을 속이려는 문장) ─────────────────
const INJECTION = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts)/i,
  /disregard (the |your )?(system|previous) (prompt|instructions)/i,
  /you are now (in )?(developer|dan|jailbreak)/i,
  /(이전|위의?|앞의?)\s*(모든\s*)?(지시|명령|프롬프트|규칙)[을를은는]?\s*(무시|잊어)/,
  /(시스템\s*프롬프트|system prompt)[을를]?\s*(보여|알려|출력|reveal|print)/i,
  /너는\s*이제(부터)?\s*.{0,20}(제한|규칙)\s*(이|가)?\s*없/,
  /(관리자|admin)\s*(권한|모드)[을를]?\s*(줘|부여|활성화|켜)/i,
];

// ── 스팸 ──────────────────────────────────────────────────
const SPAM = [
  /(카톡|텔레?그램|텔방|오픈채팅)\s*[:：]?\s*@?[a-z0-9_]{3,}/i,
  /(무료\s*충전|고수익|일당\s*\d+|리딩방|코인\s*추천|대출\s*가능|도박|토토|카지노)/,
  /(bit\.ly|tinyurl\.com|t\.me)\//i,
];

export function checkText(text) {
  const findings = [];
  let level = '정상';
  let masked = String(text);

  for (const p of PII) {
    for (const m of String(text).matchAll(p.re)) {
      const hit = p.group ? m[p.group] : m[0];
      if (p.check && !p.check(hit)) continue;
      findings.push({ category: 'personal_info', rule: p.id, detail: `${p.label}: ${mask(hit)}` });
      level = maxLevel(level, p.level);
      masked = masked.split(hit).join(mask(hit));
    }
  }
  for (const { w, re } of BADWORD_RES) {
    if (re.test(text)) {
      findings.push({ category: 'profanity', rule: 'badword', detail: `욕설/비속어: ${mask(w)}` });
      level = maxLevel(level, '주의');
    }
  }
  for (const re of INJECTION) {
    if (re.test(text)) {
      findings.push({ category: 'prompt_injection', rule: 'injection', detail: 'AI 지시를 무시하게 하려는 문장' });
      level = maxLevel(level, '위험');
    }
  }
  for (const re of SPAM) {
    if (re.test(text)) {
      findings.push({ category: 'spam', rule: 'spam', detail: '광고·유도성 문구' });
      level = maxLevel(level, '주의');
    }
  }
  const verdict = level === '위험' ? 'block' : level === '주의' ? 'review' : 'allow';
  return { level, verdict, findings, masked_text: masked };
}

// ── 보안 로그 ─────────────────────────────────────────────
// 한 줄에 한 이벤트. 흔한 형식(nginx/apache access log, "login failed ... ip=") 위주로 본다.
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/i;
const FAIL_RE = /(login|auth|sign[- ]?in|로그인|인증)[^\n]{0,40}(fail|denied|invalid|incorrect|실패|거부)|\b401\b|Failed password/i;
const OK_RE = /(login|auth|sign[- ]?in|로그인)[^\n]{0,40}(success|ok|accepted|성공)|Accepted password/i;
export const PROBE_RE = /\/(\.env|\.git\/|wp-admin|wp-login|phpmyadmin|\.aws|config\.php|server-status|actuator)/i;
export const ATTACK_RE = [
  { id: 'sqli', label: 'SQL 인젝션 시도', re: /(union(\s|%20|\+)+select|'(\s|%20)*or(\s|%20)*'?1'?=|sleep\(\d|--(\s|%20)*$|information_schema)/i },
  { id: 'xss', label: 'XSS 시도', re: /(<script|%3Cscript|javascript:|onerror=)/i },
  { id: 'traversal', label: '경로 조작 시도', re: /(\.\.\/|\.\.%2f|%2e%2e%2f){2,}|\/etc\/passwd/i },
  { id: 'cmd', label: '명령 실행 시도', re: /(;|%3B|\|)\s*(cat|wget|curl|sh|bash)\s|\$\(|`id`/i },
];

export function analyzeLogs(lines, { failThreshold = 5 } = {}) {
  const failsByIp = new Map();
  const okAfterFail = new Set();
  const findings = [];
  const probesByIp = new Map();

  lines.forEach((line, i) => {
    const ip = (line.match(IP_RE) || [])[0] || 'unknown';
    if (FAIL_RE.test(line)) failsByIp.set(ip, (failsByIp.get(ip) || 0) + 1);
    else if (OK_RE.test(line) && (failsByIp.get(ip) || 0) >= failThreshold) okAfterFail.add(ip);
    if (PROBE_RE.test(line)) probesByIp.set(ip, (probesByIp.get(ip) || 0) + 1);
    for (const a of ATTACK_RE) {
      if (a.re.test(line)) findings.push({ level: '위험', rule: a.id, ip, line: i + 1, detail: a.label });
    }
  });

  for (const [ip, n] of failsByIp) {
    if (okAfterFail.has(ip)) {
      findings.push({ level: '위험', rule: 'bruteforce_success', ip, detail: `로그인 실패 ${n}회 뒤 성공: 계정 탈취 의심` });
    } else if (n >= failThreshold) {
      findings.push({ level: '주의', rule: 'bruteforce', ip, detail: `로그인 실패 ${n}회: 무차별 대입 의심` });
    }
  }
  for (const [ip, n] of probesByIp) {
    findings.push({ level: n >= 3 ? '위험' : '주의', rule: 'probe', ip, detail: `민감 경로 탐색 ${n}회 (.env, wp-admin 등)` });
  }

  const level = findings.reduce((acc, f) => maxLevel(acc, f.level), '정상');
  return { level, findings, stats: { lines: lines.length, ips_with_failures: failsByIp.size } };
}

// ── 코드 속 비밀값 ────────────────────────────────────────
export const SECRET_RULES = [
  { id: 'anthropic_key', label: 'Anthropic API 키', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai_key', label: 'OpenAI API 키', re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/g },
  { id: 'aws_key', label: 'AWS 액세스 키', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github_token', label: 'GitHub 토큰', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { id: 'slack_token', label: 'Slack 토큰', re: /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google_key', label: 'Google API 키', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'private_key', label: '개인 키', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { id: 'jwt', label: 'JWT 토큰', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: 'password_assign', label: '코드에 적힌 비밀번호', re: /\b(password|passwd|pwd|secret|api_?key|token)\s*[:=]\s*["'][^"'\s]{6,}["']/gi },
];
const RISKY_CODE = [
  { id: 'eval', label: 'eval 사용', re: /\beval\s*\(/g },
  { id: 'new_function', label: 'new Function 사용', re: /\bnew\s+Function\s*\(/g },
  { id: 'inner_html_var', label: '변수를 innerHTML에 넣음 (입력값이면 XSS 위험)', re: /\.innerHTML\s*=\s*[^'"`\s;][^;]*/g },
  { id: 'child_process', label: '셸 명령 실행', re: /\bchild_process\b|\bexecSync\s*\(/g },
];

export function scanCode(content) {
  const findings = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const r of SECRET_RULES) {
      for (const m of line.matchAll(r.re)) {
        findings.push({ level: '위험', rule: r.id, line: i + 1, detail: `${r.label}: ${mask(m[0])}` });
      }
    }
    for (const r of RISKY_CODE) {
      if (r.re.test(line)) findings.push({ level: '주의', rule: r.id, line: i + 1, detail: r.label });
      r.re.lastIndex = 0;
    }
  });
  return findings;
}
