/* 구공이 3D — 공용 그래픽 유틸 (재질 · 캔버스 텍스처 · 점박이 칠하기) */
import * as THREE from 'three';

export const COL = {
  cream: 0xf7e7c8,
  creamLight: 0xfff6e4,
  patch: 0xd9a86f,
  patch2: 0xc08a52,
  brown: 0x6d4a30,
  brownDark: 0x4d3320,
  wood: 0xb07a4d,
  woodDark: 0x7d4f2f,
  wall: 0xf3e4cc,
  wallWarm: 0xefdcc0,
  terracotta: 0xc9704f,
  gold: 0xe8b45a,
  green: 0x6f9270,
  greenDark: 0x4e7052,
  sky: 0x9fd0e8,
  ink: 0x3b2a1e,
  white: 0xfffaf0,
  pink: 0xe4a2a2,
  red: 0xb1544c,
  blue: 0x6f8fb5,
  gray: 0x9a938a,
  asphalt: 0x8f8579,
};

const matCache = new Map();

/** 단색 스탠다드 재질 (같은 색은 재사용) */
export function std(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    ...opts,
  });
  if (!opts.unique) matCache.set(key, m);
  return m;
}

/** 그림자 받는 단순 박스 */
export function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.rotX) m.rotation.x = opts.rotX;
  if (opts.rotY) m.rotation.y = opts.rotY;
  if (opts.rotZ) m.rotation.z = opts.rotZ;
  return m;
}

export function sphere(r, mat, x = 0, y = 0, z = 0, seg = 16, opts = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7)), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  return m;
}

export function cyl(rTop, rBot, h, mat, x = 0, y = 0, z = 0, seg = 16, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

/** 캔버스에 그려 텍스처로 */
export function canvasTexture(w, h, draw, opts = {}) {
  const { repeatX = 1, repeatY = 1, repeat = true, srgb = true } = opts;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  // 브라우저가 화면 밖 캔버스의 메모리를 비우면 텍스처가 검게 변한다.
  // 이미지로 한 번 구워 두면 그런 일이 없고, 상하 반전도 정상으로 처리된다.
  try {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = cv.toDataURL('image/png');
  } catch (e) {
    /* 변환 실패 시 캔버스 그대로 */
  }
  return tex;
}

const FONT = "'Galmuri11', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

/* ───────────── 바닥 · 러그 ───────────── */

export function woodTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#c59364';
    c.fillRect(0, 0, w, h);
    const n = 4;
    const ph = h / n;
    for (let i = 0; i < n; i++) {
      const y = i * ph;
      const g = c.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, i % 2 ? '#cb9a6a' : '#c1915f');
      g.addColorStop(0.45, '#bc8a58');
      g.addColorStop(1, '#b07f4e');
      c.fillStyle = g;
      c.fillRect(0, y, w, ph - 3);
      // 나뭇결
      for (let k = 0; k < 14; k++) {
        const yy = y + 6 + Math.random() * (ph - 14);
        c.strokeStyle = `rgba(110,70,38,${0.05 + Math.random() * 0.09})`;
        c.lineWidth = 1 + Math.random() * 2;
        c.beginPath();
        c.moveTo(0, yy);
        c.bezierCurveTo(w * 0.3, yy + 3, w * 0.6, yy - 3, w, yy + 1);
        c.stroke();
      }
      // 이음매
      c.fillStyle = 'rgba(80,50,28,0.4)';
      c.fillRect(0, y + ph - 3, w, 3);
      c.fillStyle = 'rgba(80,50,28,0.28)';
      c.fillRect(((i % 2 ? 0.32 : 0.68) * w) | 0, y, 3, ph - 3);
    }
  }, { repeatX: 8, repeatY: 8 });
}

export function cobbleTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#b9ab97';
    c.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 8;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const off = (y % 2) * cw * 0.5;
        const px = x * cw + off - cw * 0.5;
        const py = y * ch;
        const v = 0.86 + Math.random() * 0.14;
        const rr = Math.round(168 * v);
        const gg = Math.round(156 * v);
        const bb = Math.round(139 * v);
        c.fillStyle = `rgb(${rr},${gg},${bb})`;
        c.beginPath();
        const rad = 16;
        const x0 = px + 4;
        const y0 = py + 4;
        const x1 = px + cw - 4;
        const y1 = py + ch - 4;
        c.moveTo(x0 + rad, y0);
        c.arcTo(x1, y0, x1, y1, rad);
        c.arcTo(x1, y1, x0, y1, rad);
        c.arcTo(x0, y1, x0, y0, rad);
        c.arcTo(x0, y0, x1, y0, rad);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(90,78,62,0.18)';
        c.lineWidth = 2;
        c.stroke();
      }
    }
  }, { repeatX: 2, repeatY: 10 });
}

export function asphaltTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#9c948a';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random();
      c.fillStyle = v > 0.5 ? 'rgba(255,246,228,0.10)' : 'rgba(70,62,54,0.10)';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 22; i++) {
      c.strokeStyle = 'rgba(80,72,64,0.10)';
      c.lineWidth = 1;
      c.beginPath();
      const x = Math.random() * w;
      const y = Math.random() * h;
      c.moveTo(x, y);
      c.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
      c.stroke();
    }
  }, { repeatX: 6, repeatY: 6 });
}

export function rugTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#f2e1c2';
    c.fillRect(0, 0, w, h);
    // 테두리
    c.strokeStyle = '#c9704f';
    c.lineWidth = 30;
    c.strokeRect(24, 24, w - 48, h - 48);
    c.strokeStyle = '#e3b489';
    c.lineWidth = 10;
    c.strokeRect(58, 58, w - 116, h - 116);
    // 가운데 발도장 + 90
    c.fillStyle = 'rgba(169,111,66,0.75)';
    paw(c, w * 0.5, h * 0.42, 46, 0);
    paw(c, w * 0.26, h * 0.7, 26, -0.5);
    paw(c, w * 0.74, h * 0.7, 26, 0.5);
    c.fillStyle = '#b98a5a';
    c.font = `700 86px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('90', w * 0.5, h * 0.72);
  }, { repeat: false });
}

function paw(c, x, y, r, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.ellipse(0, r * 0.18, r * 0.52, r * 0.44, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.ellipse(i * r * 0.3, -r * 0.34 - Math.abs(i) * -r * 0.06, r * 0.16, r * 0.2, i * 0.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/* ───────────── 캐릭터 관련 텍스처 ───────────── */

/** 90 팻말 앞·뒷면 */
export function signTexture(flip = false) {
  return canvasTexture(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.save();
    if (flip) {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    c.translate(w / 2, h / 2);
    // 나무 테두리
    c.fillStyle = '#a9703f';
    c.beginPath();
    c.arc(0, 0, 246, 0, Math.PI * 2);
    c.fill();
    // 안쪽 크림 판
    c.fillStyle = '#f8ebd2';
    c.beginPath();
    c.arc(0, 0, 224, 0, Math.PI * 2);
    c.fill();
    // 이중 링
    c.strokeStyle = '#b57a4a';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(0, 0, 196, 0, Math.PI * 2);
    c.stroke();
    // 90
    c.fillStyle = '#7b4a27';
    c.font = `700 236px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('90', 0, 6);
    // 작은 발도장
    c.fillStyle = 'rgba(160,110,66,0.5)';
    paw(c, 0, 156, 30, 0);
    // 나뭇결
    c.strokeStyle = 'rgba(120,76,38,0.18)';
    c.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(0, 0, 210 + i * 5, 0.2 + i * 0.5, 0.9 + i * 0.5);
      c.stroke();
    }
    c.restore();
  }, { repeat: false });
}

/** 머리 위 90점 말풍선 */
export function popupTexture() {
  return canvasTexture(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const x = 16;
    const y = 12;
    const bw = w - 32;
    const bh = 176;
    const r = 54;
    c.fillStyle = 'rgba(255,250,240,0.98)';
    c.strokeStyle = '#7b4a27';
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + bw, y, x + bw, y + bh, r);
    c.arcTo(x + bw, y + bh, x, y + bh, r);
    c.arcTo(x, y + bh, x, y, r);
    c.arcTo(x, y, x + bw, y, r);
    c.closePath();
    c.fill();
    c.stroke();
    // 꼬리
    c.beginPath();
    c.moveTo(w / 2 - 34, y + bh - 6);
    c.lineTo(w / 2, h - 16);
    c.lineTo(w / 2 + 34, y + bh - 6);
    c.closePath();
    c.fillStyle = 'rgba(255,250,240,0.98)';
    c.fill();
    c.strokeStyle = '#7b4a27';
    c.lineWidth = 12;
    c.stroke();

    c.fillStyle = '#7b4a27';
    c.font = `700 118px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('90점', w / 2, 78);
    c.fillStyle = '#c9704f';
    c.font = `700 34px ${FONT}`;
    c.fillText('구공이 채점', w / 2, 148);
  }, { repeat: false });
}

/** 채점 끝난 NPC 머리 위 작은 배지 */
export function badgeTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f8ebd2';
    c.strokeStyle = '#a9703f';
    c.lineWidth = 12;
    c.beginPath();
    c.arc(w / 2, h / 2, 108, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#7b4a27';
    c.font = `700 104px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('90', w / 2, h / 2 + 4);
    // 체크
    c.fillStyle = '#5f8a68';
    c.beginPath();
    c.arc(w * 0.78, h * 0.24, 34, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(w * 0.78 - 15, h * 0.24 + 1);
    c.lineTo(w * 0.78 - 4, h * 0.24 + 13);
    c.lineTo(w * 0.78 + 15, h * 0.24 - 11);
    c.stroke();
  }, { repeat: false });
}

/** NPC 이름표 */
export function nameTexture(text, sub = '') {
  return canvasTexture(512, 176, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const r = 40;
    c.fillStyle = 'rgba(255,250,240,0.94)';
    c.strokeStyle = 'rgba(123,74,39,0.9)';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(20 + r, 16);
    c.arcTo(w - 20, 16, w - 20, h - 16, r);
    c.arcTo(w - 20, h - 16, 20, h - 16, r);
    c.arcTo(20, h - 16, 20, 16, r);
    c.arcTo(20, 16, w - 20, 16, r);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#5a3720';
    c.font = `700 ${sub ? 54 : 62}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, w / 2, sub ? 66 : h / 2);
    if (sub) {
      c.fillStyle = '#b07a4d';
      c.font = `400 34px ${FONT}`;
      c.fillText(sub, w / 2, 122);
    }
  }, { repeat: false });
}

/** 바닥 발도장 데칼 */
export function pawTexture(color = '#8a6242') {
  return canvasTexture(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = color;
    paw(c, w / 2, h * 0.56, 34, 0);
  }, { repeat: false });
}

/** 분필 90 낙서 */
export function chalkTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,250,240,0.8)';
    c.lineWidth = 16;
    c.lineCap = 'round';
    c.font = `700 300px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeText('90', w / 2, h / 2);
    c.strokeStyle = 'rgba(255,250,240,0.5)';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(w / 2, h / 2, 210, 0, Math.PI * 2);
    c.stroke();
  }, { repeat: false });
}

/** 창밖 하늘 */
export function skyWindowTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8fc4e6');
    g.addColorStop(0.55, '#cfe4ee');
    g.addColorStop(0.78, '#ffe0bb');
    g.addColorStop(1, '#f6c99f');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // 구름
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, s] of [[40, 60, 1], [150, 40, 0.7], [200, 90, 0.9]]) {
      c.beginPath();
      c.ellipse(x, y, 34 * s, 14 * s, 0, 0, Math.PI * 2);
      c.ellipse(x + 22 * s, y - 6 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 먼 지붕 실루엣
    c.fillStyle = 'rgba(190,150,120,0.65)';
    c.beginPath();
    c.moveTo(0, h);
    for (let x = 0; x <= w; x += 32) {
      const y = h - 30 - Math.abs(Math.sin(x * 0.05)) * 22;
      c.lineTo(x, y);
    }
    c.lineTo(w, h);
    c.fill();
  }, { repeat: false });
}

/* ───────────── 점박이 털 칠하기 ───────────── */

/**
 * 구(球) 지오메트리 정점에 얼룩 색을 칠한다.
 * spots: [{ x, y, z, rx, ry, rz, color }] (단위 구 좌표계)
 */
export function paintSpots(geom, base, spots) {
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const bc = new THREE.Color(base);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let col = bc;
    for (const s of spots) {
      const dx = (x - s.x) / s.rx;
      const dy = (y - s.y) / s.ry;
      const dz = (z - s.z) / s.rz;
      if (dx * dx + dy * dy + dz * dz < 1) {
        col = s._c || (s._c = new THREE.Color(s.color));
        break;
      }
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

/** 부드러운 원형 그림자 (발밑) */
export function blobShadowTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(60,40,24,0.55)');
    g.addColorStop(0.6, 'rgba(60,40,24,0.25)');
    g.addColorStop(1, 'rgba(60,40,24,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }, { repeat: false });
}
