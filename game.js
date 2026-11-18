/* 구공이 90점 채점소 — v2 사이드뷰 엔진
   집 안 → 골목, 직접 걸어가 관찰하고 머리 위에 점수를 띄운다. */

(() => {
  'use strict';

  /* ─────────────── 도우미 ─────────────── */
  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (n) => Math.floor(Math.random() * n);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const store = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 사생활 모드 */ }
    }
  };

  /* ─────────────── 소리 ─────────────── */
  const Sound = (() => {
    let actx = null;
    let on = store.get('gugoong.sound', true) !== false;

    function ac() {
      if (!actx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        actx = new C();
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    }

    function tone(opt) {
      if (!on) return;
      const a = ac(); if (!a) return;
      const { freq = 440, dur = 0.15, type = 'square', vol = 0.05, slide = 0, delay = 0 } = opt;
      const t0 = a.currentTime + delay;
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    function noise(dur = 0.12, vol = 0.05, fc = 1400) {
      if (!on) return;
      const a = ac(); if (!a) return;
      const len = Math.floor(a.sampleRate * dur);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource();
      src.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fc;
      const g = a.createGain();
      g.gain.value = vol;
      src.connect(bp).connect(g).connect(a.destination);
      src.start();
    }

    let stepAt = 0;
    return {
      isOn: () => on,
      set(v) { on = !!v; store.set('gugoong.sound', on); },
      tap() { tone({ freq: 540, dur: 0.05, type: 'square', vol: 0.025 }); },
      step(now) {
        if (now - stepAt < 260) return;
        stepAt = now;
        noise(0.05, 0.03, 900);
      },
      sniff() { noise(0.14, 0.05, 1600); tone({ freq: 300, dur: 0.08, type: 'sine', vol: 0.02, slide: 120 }); },
      slap() { tone({ freq: 160, dur: 0.1, type: 'square', vol: 0.08, slide: -60 }); noise(0.05, 0.04, 700); },
      ok() { [660, 880, 1175].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.055, delay: i * 0.065 })); },
      ng() { tone({ freq: 220, dur: 0.16, type: 'sawtooth', vol: 0.045, slide: -80 }); tone({ freq: 150, dur: 0.2, type: 'square', vol: 0.035, delay: 0.11 }); },
      miss() { tone({ freq: 320, dur: 0.32, type: 'sine', vol: 0.045, slide: -190 }); },
      meow() {
        tone({ freq: 620, dur: 0.11, type: 'triangle', vol: 0.06, slide: 260 });
        tone({ freq: 900, dur: 0.17, type: 'triangle', vol: 0.045, slide: -320, delay: 0.1 });
      },
      door() { noise(0.25, 0.05, 500); tone({ freq: 180, dur: 0.2, type: 'sine', vol: 0.03, slide: -60 }); },
      win() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.17, type: 'triangle', vol: 0.05, delay: i * 0.1 })); }
    };
  })();

  /* ─────────────── 이미지 ─────────────── */
  const SPRITE_H = 76;      // 사람 스프라이트 높이 (논리 픽셀 · 무대 135의 56%)
  const CAT_H = 34;         // 구공이(팻말 포함) 높이 — 사람 허리 아래, 고양이 비율
  const ZOOM = 1.45;        // 배경 확대 배율 (바닥선 고정) — 사람이 커진 만큼 방·골목도 당겨 본다
  const humanH = (scale) => SPRITE_H * (scale || 1);

  const IMG = {
    cat: null,          // 원본 — 왼쪽을 보는 모습
    catRight: null,     // 반전본 — 오른쪽을 보는 모습('90' 글자는 바로 서게 다듬음)
    people: {}
  };

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  /* ─────────────── 무대 ─────────────── */
  const VIEW_W = 240, VIEW_H = 135;
  const FLOOR_IN = 118, FLOOR_OUT = 120;
  const WORLD = { in: 470, out: 600 };
  const SPOTS = { in: [96, 214, 318, 404], out: [110, 250, 390, 520] };

  const Scene = (() => {
    const cv = $('#scene');
    const ctx = cv.getContext('2d');
    let scale = 1;          // 논리 픽셀 → 캔버스 장치 픽셀
    let lastFit = 0;

    /* 무대 크기 × devicePixelRatio 로 캔버스 내부 해상도를 맞춘다.
       논리 좌표계(240×135)는 그대로 두고 그리기 행렬만 확대해, 레티나 화면에서도
       배경과 캐릭터가 뭉개지지 않게 그린다. */
    function fitCanvas(now) {
      if (now && now - lastFit < 400) return;   // 레이아웃 측정은 가끔만
      lastFit = now || 0;
      const rect = cv.getBoundingClientRect();
      const cssW = rect.width;
      if (!cssW) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const target = Math.max(1, Math.round(cssW * dpr));
      if (cv.width === target) return;
      scale = target / VIEW_W;
      cv.width = target;
      cv.height = Math.round(VIEW_H * scale);
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    }

    let mode = 'in';
    let theme = DAYS[0].theme;
    let world = null;

    const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };

    function shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      const r = clamp(((n >> 16) & 255) + amt, 0, 255);
      const g = clamp(((n >> 8) & 255) + amt, 0, 255);
      const b = clamp((n & 255) + amt, 0, 255);
      return `rgb(${r},${g},${b})`;
    }

    function circle(cx, cy, r, color) {
      ctx.fillStyle = color;
      for (let dy = -r; dy <= r; dy++) {
        const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
        ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
      }
    }

    /* ── 방 안 ── */
    function buildInterior(seed) {
      const r = mulberry32(seed);
      const far = [];
      let x = -6;
      while (x < WORLD.in + 20) {
        const w = 18 + Math.round(r() * 16);
        far.push({ x, w, h: 24 + Math.round(r() * 30), tone: Math.round(r() * 2) });
        x += w + 2;
      }
      const dust = [];
      for (let i = 0; i < 26; i++) {
        dust.push({ x: r() * WORLD.in, y: 26 + r() * 76, s: 0.4 + r() });
      }
      return { far, dust };
    }

    function drawInterior(cam, t) {
      const wallTop = '#f2e0c4', wallStripe = '#f6e8d0';
      ctx.fillStyle = wallTop;
      ctx.fillRect(0, 0, VIEW_W, 104);

      // 벽지 줄무늬
      const stripeOffset = -(cam % 16);
      for (let x = stripeOffset; x < VIEW_W; x += 16) {
        P(x, 0, 2, 96, wallStripe);
      }
      // 벽지 꽃무늬
      for (let wx = Math.floor(cam / 24) * 24; wx < cam + VIEW_W + 24; wx += 24) {
        const sx = wx - cam;
        P(sx, 22, 2, 2, 'rgba(190,150,110,.35)');
        P(sx + 1, 46, 2, 2, 'rgba(190,150,110,.28)');
        P(sx + 5, 70, 2, 2, 'rgba(190,150,110,.28)');
      }

      // 창문 (세계 좌표 x 34..116)
      const wx = 34 - cam;
      if (wx < VIEW_W && wx + 84 > 0) {
        P(wx - 4, 22, 92, 70, '#c9a273');
        const g = ctx.createLinearGradient(0, 26, 0, 86);
        g.addColorStop(0, theme.skyTop);
        g.addColorStop(1, theme.skyBottom);
        ctx.fillStyle = g;
        ctx.fillRect(wx, 26, 84, 60);
        // 창밖
        circle(wx + 62, 42, 5, theme.sun);
        P(wx + 8, 66, 30, 12, 'rgba(255,250,235,.35)');
        P(wx + 40, 60, 26, 18, 'rgba(255,250,235,.25)');
        // 창틀
        P(wx + 40, 26, 3, 60, '#c9a273');
        P(wx, 54, 84, 3, '#c9a273');
        P(wx - 2, 24, 88, 2, '#e0be93');
        // 커튼
        P(wx - 10, 20, 12, 68, '#d8a08a');
        P(wx - 10, 20, 12, 3, '#c2886f');
        P(wx + 82, 20, 12, 68, '#d8a08a');
        P(wx + 82, 20, 12, 3, '#c2886f');
        // 창턱 화분
        P(wx + 6, 84, 10, 6, '#b8763f');
        P(wx + 8, 78, 2, 7, '#4f7a4a');
        P(wx + 5, 80, 4, 2, '#5f8a55');
        P(wx + 11, 77, 4, 2, '#6c9a5e');
      }

      // 걸린 그림
      const p1 = 130 - cam;
      P(p1, 34, 26, 20, '#8a6a4a');
      P(p1 + 2, 36, 22, 16, '#e8d3ae');
      P(p1 + 6, 40, 8, 8, '#9c8b6a');
      const p2 = 236 - cam;
      P(p2, 30, 20, 26, '#8a6a4a');
      P(p2 + 2, 32, 16, 22, '#dfe7d8');

      // 벽 하단 몰딩
      P(0, 96, VIEW_W, 3, '#d3b38a');
      P(0, 99, VIEW_W, 5, '#bf9a6e');
      P(0, 103, VIEW_W, 1, 'rgba(90,60,35,.22)');

      // 바닥
      P(0, 104, VIEW_W, 31, '#c89a68');
      for (let wx2 = Math.floor(cam / 22) * 22; wx2 < cam + VIEW_W + 22; wx2 += 22) {
        P(wx2 - cam, 104, 1, 31, 'rgba(120,80,45,.12)');
      }
      for (let y = 112; y < 135; y += 9) P(0, y, VIEW_W, 1, 'rgba(120,80,45,.08)');

      // 러그
      const rx = 150 - cam;
      P(rx, 108, 130, 22, '#c98a7a');
      P(rx + 5, 111, 120, 16, '#e6bda9');
      P(rx + 14, 114, 102, 10, '#c98a7a');

      // 소파
      const sx = 262 - cam;
      P(sx, 74, 74, 34, '#7d9c8a');
      P(sx + 4, 78, 66, 18, '#8fae9a');
      P(sx, 100, 74, 12, '#6b8a78');
      P(sx - 4, 78, 6, 30, '#6b8a78');
      P(sx + 72, 78, 6, 30, '#6b8a78');
      P(sx + 8, 92, 26, 8, '#a9c4b2');
      P(sx + 40, 92, 26, 8, '#a9c4b2');

      // 탁자
      const tx = 186 - cam;
      P(tx, 100, 44, 5, '#a9743f');
      P(tx + 3, 105, 4, 12, '#8a5c30');
      P(tx + 37, 105, 4, 12, '#8a5c30');
      P(tx + 12, 96, 6, 5, '#e8d6b4');
      P(tx + 14, 94, 3, 3, '#d9c39c');

      // 캣타워
      const cx2 = 350 - cam;
      P(cx2, 58, 26, 60, '#c9b48f');
      P(cx2 - 4, 112, 34, 6, '#b09a75');
      P(cx2 + 2, 92, 22, 6, '#b09a75');
      P(cx2 + 4, 84, 6, 10, '#a89070');
      P(cx2 + 18, 74, 6, 10, '#a89070');
      P(cx2 + 3, 52, 20, 7, '#d9c8a5');

      // 책장
      const bx = 392 - cam;
      P(bx, 62, 34, 56, '#96683c');
      for (let i = 0; i < 3; i++) {
        P(bx + 2, 66 + i * 17, 30, 14, '#7c5330');
        for (let j = 0; j < 6; j++) {
          P(bx + 4 + j * 5, 68 + i * 17, 3, 10, ['#b1544c', '#5f8a86', '#c99b5a', '#8a7bb5'][(i + j) % 4]);
        }
      }

      // 문 (골목으로 나가는 문)
      const dx = 432 - cam;
      P(dx, 56, 38, 62, '#9a6b3c');
      P(dx + 3, 60, 32, 58, '#b07f4a');
      P(dx + 6, 64, 26, 22, '#8a5c30');
      P(dx + 8, 66, 22, 18, '#c79a63');
      P(dx + 30, 90, 3, 3, '#f0d79a');
      P(0, 0, 0, 0, '#000');

      // 먼지 (빛줄기 속)
      for (const d of world.dust) {
        const x = d.x - cam * 0.9;
        if (x < -4 || x > VIEW_W + 4) continue;
        const y = d.y + Math.sin(t * 0.0006 + d.x) * 3;
        P(x, y, 1, 1, 'rgba(255,255,255,.45)');
      }

      // 햇빛
      ctx.fillStyle = 'rgba(255,236,190,0.16)';
      ctx.beginPath();
      ctx.moveTo(wx + 10, 26);
      ctx.lineTo(wx + 60, 26);
      ctx.lineTo(wx + 120, 135);
      ctx.lineTo(wx + 20, 135);
      ctx.closePath();
      ctx.fill();
    }

    /* ── 골목 ── */
    function buildAlley(seed) {
      const r = mulberry32(seed);
      const far = [];
      let x = -6;
      while (x < WORLD.out + 30) {
        const w = 16 + Math.round(r() * 16);
        far.push({ x, w, h: 20 + Math.round(r() * 30), tone: Math.round(r() * 2) });
        x += w + 2;
      }
      const near = [];
      x = -10;
      while (x < WORLD.out + 39) {
        const w = 26 + Math.round(r() * 20);
        near.push({
          x, w, h: 26 + Math.round(r() * 14),
          awning: r() > 0.45,
          awningColor: ['#c96f5a', '#5f8a86', '#c99b5a', '#8a7bb5'][Math.round(r() * 3)],
          door: r() > 0.3,
          sign: r() > 0.55
        });
        x += w + 2;
      }
      const clouds = [];
      for (let i = 0; i < 5; i++) clouds.push({ x: r() * 300, y: 8 + r() * 26, s: 0.8 + r() * 0.8, v: 1.2 + r() * 1.6 });
      const speckles = [];
      for (let i = 0; i < 150; i++) {
        const y = 96 + Math.floor(r() * 26);
        speckles.push({ x: Math.floor(r() * (WORLD.out + 40)), y, w: (y - 96) / 26 > 0.5 ? 2 : 1, c: r() > 0.5 ? 'rgba(120,95,65,.13)' : 'rgba(255,250,235,.30)' });
      }
      return { far, near, clouds, speckles };
    }

    function drawAlley(cam, t) {
      const g = ctx.createLinearGradient(0, 0, 0, 70);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(1, theme.skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, 76);

      circle(theme.sunX + 10, theme.sunY, 7, theme.sun);

      for (const c of world.clouds) {
        c.x -= c.v * 0.03;
        if (c.x < -34) c.x = WORLD.out;
        const sx = c.x - cam * 0.2;
        if (sx < -34 || sx > VIEW_W + 10) continue;
        ctx.fillStyle = 'rgba(255,252,244,0.85)';
        P(sx, c.y, 14 * c.s, 4 * c.s, 'rgba(255,252,244,.85)');
        P(sx + 3, c.y - 3, 8 * c.s, 4 * c.s, 'rgba(255,252,244,.85)');
        P(sx + 8, c.y - 1, 6 * c.s, 3 * c.s, 'rgba(255,252,244,.85)');
      }

      // 먼 건물
      for (const b of world.far) {
        const sx = b.x - cam * 0.38;
        if (sx + b.w < -4 || sx > VIEW_W + 4) continue;
        const top = 76 - b.h;
        const tone = [shade(theme.far, 6), shade(theme.far, -4), shade(theme.far, 14)][b.tone % 3];
        P(sx, top, b.w, b.h, tone);
        P(sx, top, b.w, 2, shade(tone, 13));
        const cols = Math.max(1, Math.floor((b.w - 4) / 6));
        const rows = Math.max(1, Math.floor((b.h - 8) / 7));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const lit = theme.skyTop === '#6b5a86' && ((i * 7 + j * 3 + b.x) % 5 < 2);
            P(sx + 3 + i * 6, top + 5 + j * 7, 3, 3, lit ? '#ffd98a' : shade(tone, -14));
          }
        }
      }
      ctx.fillStyle = 'rgba(255,246,232,0.12)';
      ctx.fillRect(0, 0, VIEW_W, 80);

      // 가까운 상가
      for (const b of world.near) {
        const sx = b.x - cam * 0.72;
        if (sx + b.w < -6 || sx > VIEW_W + 6) continue;
        const base = 88;
        const top = base - b.h;
        P(sx, top, b.w, b.h, theme.wall);
        P(sx - 1, top - 1, b.w + 2, 3, theme.roof);
        P(sx - 1, top + 2, b.w + 2, 2, 'rgba(58,38,24,.10)');
        if (b.awning) {
          for (let i = 0; i < b.w - 2; i += 4) {
            P(sx + 1 + i, top + 4, 2, 5, b.awningColor);
            P(sx + 3 + i, top + 4, 2, 5, '#f3e6cd');
          }
        }
        if (b.sign) {
          P(sx + 4, top + 11, Math.min(b.w - 12, 14), 6, shade(b.awningColor, -6));
          P(sx + 6, top + 13, 3, 2, '#f8efdb');
          P(sx + 11, top + 13, 4, 2, '#f8efdb');
        }
        if (b.w > 28) {
          const wx = sx + 3, wy = base - 20, ww = Math.min(b.w - 18, 14);
          P(wx - 1, wy - 1, ww + 2, 14, shade(theme.wall, -20));
          P(wx, wy, ww, 12, 'rgba(255,250,232,.62)');
          P(wx + Math.floor(ww / 2), wy, 1, 12, shade(theme.wall, -14));
          P(wx, wy + 8, ww, 4, 'rgba(255,226,175,.62)');
        }
        if (b.door) {
          const dx2 = sx + b.w - 11;
          P(dx2 - 1, base - 19, 9, 19, shade(theme.wall, -26));
          P(dx2, base - 18, 7, 18, shade(theme.roof, 6));
        }
      }

      // 보도
      P(0, 88, VIEW_W, 47, theme.ground);
      ctx.fillStyle = 'rgba(90,70,50,0.10)';
      ctx.fillRect(0, 88, VIEW_W, 47);
      ctx.fillStyle = 'rgba(45,70,40,0.12)';
      ctx.fillRect(0, 88, VIEW_W, 5);
      for (const s of world.speckles) {
        const sx = s.x - cam;
        if (sx < -2 || sx > VIEW_W + 2) continue;
        if (s.y < 88) continue;
        P(sx, s.y, s.w, 1, s.c);
      }
      P(0, 112, VIEW_W, 2, shade(theme.ground, -14));
      P(0, 134, VIEW_W, 1, 'rgba(58,38,24,.16)');

      // 담장·수풀
      for (let wx2 = Math.floor((cam - 10) / 2) * 2; wx2 < cam + VIEW_W + 10; wx2 += 2) {
        const sx = wx2 - cam;
        const h = 4 + ((wx2 * 5) % 4);
        P(sx, 88 - h, 2, h, wx2 % 10 === 0 ? '#5f8f58' : '#4c7748');
      }
      P(0, 82, VIEW_W, 1, 'rgba(58,38,24,.10)');
      P(0, 88, VIEW_W, 1, 'rgba(40,60,35,.30)');

      // 나무 상자 더미 / 자전거 / 쓰레기통
      const bx2 = 150 - cam;
      if (bx2 > -30 && bx2 < VIEW_W) {
        P(bx2, 116, 13, 8, '#c09a68');
        P(bx2 + 1, 115, 11, 1, '#a37d4e');
        P(bx2 + 6, 116, 2, 8, '#e6d3ae');
        P(bx2 + 3, 108, 10, 7, '#c8a271');
        P(bx2 + 7, 108, 2, 7, '#e6d3ae');
      }
      const bike = 214 - cam;
      if (bike > -40 && bike < VIEW_W + 10) {
        circle(bike + 6, 126, 5, '#5b5348');
        circle(bike + 6, 126, 3, theme.ground);
        circle(bike + 20, 126, 5, '#5b5348');
        circle(bike + 20, 126, 3, theme.ground);
        P(bike + 5, 120, 16, 1, '#7d7264');
        P(bike + 6, 114, 1, 7, '#7d7264');
        P(bike + 15, 112, 8, 1, '#7d7264');
        P(bike + 20, 112, 1, 8, '#7d7264');
      }
      const bin = 84 - cam;
      if (bin > -20 && bin < VIEW_W + 10) {
        P(bin, 116, 9, 12, '#7f8a76');
        P(bin - 1, 114, 11, 3, '#66705f');
        P(bin + 2, 120, 5, 1, 'rgba(255,255,255,.25)');
      }

      // 가로등
      const lx = 300 - cam;
      if (lx > -20 && lx < VIEW_W + 20) {
        P(lx, 52, 2, 66, '#6f6659');
        P(lx - 12, 52, 14, 2, '#6f6659');
        P(lx - 15, 54, 7, 5, '#f4d78a');
        P(lx - 15, 59, 7, 1, '#d9b461');
        circle(lx - 12, 56, 6, 'rgba(255,232,160,.16)');
      }
      // 우편함
      const mx = 40 - cam;
      if (mx > -20 && mx < VIEW_W) {
        P(mx, 100, 10, 13, '#7f9c8a');
        P(mx, 100, 10, 3, '#5f7a6a');
        P(mx + 2, 105, 5, 2, '#efe9d8');
        P(mx + 4, 113, 2, 5, '#5f7a6a');
      }
      // 화분
      const px2 = 470 - cam;
      if (px2 > -20 && px2 < VIEW_W + 20) {
        P(px2, 112, 10, 7, '#b8763f');
        P(px2 - 1, 110, 12, 3, '#cf8f52');
        const sw = Math.sin(t * 0.002) * 0.7;
        P(px2 + 5 + sw, 100, 2, 11, '#4f7a4a');
        P(px2 + 1 + sw, 102, 4, 2, '#5f8a55');
        P(px2 + 7 + sw, 99, 4, 2, '#6c9a5e');
      }
      // 지나가는 길고양이
      const kat = 350 - cam;
      if (kat > -30 && kat < VIEW_W + 30) {
        const walk = Math.sin(t * 0.0011) * 26;
        const kx = kat + walk;
        P(kx, 120, 12, 6, '#9c8b78');
        P(kx + 10, 116, 6, 6, '#9c8b78');
        P(kx + 11, 113, 2, 3, '#9c8b78');
        P(kx + 15, 113, 2, 3, '#9c8b78');
        P(kx + 14, 118, 1, 1, '#3a2f28');
        P(kx, 126, 2, 3, '#8a7a68');
        P(kx + 9, 126, 2, 3, '#8a7a68');
      }

      // 저녁 물결
      if (theme.skyTop === '#6b5a86') {
        ctx.fillStyle = 'rgba(120,60,80,0.12)';
        ctx.fillRect(0, 60, VIEW_W, 75);
      }
    }

    /* 사람·구공이는 화면 좌표(확대된 배경과 같은 배율로 옮긴 x)로 그린다. */
    function drawPerson(key, x, feetY, facing, t, walking, hScale) {
      const img = IMG.people[key];
      if (!img || !img.complete || !img.naturalWidth) return;
      const h = humanH(hScale);
      const w = h * (img.naturalWidth / img.naturalHeight);
      const bob = walking ? (Math.sin(t * 0.012) > 0 ? 0 : 1) : (Math.sin(t * 0.004) > 0 ? 0 : 1);
      const sx = Math.round(x - w / 2);
      const sy = Math.round(feetY - h + bob);

      // 그림자
      ctx.fillStyle = 'rgba(70,45,28,.15)';
      ctx.fillRect(sx + w * 0.15, feetY - 1, Math.max(7, w * 0.62), 2);

      // 원본 일러스트는 오른쪽을 보고 있다 → 왼쪽으로 갈 때 좌우 반전
      ctx.save();
      if (facing < 0) {
        ctx.translate(sx + w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, sy, w, h);
      } else {
        ctx.drawImage(img, sx, sy, w, h);
      }
      ctx.restore();
    }

    function drawCat(x, feetY, facing, t, walking, sniffing) {
      const img = facing > 0 ? IMG.catRight : IMG.cat;
      if (!img || !img.complete || !img.naturalWidth) return;
      const h = CAT_H;
      const w = h * (img.naturalWidth / img.naturalHeight);
      const bob = walking ? (Math.sin(t * 0.014) > 0 ? 0 : 1) : (Math.sin(t * 0.003) > 0 ? 0 : 1);
      const tilt = walking ? Math.sin(t * 0.014) * 0.02 : 0;
      const sx = Math.round(x - w / 2);
      const sy = Math.round(feetY - h + bob);

      ctx.fillStyle = 'rgba(70,45,28,.15)';
      ctx.fillRect(sx + w * 0.22, feetY - 1, w * 0.6, 2);

      ctx.save();
      ctx.globalAlpha = 1;                 // 구공이는 언제나 100% 불투명
      ctx.translate(sx + w / 2, sy + h);
      ctx.rotate(tilt);
      if (sniffing) ctx.translate(0, 2);
      /* 원본 assets/gugoong.png 는 왼쪽을 보고, assets/gugoong-right.png 는
         같은 그림을 좌우 반전해 '90' 글자만 바로 세운 짝이다.
         진행 방향을 바라보게 두 장을 골라 쓴다. */
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();

      // 걷기 먼지 (진행 반대쪽 뒤꿈치)
      if (walking) {
        const ph = (t * 0.02) % 1;
        if (ph > 0.6) {
          ctx.fillStyle = 'rgba(220,200,170,.6)';
          ctx.fillRect(sx + (facing > 0 ? -3 : w), feetY - 3 - Math.floor(ph * 4), 2, 2);
        }
      }
    }

    function draw(t, cam, entities) {
      fitCanvas(t);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      const feet = mode === 'in' ? FLOOR_IN : FLOOR_OUT;
      const toScreenX = (wx) => (wx - cam) * ZOOM;

      // 배경은 바닥선을 고정한 채 ZOOM 배 확대 (방·골목이 화면을 꽉 채운다)
      ctx.save();
      ctx.translate(0, feet * (1 - ZOOM));
      ctx.scale(ZOOM, ZOOM);
      if (mode === 'in') drawInterior(cam, t);
      else drawAlley(cam, t);
      ctx.restore();

      // 인간들 → 구공이 순. 구공이는 언제나 사람 앞(전경)에서 걷는다.
      const list = entities.filter(e => e.kind === 'human').sort((a, b) => a.x - b.x);
      for (const e of list) {
        drawPerson(e.sprite, toScreenX(e.x), feet, e.facing, t, e.walking, e.hScale);
      }
      for (const e of entities) {
        if (e.kind !== 'cat') continue;
        drawCat(toScreenX(e.x), feet, e.facing, t, e.walking, e.sniffing);
      }
    }

    function setScene(m, day, seed) {
      mode = m;
      theme = day.theme;
      world = m === 'in' ? buildInterior(seed) : buildAlley(seed);
    }

    function refit() { lastFit = 0; }

    return { draw, setScene, refit, VIEW_W, VIEW_H, ZOOM };
  })();

  /* ─────────────── 화면 요소 ─────────────── */
  const ui = {
    screens: {
      title: $('#screen-title'),
      game: $('#screen-game'),
      dayend: $('#screen-dayend'),
      final: $('#screen-final')
    },
    dayLabel: $('#day-label'),
    stageLabel: $('#stage-label'),
    roundLabel: $('#round-label'),
    score: $('#score'),
    combo: $('#combo'),
    stage: $('#stage'),
    worldUi: $('#world-ui'),
    caption: $('#caption'),
    clues: $('#clues'),
    judge: $('#judge'),
    dayCard: $('#day-card'),
    dayCardText: $('#day-card-text'),
    fade: $('#fade'),
    arrowL: $('#arrow-left'),
    arrowR: $('#arrow-right'),
    best: $('#best-line'),
    modal: $('#modal-help')
  };

  const HINT = '무대를 <b>톡 누르면</b> 그쪽으로 걸어간다. 인간에게 가까이 가면 살필 수 있다.';

  /* ─────────────── 상태 ─────────────── */
  const PROX = 40;
  const OBSERVE_COST = 2;
  const ROUNDS_PER_DAY = 4;

  const G = {
    day: 0,
    round: 0,
    days: [],
    queue: [],
    scene: 'in',
    phase: 'idle',        // idle | play | judged | trans | daycard | dayend | final
    cat: { x: 60, facing: 1, walking: false, sniffing: 0 },
    cam: 0,
    human: null,
    observed: { smell: false, eyes: false, act: false },
    score: 0,
    correct: 0,
    streak: 0,
    maxCombo: 0,
    dayResults: [],
    results: [],
    pops: [],
    bubbleEl: null,
    lastT: 0,
    autoNext: 0,
    trans: null,
    holding: 0,           // -1 왼쪽, 1 오른쪽, 0 정지
    walkTo: null,         // 탭으로 지정한 목적지
    clock: 0
  };

  function setScreen(name) {
    Object.entries(ui.screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  }

  function updateHud() {
    ui.dayLabel.textContent = DAYS[G.day].label;
    ui.stageLabel.textContent = G.scene === 'in' ? '집 안' : '골목';
    ui.roundLabel.textContent = `${Math.min(G.round + 1, ROUNDS_PER_DAY)}/${ROUNDS_PER_DAY}`;
    ui.score.textContent = G.score;
    if (G.streak >= 2) {
      ui.combo.hidden = false;
      ui.combo.textContent = `${G.streak}연속`;
    } else {
      ui.combo.hidden = true;
    }
    $('#btn-mute').textContent = Sound.isOn() ? '🔊' : '🔇';
  }

  function caption(html, cls) {
    ui.caption.innerHTML = `<p class="line ${cls || ''}">${html}</p>`;
  }

  function addCaptionLine(html) {
    const p = document.createElement('p');
    p.className = 'line';
    p.innerHTML = html;
    ui.caption.appendChild(p);
    const lines = ui.caption.querySelectorAll('.line');
    if (lines.length > 3) lines[0].remove();
    ui.caption.scrollTop = 9999;
  }

  /* ── 월드 좌표 → 무대 위 % ── */
  /* wx 는 월드(배경) x, sy 는 화면 논리 y. 사람·구공이가 커진 만큼 x 만 ZOOM 배로 옮긴다. */
  const VIS_W = VIEW_W / ZOOM;
  function toStage(wx, sy) {
    return {
      left: ((((wx - G.cam) * ZOOM) / VIEW_W) * 100),
      top: (sy / VIEW_H) * 100
    };
  }

  function popScore(wx, wy, mark, text, cls) {
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.innerHTML = `<b>${mark}</b><span>${text}</span>`;
    const pos = toStage(wx, wy);
    el.style.left = pos.left + '%';
    el.style.top = pos.top + '%';
    ui.worldUi.appendChild(el);
    G.pops.push({ el, wx, wy, life: 1.6 });
    setTimeout(() => el.remove(), 1700);
  }

  function showNameTag(text) {
    if (!G.tagEl) {
      G.tagEl = document.createElement('div');
      G.tagEl.className = 'nametag';
      ui.worldUi.appendChild(G.tagEl);
    }
    G.tagEl.textContent = text;
    G.tagEl.classList.add('show');
  }
  function hideNameTag() {
    if (G.tagEl) G.tagEl.classList.remove('show');
  }

  function showBubble(h) {
    if (!G.bubbleEl) {
      G.bubbleEl = document.createElement('div');
      G.bubbleEl.className = 'bub';
      ui.worldUi.appendChild(G.bubbleEl);
    }
    G.bubbleEl.textContent = h.bubble;
    G.bubbleEl.classList.add('show');
  }
  function hideBubble() {
    if (G.bubbleEl) G.bubbleEl.classList.remove('show');
  }

  /* ─────────────── 시작 ─────────────── */
  function startRun() {
    G.day = 0;
    G.round = 0;
    G.score = 0;
    G.correct = 0;
    G.streak = 0;
    G.maxCombo = 0;
    G.results = [];

    const indoor = shuffle(HUMANS.filter(h => h.scene === 'in'));
    const outdoor = shuffle(HUMANS.filter(h => h.scene === 'out'));
    G.days = [0, 1, 2].map(i => ({
      in: [indoor[i * 2], indoor[i * 2 + 1]],
      out: [outdoor[i * 2], outdoor[i * 2 + 1]]
    }));

    setScreen('game');
    startDay(0);
  }

  function startDay(dayIndex) {
    G.day = dayIndex;
    G.round = 0;
    G.dayResults = [];
    G.scene = 'in';
    G.queue = G.days[dayIndex].in.slice();
    G.cat = { x: 46, facing: 1, walking: false, sniffing: 0 };
    G.cam = 0;
    G.human = null;
    G.holding = 0;
    updateHud();
    caption(`<b>${DAYS[dayIndex].label}</b> — ${DAYS[dayIndex].intro}`);
    setNotesEnabled(false);
    Scene.setScene('in', DAYS[dayIndex], 1000 + dayIndex * 77);

    ui.dayCardText.innerHTML = `<div>${DAYS[dayIndex].label} · 집 안</div><div class="sub">${DAYS[dayIndex].intro}</div><div class="tip">화면을 눌러 걸어가라</div>`;
    ui.dayCard.classList.add('show');
    G.phase = 'daycard';
    const dismiss = () => {
      if (G.phase !== 'daycard') return;
      G.phase = 'play';
      ui.dayCard.classList.remove('show');
      ui.dayCard.removeEventListener('click', dismiss);
      Sound.meow();
      spawnHuman();
    };
    ui.dayCard.addEventListener('click', dismiss);
    setTimeout(dismiss, 2400);
  }

  function setNotesEnabled(on) {
    if (G.notesOn === !!on) return;
    ui.clues.querySelectorAll('.chip').forEach(c => { c.disabled = !on; });
    ui.judge.querySelectorAll('.sign').forEach(b => { b.disabled = !on; });
    G.notesOn = !!on;
  }

  function spawnHuman() {
    // 집 안은 0·1, 골목은 2·3 라운드 — 큐는 장면별 두 명씩
    const data = G.queue[G.round % 2];
    if (!data) return;
    const worldMax = WORLD[G.scene];
    /* 배경을 확대해 화면에 담기는 폭이 좁아졌다(VIS_W).
       그래서 원래 자리(SPOTS)가 화면 밖이면 구공이 바로 앞쪽에 세워,
       다음 인간이 어디서 오는지 늘 보이게 한다. */
    const spot = SPOTS[G.scene][G.round % 4];
    const target = clamp(
      Math.abs(spot - G.cat.x) <= VIS_W * 0.72 ? spot : G.cat.x + 76,
      30, worldMax - 30
    );
    let from = target + 55;
    let facing = -1;                       // 오른쪽에서 걸어 들어온다
    if (from > worldMax - 8) { from = target - 55; facing = 1; }
    G.human = {
      data,
      sprite: data.sprite,
      x: from,
      target,
      facing,
      walking: true,
      state: 'enter',
      stay: G.scene === 'in' ? 55 : 40,
      stayLeft: 0,
      mood: null,
      bubble: data.bubble
    };
    G.observed = { smell: false, eyes: false, act: false };
    G.phase = 'play';
    G.autoNext = 0;
    setNotesEnabled(false);
    hideBubble();
    showNameTag(data.name);
    caption(`<b>${data.name}</b> — ${data.tag}. 가까이 가서 살펴보자.`);
    updateHud();
  }

  /* ─────────────── 상호작용 ─────────────── */
  function inRange() {
    return G.human && G.human.state === 'idle' && Math.abs(G.cat.x - G.human.x) < PROX;
  }

  function faceHuman() {
    if (!G.human) return;
    G.cat.facing = G.human.x >= G.cat.x ? 1 : -1;
  }

  function observe(key) {
    if (!inRange() || G.observed[key]) return;
    G.observed[key] = true;
    G.human.stayLeft = Math.max(0.5, G.human.stayLeft - OBSERVE_COST);
    G.cat.sniffing = 0.5;
    G.cat.facing = G.human.x >= G.cat.x ? 1 : -1;
    Sound.sniff();

    const label = key === 'smell' ? '냄새' : key === 'eyes' ? '눈빛' : '행동';
    addCaptionLine(`<span class="k">${label}</span>${G.human.data.clues[key]}`);

    const chip = ui.clues.querySelector(`.chip[data-clue="${key}"]`);
    if (chip) {
      chip.classList.add('on', 'hit');
      setTimeout(() => chip.classList.remove('hit'), 320);
    }
  }

  function judge(choice) {
    if (!inRange() || G.human.state !== 'idle') return;
    const data = G.human.data;
    G.human.state = 'react';
    G.human.walking = false;
    G.human.mood = choice === 'plus' ? 'heart' : choice === 'minus' ? 'drop' : 'q';
    G.phase = 'judged';
    setNotesEnabled(false);
    hideBubble();
    hideNameTag();
    Sound.slap();

    const isRight = choice === data.truth;
    const mark = choice === 'plus' ? '+' : choice === 'minus' ? '−' : '90';
    let gained = 0;
    if (isRight) {
      G.correct += 1;
      G.streak += 1;
      G.maxCombo = Math.max(G.maxCombo, G.streak);
      gained = 100 + Math.min(100, (G.streak - 1) * 20);
      G.score += gained;
      setTimeout(() => Sound.ok(), 150);
    } else {
      G.streak = 0;
      G.score += 40;
      gained = 40;
      setTimeout(() => Sound.ng(), 150);
    }

    // 머리 위 점수
    const headY = (G.scene === 'in' ? FLOOR_IN : FLOOR_OUT) - humanH(data.hScale) - 4;
    popScore(G.human.x, headY, mark, isRight ? `+${gained}` : `+${gained} 빗나감`, isRight ? 'ok' : 'ng');

    G.results.push({ id: data.id, choice, right: isRight });
    G.dayResults.push({ id: data.id, right: isRight, missed: false });

    caption(
      `<b>${mark === '90' ? '90점' : mark === '+' ? '합격' : '감점'}</b> ${data.lines[choice]}` +
      (isRight ? '' : `<br><span class="why">구공이의 속내 — ${data.why}</span>`),
      isRight ? 'ok' : 'ng'
    );
    updateHud();
    G.autoNext = 3.4;
  }

  function missHuman() {
    const data = G.human.data;
    G.human.state = 'react';
    G.human.walking = false;
    G.streak = 0;
    G.dayResults.push({ id: data.id, right: false, missed: true });
    G.results.push({ id: data.id, choice: null, right: false, missed: true });
    caption(`놓쳤다. <b>${data.name}</b>이(가) 가 버렸다.<br><span class="why">구공이의 속내 — ${data.why}</span>`, 'ng');
    setNotesEnabled(false);
    hideBubble();
    hideNameTag();
    Sound.miss();
    G.phase = 'judged';
    G.autoNext = 2.2;
  }

  function nextHuman() {
    if (!G.human || (G.human.state !== 'react')) { G.autoNext = 0; return; }
    G.autoNext = 0;
    if (G.human) {
      G.human.state = 'leave';
      G.human.walking = true;
      G.human.facing = 1;
    }
    G.phase = 'leaving';

    const lastInDay = G.round + 1 >= ROUNDS_PER_DAY;
    const lastInScene = G.round + 1 >= 2;
    G.pending = { lastInDay, lastInScene };
  }

  function afterLeave() {
    const { lastInDay, lastInScene } = G.pending || {};
    G.round += 1;
    if (lastInDay) {
      if (G.day + 1 >= DAYS.length) endRun();
      else endDay();
      return;
    }
    if (lastInScene && G.scene === 'in') {
      startTransition();
      return;
    }
    G.human = null;
    spawnHuman();
  }

  /* ── 집 안 → 골목 전환 ── */
  function startTransition() {
    G.phase = 'trans';
    G.trans = { t: 0, stage: 'walk' };
    G.human = null;
    hideBubble();
    hideNameTag();
    ui.fade.className = 'fade';
    caption('구공이가 문가로 걸어간다. 골목으로 나가자.');
  }

  function updateTransition(dt) {
    const tr = G.trans;
    tr.t += dt;
    if (tr.stage === 'walk') {
      const doorX = 444;
      G.cat.walking = true;
      G.cat.facing = 1;
      G.cat.x = Math.min(doorX, G.cat.x + 58 * dt);
      if (G.cat.x >= doorX - 1 || tr.t > 6) {
        tr.stage = 'out';
        tr.t = 0;
        Sound.door();
        ui.fade.classList.add('on');
      }
    } else if (tr.stage === 'out') {
      if (tr.t > 0.7) {
        tr.stage = 'swap';
        tr.t = 0;
        G.scene = 'out';
        G.queue = G.days[G.day].out.slice();
        G.round = 2;
        Scene.setScene('out', DAYS[G.day], 3000 + G.day * 91);
        G.cat = { x: 24, facing: 1, walking: false, sniffing: 0 };
        G.cam = 0;
      }
    } else if (tr.stage === 'swap') {
      if (tr.t > 0.35) {
        tr.stage = 'in';
        tr.t = 0;
        ui.fade.classList.remove('on');
        caption('골목이다. 지나가는 인간을 살펴보자.');
      }
    } else if (tr.stage === 'in') {
      if (tr.t > 0.6) {
        G.phase = 'play';
        G.trans = null;
        updateHud();
        spawnHuman();
      }
    }
  }

  /* ─────────────── 정산 ─────────────── */
  function endDay() {
    G.phase = 'dayend';
    hideBubble();
    hideNameTag();
    const results = G.dayResults;
    const right = results.filter(r => r.right).length;
    const missed = results.filter(r => r.missed).length;
    const total = results.length;

    $('#dayend-label').textContent = `${DAYS[G.day].label} 정산`;
    $('#dayend-title').textContent = right === total ? '완벽한 심사' : right >= total - 1 ? '좋은 심사' : '흔들린 심사';
    $('#dayend-stamps').innerHTML = results.map((r, i) =>
      `<span class="stamp ${r.missed ? 'miss' : r.right ? 'ok' : 'ng'}" style="animation-delay:${i * 90}ms">${r.missed ? '?' : r.right ? '✓' : '✕'}</span>`
    ).join('');
    const key = right === total ? 'perfect' : right >= total - 1 ? 'good' : right >= 2 ? 'meh' : 'bad';
    $('#dayend-comment').innerHTML = `${DAY_END[key]}<br><span style="font-size:11px;color:#a08a6d">정확 ${right}/${total}${missed ? ` · 놓침 ${missed}` : ''}</span>`;
    $('#dayend-score').textContent = G.score;
    $('#btn-nextday').textContent = `${DAYS[G.day + 1].label}로 →`;
    setScreen('dayend');
    Sound.meow();
  }

  function endRun() {
    G.phase = 'final';
    hideBubble();
    hideNameTag();
    const correct = G.correct;
    const rank = RANKS.find(r => correct >= r.min) || RANKS[RANKS.length - 1];
    $('#rank-title').textContent = rank.title;
    $('#rank-desc').textContent = rank.desc;
    $('#final-correct').textContent = `${correct}/12`;
    $('#final-score').textContent = G.score;
    $('#final-maxcombo').textContent = G.maxCombo;

    const best = store.get('gugoong.best', null);
    if (!best || G.score > best.score) {
      store.set('gugoong.best', { score: G.score, correct, title: rank.title, at: Date.now() });
      $('#final-best').textContent = '새 최고 기록! 🐾';
    } else {
      $('#final-best').textContent = `최고 기록 · ${best.score} 냥력 (${best.title})`;
    }
    setScreen('final');
    Sound.win();
  }

  /* ─────────────── 루프 ─────────────── */
  function loop(now) {
    requestAnimationFrame(loop);
    if (!G.lastT) G.lastT = now;
    let dt = (now - G.lastT) / 1000;
    G.lastT = now;
    if (dt > 0.2) dt = 0.2;
    G.clock = now;

    const worldMax = WORLD[G.scene];
    const h = G.human;

    /* 고양이 이동 */
    if (G.phase === 'play' && !G.trans) {
      let dir = G.holding;
      // 탭으로 지정한 목적지까지 자동으로 걸어간다
      if (dir === 0 && G.walkTo != null) {
        const gapTo = G.walkTo - G.cat.x;
        if (Math.abs(gapTo) < 2.5) { G.walkTo = null; }
        else dir = Math.sign(gapTo);
      }
      // 인간 앞에서는 걸음을 멈추고 마주 본다 (지나치지 않게)
      if (dir !== 0 && G.human && G.human.state === 'idle') {
        const gap = G.human.x - G.cat.x;
        if (Math.sign(gap) === dir && Math.abs(gap) <= 30) { dir = 0; G.walkTo = null; }
      }
      G.cat.walking = dir !== 0;
      if (dir !== 0) {
        G.cat.x = clamp(G.cat.x + dir * 54 * dt, 8, worldMax - 10);
        G.cat.facing = dir;
        Sound.step(now);
      }
    }
    if (G.cat.sniffing > 0) G.cat.sniffing = Math.max(0, G.cat.sniffing - dt);

    /* 인간 상태 */
    if (h) {
      if (h.state === 'enter') {
        h.walking = true;
        const dx = h.target - h.x;
        if (Math.abs(dx) < 1.5) {
          h.x = h.target;
          h.walking = false;
          h.state = 'idle';
          h.stayLeft = h.stay;
          showBubble(h);
          Sound.tap();
          setNotesEnabled(false);
        } else {
          h.x += Math.sign(dx) * 34 * dt;
          h.facing = Math.sign(dx);
        }
      } else if (h.state === 'idle') {
        h.stayLeft -= dt;
        h.facing = G.cat.x >= h.x ? 1 : -1;
        const near = Math.abs(G.cat.x - h.x) < PROX;
        setNotesEnabled(near);
        if (near && Math.abs(G.cat.x - h.x) < PROX - 4) faceHuman();
        if (h.stayLeft <= 0) missHuman();
      } else if (h.state === 'react') {
        /* 대기 */
      } else if (h.state === 'leave') {
        h.walking = true;
        h.x += 78 * dt;
        const offScreen = h.x > G.cam + VIS_W + 12 || h.x < G.cam - 40;
        if (G.phase === 'leaving' && offScreen) {
          afterLeave();
        } else if (h.x > worldMax + 60) {
          h.x = worldMax + 60;
        }
      }
    }

    if (G.autoNext > 0) {
      G.autoNext -= dt;
      if (G.autoNext <= 0) nextHuman();
    }

    if (G.trans) updateTransition(dt);

    /* 카메라 */
    const camTarget = clamp(G.cat.x - VIS_W / 2 + 7, 0, worldMax - VIS_W);
    G.cam += (camTarget - G.cam) * Math.min(1, dt * 6);

    /* 무대 위 DOM (점수/말풍선) 위치 갱신 */
    for (let i = G.pops.length - 1; i >= 0; i--) {
      const p = G.pops[i];
      p.life -= dt;
      if (p.life <= 0 || !p.el.isConnected) { G.pops.splice(i, 1); continue; }
      const pos = toStage(p.wx, p.wy);
      p.el.style.left = pos.left + '%';
      p.el.style.top = pos.top + '%';
    }
    if (h) {
      const feet = G.scene === 'in' ? FLOOR_IN : FLOOR_OUT;
      const hh = humanH(h.data && h.data.hScale);
      if (G.tagEl) {
        const p = toStage(h.x + 8, feet - hh - 1);
        G.tagEl.style.left = p.left + '%';
        G.tagEl.style.top = p.top + '%';
      }
      if (G.bubbleEl) {
        const p = toStage(h.x + 8, feet - hh - 18);
        G.bubbleEl.style.left = p.left + '%';
        G.bubbleEl.style.top = p.top + '%';
      }
    }

    /* 이동 화살표 */
    if (G.phase === 'play') {
      const near = h && h.state === 'idle' && Math.abs(G.cat.x - h.x) < PROX;
      ui.arrowL.classList.toggle('show', G.holding !== -1 && !near);
      ui.arrowR.classList.toggle('show', G.holding !== 1 && !near);
    } else {
      ui.arrowL.classList.remove('show');
      ui.arrowR.classList.remove('show');
    }

    const entities = [];
    if (h) {
      entities.push({ kind: 'human', x: h.x, sprite: h.sprite, facing: h.facing, walking: h.walking, mood: h.mood, hScale: h.data && h.data.hScale });
    }
    entities.push({ kind: 'cat', x: G.cat.x, facing: G.cat.facing, walking: G.cat.walking, sniffing: G.cat.sniffing > 0 });

    Scene.draw(now, G.cam, entities);
  }

  /* ─────────────── 조작 ─────────────── */
  function pointerDir(clientX) {
    const rect = ui.stage.getBoundingClientRect();
    const logical = ((clientX - rect.left) / rect.width) * VIEW_W;
    const catScreen = (G.cat.x - G.cam) * ZOOM;
    if (Math.abs(logical - catScreen) < 12) return 0;
    return logical > catScreen ? 1 : -1;
  }

  function bind() {
    $('#btn-start').addEventListener('click', () => { Sound.meow(); startRun(); });
    $('#btn-howto').addEventListener('click', () => { ui.modal.hidden = false; });
    $('#btn-help').addEventListener('click', () => { ui.modal.hidden = false; });
    $('#btn-close-help').addEventListener('click', () => { ui.modal.hidden = true; Sound.tap(); });
    ui.modal.addEventListener('click', (e) => { if (e.target === ui.modal) ui.modal.hidden = true; });

    $('#btn-mute').addEventListener('click', () => {
      Sound.set(!Sound.isOn());
      updateHud();
      if (Sound.isOn()) Sound.tap();
    });

    ui.clues.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) observe(chip.dataset.clue);
    });
    ui.judge.addEventListener('click', (e) => {
      const btn = e.target.closest('.sign');
      if (btn) judge(btn.dataset.judge);
    });

    // 무대 누르고 걷기 / 톡 누르면 그 지점까지 걸어가기
    let pressing = false;
    let pressAt = 0;
    let pressX = 0;
    let moved = 0;
    const worldAt = (clientX) => {
      const rect = ui.stage.getBoundingClientRect();
      const logical = ((clientX - rect.left) / rect.width) * VIEW_W;
      return clamp(G.cam + logical / ZOOM, 8, WORLD[G.scene] - 10);
    };
    const start = (e) => {
      if (G.phase !== 'play') return;
      pressing = true;
      pressAt = Date.now();
      pressX = e.clientX;
      moved = 0;
      // 누른 지점까지 걸어가는 목적지 + 누르고 있는 동안은 그 방향으로
      G.walkTo = worldAt(e.clientX);
      G.holding = pointerDir(e.clientX);
      e.preventDefault();
    };
    const move = (e) => {
      if (!pressing) return;
      if (Math.abs(e.clientX - pressX) > 6) { moved++; G.walkTo = null; }
      pressX = e.clientX;
      G.holding = pointerDir(e.clientX);
    };
    const end = () => {
      pressing = false;
      G.holding = 0;
    };

    ui.stage.addEventListener('pointerdown', start);
    window.addEventListener('resize', () => { if (Scene.refit) Scene.refit(); });
    ui.stage.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    // 키보드
    document.addEventListener('keydown', (e) => {
      if (G.phase === 'play') {
        if (e.key === 'ArrowLeft') { G.holding = -1; e.preventDefault(); }
        if (e.key === 'ArrowRight') { G.holding = 1; e.preventDefault(); }
        if (e.key === '1') observe('smell');
        if (e.key === '2') observe('eyes');
        if (e.key === '3') observe('act');
        if (e.key === 'a') judge('plus');
        if (e.key === 's') judge('minus');
        if (e.key === 'd') judge('ninety');
      } else if (G.phase === 'judged' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        nextHuman();
      }
    });
    document.addEventListener('keyup', (e) => {
      if ((e.key === 'ArrowLeft' && G.holding === -1) || (e.key === 'ArrowRight' && G.holding === 1)) G.holding = 0;
    });

    $('#btn-nextday').addEventListener('click', () => {
      Sound.tap();
      startDay(G.day + 1);
      setScreen('game');
    });

    $('#btn-replay').addEventListener('click', () => { Sound.tap(); startRun(); });

    $('#btn-share').addEventListener('click', async () => {
      const text = `구공이 90점 채점소 — ${$('#rank-title').textContent}, 정확 ${$('#final-correct').textContent}, ${G.score} 냥력 🐾`;
      try {
        await navigator.clipboard.writeText(text);
        $('#btn-share').textContent = '복사됨!';
      } catch (err) {
        $('#btn-share').textContent = '복사 실패';
      }
      setTimeout(() => { $('#btn-share').textContent = '결과 복사'; }, 1600);
    });

    document.addEventListener('visibilitychange', () => { G.lastT = 0; G.holding = 0; });
  }

  /* ─────────────── 초기화 ─────────────── */
  function init() {
    IMG.cat = loadImage('assets/gugoong.png');
    IMG.catRight = loadImage('assets/gugoong-right.png');
    for (const h of HUMANS) IMG.people[h.sprite] = loadImage(h.sprite);

    const best = store.get('gugoong.best', null);
    if (best) ui.best.textContent = `최고 기록 · ${best.score} 냥력 (${best.title})`;
    Scene.setScene('in', DAYS[0], 1000);
    bind();
    updateHud();
    requestAnimationFrame(loop);
  }

  init();
})();
