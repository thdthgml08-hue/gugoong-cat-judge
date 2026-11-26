// ClamAV가 설치된 곳에서만 돈다. EICAR는 모든 백신이 "시험용 바이러스"로 잡는 무해한 문자열이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { scan, scanBuffer } from '../src/virus-scan.js';

let hasClam = true;
try { execFileSync('clamscan', ['--version']); } catch { hasClam = false; }

// 저장소에 EICAR 파일을 두지 않으려고 실행할 때 조립한다.
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

function setup() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'gugoong-test-'));
  const md5 = createHash('md5').update(EICAR).digest('hex');
  const db = path.join(dir, 'db');
  execFileSync('mkdir', ['-p', db]);
  writeFileSync(path.join(db, 'test.hdb'), `${md5}:${EICAR.length}:Gugoong.Test.EICAR\n`);
  const files = path.join(dir, 'files');
  execFileSync('mkdir', ['-p', path.join(files, 'sub')]);
  writeFileSync(path.join(files, 'cat.txt'), '구공이는 귀엽다');
  writeFileSync(path.join(files, 'sub', 'eicar.com'), EICAR);
  return { db, files };
}

test('바이러스를 찾고, 파일은 그대로 둔다', { skip: !hasClam && 'ClamAV 없음' }, async () => {
  const { db, files } = setup();
  const r = await scan([files], { db });
  assert.equal(r.level, '위험');
  assert.equal(r.infected.length, 1);
  assert.match(r.infected[0].file, /eicar\.com$/);
  assert.match(r.infected[0].virus, /Gugoong\.Test\.EICAR/);
  assert.ok(existsSync(path.join(files, 'sub', 'eicar.com')), '검사만 해야 하므로 파일이 남아 있어야 함');
});

test('깨끗한 폴더는 정상', { skip: !hasClam && 'ClamAV 없음' }, async () => {
  const { db, files } = setup();
  const r = await scan([path.join(files, 'cat.txt')], { db });
  assert.equal(r.level, '정상');
  assert.equal(r.infected.length, 0);
});

test('업로드 파일 검사 후 임시 파일은 지운다', { skip: !hasClam && 'ClamAV 없음' }, async () => {
  const { db } = setup();
  const r = await scanBuffer(Buffer.from(EICAR), '../../evil.exe', { db });
  assert.equal(r.level, '위험');
  assert.equal(r.infected[0].file, 'evil.exe');
});
