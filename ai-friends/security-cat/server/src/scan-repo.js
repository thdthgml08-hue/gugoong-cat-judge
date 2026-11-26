#!/usr/bin/env node
// 레포 점검 CLI. 파일을 읽기만 하고 아무것도 고치지 않는다.
// 사용: node src/scan-repo.js [폴더]   (기본: 레포 최상위)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCode } from './rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..', '..', '..', '..'));
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
const SKIP_FILES = new Set(['rules.js', 'rules.test.js']); // 탐지 규칙 자체는 건너뛴다
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|json|html|css|md|txt|yml|yaml|env|sh|py|toml|ini|cfg|conf)$|^\.env/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) yield* walk(p); }
    else if (TEXT_EXT.test(name) && !SKIP_FILES.has(name) && st.size < 2_000_000) yield p;
  }
}

const findings = [];
let count = 0;
for (const file of walk(root)) {
  count++;
  const rel = path.relative(root, file);
  if (/^\.env/.test(path.basename(file)) && !/\.example$/.test(file)) {
    findings.push({ level: '위험', path: rel, line: 0, rule: 'env_file', detail: '.env 파일이 레포 안에 있어요 (.gitignore 확인)' });
  }
  for (const f of scanCode(readFileSync(file, 'utf8'))) findings.push({ path: rel, ...f });
}

const danger = findings.filter((f) => f.level === '위험');
const level = danger.length ? '위험' : findings.length ? '주의' : '정상';
const icon = { 정상: '🟢', 주의: '🟡', 위험: '🔴' }[level];
console.log(level === '위험' ? `【긴급】 레포 점검 결과: 위험 (${danger.length}건)` : `${icon} 레포 점검 결과: ${level} — 파일 ${count}개 확인`);
for (const f of findings) console.log(`  [${f.level}] ${f.path}:${f.line}  ${f.detail}`);
if (!findings.length) console.log('  비밀키나 위험한 패턴을 찾지 못했어요 냥 🐾');
console.log('구공이는 읽기만 했고, 아무것도 고치지 않았어요.');
process.exit(danger.length ? 1 : 0);
