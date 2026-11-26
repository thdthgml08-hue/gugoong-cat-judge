#!/usr/bin/env node
// 바이러스 검사: 검증된 오픈소스 백신 엔진 ClamAV를 구공이가 대신 돌리고 결과를 알려 준다.
// 검사만 한다. 파일을 지우거나 옮기거나 고치지 않는다 (--remove, --move, --copy 옵션은 절대 쓰지 않음).
//
// 사용: node src/virus-scan.js <폴더나 파일> [...]   (예: npm run virus -- ~/Downloads)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const FORBIDDEN = /^--(remove|move|copy)/;

export const INSTALL_HELP = `ClamAV 백신 엔진이 없어요. 먼저 설치해 주세요:
  • 맥:      brew install clamav   (그 다음 freshclam 설정은 아래 README 참고)
  • 윈도우:  https://www.clamav.net/downloads 에서 설치 파일 받기
  • 우분투:  sudo apt install clamav && sudo freshclam`;

async function which(bin) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try { const { stdout } = await run(cmd, [bin]); return stdout.split(/\r?\n/)[0].trim() || null; }
  catch { return null; }
}

// 바이러스 정보(서명 DB)가 있는지, 얼마나 오래됐는지 본다.
export async function engineInfo(clamscan, extraArgs = []) {
  const { stdout } = await run(clamscan, ['--version', ...extraArgs]);
  const [, version, dbVersion, dbDate] = stdout.trim().match(/^ClamAV ([^/\s]+)(?:\/(\d+)\/(.+))?/) || [];
  const ageDays = dbDate ? Math.floor((Date.now() - new Date(dbDate).getTime()) / 86_400_000) : null;
  return { version, dbVersion: dbVersion || null, dbDate: dbDate || null, ageDays };
}

// 실제 검사. 결과: { level, infected: [{ file, virus }], scanned, errors }
export async function scan(targets, { db, clamscan } = {}) {
  clamscan = clamscan || (await which('clamscan'));
  if (!clamscan) { const e = new Error(INSTALL_HELP); e.code = 'NO_CLAMAV'; throw e; }
  const args = ['--recursive', '--infected', '--stdout', '--max-filesize=200M', '--max-scansize=400M'];
  if (db) args.push(`--database=${db}`);
  if (args.some((a) => FORBIDDEN.test(a))) throw new Error('검사 전용이라 삭제·이동 옵션은 쓸 수 없어요');
  args.push('--', ...targets);

  let stdout = '';
  let code = 0;
  try { ({ stdout } = await run(clamscan, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60 * 60_000 })); }
  catch (err) {
    stdout = err.stdout || '';
    code = typeof err.code === 'number' ? err.code : 2;
    if (code === 2 && !/Scanned files:/.test(stdout)) throw new Error(`ClamAV가 검사를 못 했어요: ${(err.stderr || err.message).trim().split('\n').pop()}`);
  }

  const infected = [];
  const errors = [];
  for (const line of stdout.split(/\r?\n/)) {
    const hit = line.match(/^(.*): (.+) FOUND$/);
    if (hit) infected.push({ file: hit[1], virus: hit[2] });
    else if (/: .*(ERROR|WARNING)/.test(line) && !line.startsWith('-')) errors.push(line.trim());
  }
  const scanned = Number((stdout.match(/Scanned files: (\d+)/) || [])[1] || 0);
  const level = infected.length ? '위험' : code === 2 ? '주의' : '정상';
  return { level, infected, scanned, errors };
}

// 업로드된 파일 하나 검사 (서버용). 임시 파일은 검사 후 바로 지운다.
export async function scanBuffer(buf, name = 'upload.bin', opts = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gugoong-scan-'));
  const file = path.join(dir, path.basename(name).replace(/[^\w.-]/g, '_') || 'upload.bin');
  try {
    await writeFile(file, buf);
    const r = await scan([file], opts);
    r.infected = r.infected.map((i) => ({ ...i, file: path.basename(name) }));
    return r;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function report(r, info) {
  const out = [];
  if (r.level === '위험') {
    out.push(`【긴급】 바이러스 ${r.infected.length}건 발견. 검사한 파일 ${r.scanned}개.`);
    for (const i of r.infected) out.push(`  - ${i.file}\n    탐지명: ${i.virus}`);
    out.push('', '제안 조치 (직접 확인 후 진행):',
      '  1. 해당 파일을 열거나 실행하지 마세요.',
      '  2. 어디서 받은 파일인지 확인하세요. 모르는 파일이면 삭제를 권합니다.',
      '  3. 이미 실행했다면 Windows Defender·V3 같은 상주 백신으로 전체 검사를 하세요.',
      '구공이는 검사만 했고, 파일을 지우거나 옮기지 않았습니다.');
  } else {
    out.push(r.level === '정상'
      ? `🟢 깨끗해요~ 냥! 파일 ${r.scanned}개를 봤는데 바이러스가 없어요 🐾`
      : `🟡 검사는 끝났는데 읽지 못한 파일이 있어요 (${r.errors.length}건). 권한 문제일 수 있어요 👀`);
    for (const e of r.errors.slice(0, 10)) out.push(`  - ${e}`);
  }
  if (info && (info.ageDays === null || info.ageDays > 7)) {
    out.push('', info.ageDays === null
      ? '⚠️ 바이러스 정보(DB)가 없어요. freshclam으로 먼저 받아 주세요. 지금 결과는 믿을 수 없어요.'
      : `⚠️ 바이러스 정보가 ${info.ageDays}일 전 거예요. freshclam으로 업데이트하면 최신 바이러스도 잡아요.`);
  }
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const argv = process.argv.slice(2);
  const dbIdx = argv.indexOf('--db');
  const db = dbIdx >= 0 ? argv.splice(dbIdx, 2)[1] : undefined;
  const targets = argv.length ? argv : [process.cwd()];
  for (const t of targets) if (!existsSync(t)) { console.error(`없는 경로예요: ${t}`); process.exit(2); }
  try {
    const clamscan = await which('clamscan');
    if (!clamscan) throw Object.assign(new Error(INSTALL_HELP), { code: 'NO_CLAMAV' });
    const info = await engineInfo(clamscan, db ? [`--database=${db}`] : []).catch(() => null);
    if (!db && !info?.dbVersion) {
      throw new Error('바이러스 정보(DB)가 없어서 검사할 수 없어요. 먼저 freshclam을 실행해 주세요 (README 참고).');
    }
    console.log(`🔍 보안전문 구공이가 검사 중이에요... (${targets.join(', ')})`);
    const r = await scan(targets, { db, clamscan });
    console.log(report(r, db ? null : info));
    process.exit(r.infected.length ? 1 : 0);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
