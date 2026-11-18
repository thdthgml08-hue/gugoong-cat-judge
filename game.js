/* 구공이 90점 채점소 — 게임 엔진 */

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

  /* ─────────────── 소리 (Web Audio) ─────────────── */
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

    return {
      isOn: () => on,
      set(onoff) { on = !!onoff; store.set('gugoong.sound', on); },
      tap() { tone({ freq: 540, dur: 0.05, type: 'square', vol: 0.025 }); },
      sniff() { noise(0.14, 0.05, 1600); tone({ freq: 300, dur: 0.08, type: 'sine', vol: 0.02, slide: 120 }); },
      slap() { tone({ freq: 160, dur: 0.1, type: 'square', vol: 0.08, slide: -60 }); noise(0.05, 0.04, 700); },
      ok() { [660, 880, 1175].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.055, delay: i * 0.065 })); },
      ng() { tone({ freq: 220, dur: 0.16, type: 'sawtooth', vol: 0.045, slide: -80 }); tone({ freq: 150, dur: 0.2, type: 'square', vol: 0.035, delay: 0.11 }); },
      miss() { tone({ freq: 320, dur: 0.32, type: 'sine', vol: 0.045, slide: -190 }); },
      meow() {
        tone({ freq: 620, dur: 0.11, type: 'triangle', vol: 0.06, slide: 260 });
        tone({ freq: 900, dur: 0.17, type: 'triangle', vol: 0.045, slide: -320, delay: 0.1 });
      },
      win() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.17, type: 'triangle', vol: 0.05, delay: i * 0.1 })); }
    };
  })();

  /* ─────────────── 거리 장면 (캔버스) ─────────────── */
  const Scene = (() => {
    const cv = $('#scene');
    const ctx = cv.getContext('2d');
    const W = 240, H = 160;
    ctx.imageSmoothingEnabled = false;

    let theme = DAYS[0].theme;
    let world = null;
    let clock = 0;

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

    function build(th, seed) {
      const r = mulberry32(seed);
      const far = [];
      let x = -6;
      while (x < W + 12) {
        const w = 16 + Math.round(r() * 16);
        const h = 24 + Math.round(r() * 36);
        far.push({ x, w, h, tone: Math.round(r() * 2) });
        x += w + 1 + Math.round(r() * 3);
      }
      const near = [];
      x = -10;
      while (x < W + 10) {
        const w = 26 + Math.round(r() * 22);
        const h = 26 + Math.round(r() * 16);
        near.push({
          x, w, h,
          awning: r() > 0.45,
          awningColor: ['#c96f5a', '#5f8a86', '#c99b5a', '#8a7bb5'][Math.round(r() * 3)],
          door: r() > 0.3,
          sign: r() > 0.6
        });
        x += w + 2;
      }
      const clouds = [];
      for (let i = 0; i < 4; i++) {
        clouds.push({ x: r() * W, y: 8 + r() * 30, s: 0.8 + r() * 0.8, v: 1.2 + r() * 1.6 });
      }
      const speckles = [];
      for (let i = 0; i < 110; i++) {
        const y = 117 + Math.floor(r() * 19);
        const near = (y - 117) / 19;
        speckles.push({
          x: Math.floor(r() * W),
          y,
          w: near > 0.5 ? 2 : 1,
          c: r() > 0.5 ? 'rgba(120,95,65,.13)' : 'rgba(255,250,235,.28)'
        });
      }
      return { far, near, clouds, speckles, seed };
    }

    function setDay(day, seed) {
      theme = day.theme;
      world = build(theme, seed);
      clock = 0;
    }

    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, 100);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(1, theme.skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 110);

      // 해 / 달
      circle(theme.sunX, theme.sunY, 9, theme.sun);
      circle(theme.sunX, theme.sunY, 7, shade(theme.sun, 8));

      // 구름
      for (const c of world.clouds) {
        c.x -= c.v * 0.06;
        if (c.x < -30) c.x = W + 12;
        const cx = Math.round(c.x), cy = Math.round(c.y);
        const s = c.s;
        ctx.fillStyle = 'rgba(255,252,244,0.85)';
        ctx.fillRect(cx, cy, Math.round(14 * s), Math.round(4 * s));
        ctx.fillRect(cx + 3, cy - 3, Math.round(8 * s), Math.round(4 * s));
        ctx.fillRect(cx + 8, cy - 1, Math.round(6 * s), Math.round(3 * s));
      }
    }

    function drawFar() {
      const base = 99;
      for (const b of world.far) {
        const top = base - b.h;
        const tone = [theme.far, shade(theme.far, -9), shade(theme.far, 7)][b.tone % 3];
        P(b.x, top, b.w, b.h, tone);
        P(b.x, top, b.w, 2, shade(tone, 13));
        P(b.x + b.w - 1, top, 1, b.h, shade(tone, -8));
        // 창문
        const cols = Math.max(1, Math.floor((b.w - 4) / 6));
        const rows = Math.max(1, Math.floor((b.h - 8) / 7));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const wx = b.x + 3 + i * 6;
            const wy = top + 5 + j * 7;
            const lit = theme.skyTop === '#6b5a86' && ((i * 7 + j * 3 + b.x) % 5 < 2);
            P(wx, wy, 3, 3, lit ? '#ffd98a' : shade(tone, -22));
          }
        }
      }
      // 원경 안개 — 깊이감
      ctx.fillStyle = 'rgba(255,246,232,0.30)';
      ctx.fillRect(0, 0, W, 101);
    }

    function drawNear() {
      const base = 106;
      world.near.forEach((b, idx) => {
        const top = base - b.h;
        const body = [theme.wall, shade(theme.wall, -7), shade(theme.wall, 5)][idx % 3];
        P(b.x, top, b.w, b.h, body);
        // 지붕 + 처마 그늘
        P(b.x - 1, top - 1, b.w + 2, 3, theme.roof);
        P(b.x - 1, top + 2, b.w + 2, 2, 'rgba(58,38,24,.10)');
        P(b.x + b.w - 2, top + 3, 2, b.h - 3, shade(body, -10));

        // 차양
        if (b.awning) {
          const ay = top + 4;
          for (let i = 0; i < b.w - 2; i += 4) {
            P(b.x + 1 + i, ay, 2, 5, b.awningColor);
            P(b.x + 3 + i, ay, 2, 5, '#f3e6cd');
          }
          for (let i = 0; i < b.w - 2; i += 4) P(b.x + 1 + i, ay + 5, 2, 1, shade(b.awningColor, -20));
        }

        // 간판
        if (b.sign) {
          const sw = Math.min(b.w - 12, 16);
          P(b.x + 4, top + (b.awning ? 11 : 8), sw, 6, shade(b.awningColor, -6));
          P(b.x + 6, top + (b.awning ? 13 : 10), 3, 2, '#f8efdb');
          P(b.x + 11, top + (b.awning ? 13 : 10), 5, 2, '#f8efdb');
        }

        // 쇼윈도
        if (b.w > 28) {
          const wx = b.x + 3, wy = base - 22, ww = Math.min(b.w - 18, 16), wh = 14;
          P(wx - 1, wy - 1, ww + 2, wh + 2, shade(body, -20));
          P(wx, wy, ww, wh, 'rgba(255,250,232,.62)');
          P(wx + Math.floor(ww / 2), wy, 1, wh, shade(body, -14));
          P(wx, wy + wh - 5, ww, 5, 'rgba(255,226,175,.62)');
          P(wx, wy, ww, 1, 'rgba(255,255,255,.55)');
          P(wx + 2, wy + 4, 3, 3, 'rgba(255,255,255,.35)');
        }

        // 문
        if (b.door) {
          const dx = b.x + b.w - 12;
          P(dx - 1, base - 21, 10, 21, shade(body, -26));
          P(dx, base - 20, 8, 20, shade(theme.roof, 6));
          P(dx + 1, base - 19, 6, 7, 'rgba(255,240,210,.30)');
          P(dx + 6, base - 11, 1, 2, '#f0d79a');
        }
      });

      P(0, 105, W, 11, theme.garden || '#4f7b4b');
      // 울타리 + 수풀
      for (let x = 0; x < W; x += 2) {
        const h = 2 + ((x * 7) % 4);
        P(x, 105 - h, 2, h, (x / 2) % 3 === 0 ? '#5f8f58' : '#4f7b4b');
      }
      for (let x = 2; x < W; x += 15) {
        P(x, 103, 2, 13, '#8a6a48');
      }
      P(0, 105, W, 1, 'rgba(40,70,40,.35)');
      ctx.fillStyle = 'rgba(45,60,35,0.18)';
      ctx.fillRect(0, 116, W, 3);

      P(0, 104, W, 1, 'rgba(58,38,24,.12)');
    }

    function drawGround() {
      P(0, 105, W, 33, theme.ground);
      // 수풀 그늘
      ctx.fillStyle = 'rgba(45,70,40,0.13)';
      ctx.fillRect(0, 116, W, 5);
      // 자갈·먼지 얼룩
      for (const s of world.speckles) P(s.x, s.y, s.w, 1, s.c);
      // 작은 돌과 마른 나뭇잎
      P(64, 129, 3, 2, '#b3a68f');
      P(65, 131, 2, 1, '#a3957e');
      P(196, 127, 2, 1, '#b57a4a');
      P(197, 128, 3, 1, '#c98a4a');
      P(58, 120, 2, 1, '#c98a4a');
      // 물웅덩이
      P(84, 128, 9, 3, 'rgba(150,170,180,.30)');
      P(86, 127, 5, 1, 'rgba(190,210,215,.35)');
      // 연석
      P(0, 136, W, 2, shade(theme.ground, -16));
      P(0, 138, W, 1, 'rgba(58,38,24,.16)');
    }

    function drawProps() {
      const sway = Math.sin(clock * 0.002) * 0.7;

      // 가로등 (보도 쪽으로 뻗은 팔)
      P(212, 66, 2, 72, '#6f6659');
      P(202, 66, 12, 2, '#6f6659');
      P(199, 68, 7, 5, '#f4d78a');
      P(199, 73, 7, 1, '#d9b461');
      circle(202, 70, 6, 'rgba(255,232,160,.18)');

      // 우편함
      P(13, 117, 12, 15, '#7f9c8a');
      P(13, 117, 12, 3, '#5f7a6a');
      P(16, 123, 6, 2, '#efe9d8');
      P(18, 132, 2, 6, '#5f7a6a');

      // 화분 (인간과 고양이 사이)
      P(126, 127, 10, 7, '#b8763f');
      P(125, 125, 12, 3, '#cf8f52');
      P(130 + sway, 116, 2, 10, '#4f7a4a');
      P(126 + sway, 118, 4, 2, '#5f8a55');
      P(132 + sway, 114, 4, 2, '#6c9a5e');
      P(129 + sway, 111, 3, 2, '#6c9a5e');

      // 길고양이 밥그릇
      P(44, 132, 9, 4, '#c8c0a8');
      P(45, 133, 7, 2, '#8a7a5a');

      // 떨어지는 잎
      for (let i = 0; i < 3; i++) {
        const t = clock * 0.00018 + i * 2.1;
        const lx = 30 + ((t * 26 + i * 71) % 190);
        const ly = 96 + Math.sin(t * 5 + i) * 4 + ((t * 7 + i * 13) % 12);
        P(lx, ly, 2, 1, i % 2 ? '#c98a4a' : '#b5734a');
      }

      // 참새 (낮에만)
      if (theme.skyTop === '#a9d8e8') {
        const bx = 40 + ((clock * 0.006) % 200);
        const by = 52 + Math.sin(clock * 0.003) * 3;
        P(bx, by, 3, 2, '#6b5a4a');
        P(bx + 3, by - 1, 1, 1, '#6b5a4a');
      }
    }

    function drawSill() {
      P(0, 139, W, 21, '#b0814f');
      P(0, 139, W, 3, '#d3a878');
      P(0, 142, W, 1, 'rgba(90,55,30,.22)');
      for (let x = 6; x < W; x += 18) {
        P(x, 145, 1, 10, 'rgba(90,55,30,.10)');
      }
      // 창턱 위 소품 (왼쪽) — 화초
      P(4, 148, 10, 8, '#a96a3c');
      P(3, 146, 12, 3, '#c98650');
      const sw = Math.sin(clock * 0.0016) * 0.8;
      P(8 + sw, 135, 2, 11, '#4f7a4a');
      P(5 + sw, 137, 5, 2, '#5f8a55');
      P(11 + sw, 134, 5, 2, '#6c9a5e');
      P(8 + sw, 131, 3, 2, '#6c9a5e');
      P(11 + sw, 129, 2, 2, '#6c9a5e');
      // 창턱 위 컵 (고양이 발치)
      P(120, 150, 7, 7, '#f2e7d2');
      P(119, 149, 9, 2, '#fbf3e3');
      P(120, 157, 7, 1, 'rgba(90,55,30,.18)');
      P(127, 151, 2, 3, '#f2e7d2');
      P(122, 150, 3, 1, 'rgba(120,80,50,.35)');
    }

    /* ── 인간 픽셀 스프라이트 ── */
    const ICONS = {
      heart: [' ## ## ', '#######', '#######', ' ##### ', '  ###  ', '   #   '],
      drop: ['   #   ', '  ###  ', ' ##### ', '#######', '#######', ' ##### ', '  ###  '],
      q: [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  ']
    };

    function drawIcon(map, x, y, color) {
      ctx.fillStyle = color;
      for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
          if (map[r][c] === '#') ctx.fillRect(x + c, y + r, 1, 1);
        }
      }
    }

    function drawHuman(h) {
      const look = h.look;
      const bx = Math.round(h.x);
      const feetY = 133;
      const moving = h.moving;
      const swing = moving ? Math.round(Math.sin(h.phase * 2) * 1.5) : 0;
      const bob = moving ? (Math.sin(h.phase * 2) > 0 ? 0 : 1) : (Math.sin(clock * 0.004) > 0 ? 0 : 1);
      const top = feetY - 32 + bob;

      // 그림자
      ctx.fillStyle = 'rgba(70,45,28,.16)';
      ctx.fillRect(bx + 1, feetY - 1, 12, 2);

      ctx.save();
      ctx.translate(bx + 7, 0);
      ctx.scale(h.dir, 1);
      ctx.translate(-7, 0);

      const skin = look.skin, hair = look.hair, shirt = look.shirt, pants = look.pants;
      const y = top;

      // 다리
      P(3 + swing, y + 23, 3, 9, pants);
      P(8 - swing, y + 23, 3, 9, pants);
      P(3 + swing, y + 30, 3, 2, '#3b3029');
      P(8 - swing, y + 30, 3, 2, '#3b3029');

      // 몸통
      P(2, y + 10, 10, 13, shirt);
      P(2, y + 10, 10, 2, shade(shirt, -18));
      P(6, y + 10, 3, 3, shade(shirt, 20));

      // 팔
      P(0, y + 11, 2, 9, shirt);
      P(12, y + 11, 2, 9, shirt);
      P(0, y + 19, 2, 2, skin);
      P(12, y + 19, 2, 2, skin);

      // 머리
      P(3, y + 1, 9, 9, skin);
      P(3, y + 9, 9, 1, shade(skin, -14));

      // 헤어
      if (look.hairStyle === 'short') {
        P(2, y + 1, 11, 3, hair);
        P(2, y + 3, 2, 3, hair);
        P(11, y + 3, 2, 3, hair);
        P(4, y + 3, 7, 1, hair);
      } else if (look.hairStyle === 'long') {
        P(1, y + 1, 12, 3, hair);
        P(1, y + 3, 2, 11, hair);
        P(11, y + 3, 2, 11, hair);
        P(5, y + 2, 6, 1, hair);
      } else if (look.hairStyle === 'bun') {
        P(2, y + 1, 11, 3, hair);
        P(2, y + 3, 2, 2, hair);
        P(11, y + 3, 2, 2, hair);
        P(6, y - 2, 4, 3, hair);
      } else if (look.hairStyle === 'cap') {
        P(2, y - 1, 11, 3, '#4a6fa5');
        P(1, y + 2, 13, 1, '#3a5a88');
        P(3, y + 3, 2, 1, hair);
        P(10, y + 3, 2, 1, hair);
      } else {
        P(4, y + 1, 7, 1, hair);
      }

      // 얼굴
      P(5, y + 5, 1, 2, '#2b2018');
      P(9, y + 5, 1, 2, '#2b2018');
      P(7, y + 8, 2, 1, '#9a6250');
      if (h.blush) { P(4, y + 7, 1, 1, '#e0857d'); P(10, y + 7, 1, 1, '#e0857d'); }

      // 소품
      if (look.acc === 'bag') {
        P(-3, y + 15, 4, 7, '#8a5a38');
        P(-2, y + 16, 2, 5, '#a3703f');
        P(-1, y + 10, 1, 6, '#5a3a22');
      } else if (look.acc === 'phone') {
        P(11, y + 8, 3, 4, skin);
        P(12, y + 4, 2, 5, '#2b2b33');
      } else if (look.acc === 'box') {
        P(0, y + 16, 14, 8, '#c09a68');
        P(1, y + 15, 12, 1, '#a37d4e');
        P(6, y + 16, 2, 8, '#e6d3ae');
        P(2, y + 19, 3, 1, '#a37d4e');
      } else if (look.acc === 'feather') {
        P(12, y + 10, 1, 8, '#7a5a3a');
        P(11, y + 6, 3, 5, '#e8c26a');
        P(12, y + 5, 2, 2, '#f0d58a');
      } else if (look.acc === 'camera') {
        P(4, y + 13, 7, 4, '#2b2b33');
        P(6, y + 14, 3, 2, '#7d93b5');
        P(3, y + 15, 2, 2, skin);
        P(10, y + 15, 2, 2, skin);
      }

      ctx.restore();

      // 반응 아이콘
      if (h.mood) {
        const map = ICONS[h.mood.map] || null;
        const color = h.mood.color;
        if (map) {
          const w = map[0].length;
          drawIcon(map, bx + 7 - Math.floor(w / 2), top - 9 + Math.sin(clock * 0.006) * 1, color);
        }
      }
    }

    function draw(now, humans) {
      clock = now;
      ctx.clearRect(0, 0, W, H);
      drawSky();
      drawFar();
      drawNear();
      drawGround();
      drawProps();
      for (const h of humans) drawHuman(h);
      drawSill();
      // 저녁 노을
      if (theme.skyTop === '#6b5a86') {
        // eslint-disable-next-line no-unused-expressions
        const g = ctx.createLinearGradient(0, 60, 0, 140);
        g.addColorStop(0, 'rgba(255,150,90,.12)');
        g.addColorStop(1, 'rgba(90,40,90,.18)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 60, W, 80);
      }
    }

    return { setDay, draw };
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
    roundLabel: $('#round-label'),
    score: $('#score'),
    combo: $('#combo'),
    catWrap: $('#cat-wrap'),
    placard: $('#placard'),
    placardMark: $('#placard-mark'),
    timeFill: $('#timebar-fill'),
    bubble: $('#bubble'),
    bubbleText: $('#bubble-text'),
    float: $('#float-score'),
    dayCard: $('#day-card'),
    dayCardText: $('#day-card-text'),
    humanName: $('#human-name'),
    humanTag: $('#human-tag'),
    clues: $('#clues'),
    notes: $('#clue-notes'),
    judge: $('#judge'),
    verdict: $('#verdict'),
    verdictText: $('#verdict-text'),
    verdictWhy: $('#verdict-why'),
    next: $('#btn-next'),
    best: $('#best-line'),
    modal: $('#modal-help')
  };

  const HINT = '관찰 한 번에 <b>2초</b>가 흐른다. 다 볼지, 눈치로 갈지 골라라.';

  /* ─────────────── 게임 상태 ─────────────── */
  const WAIT_TIME = 16;          // 초
  const OBSERVE_COST = 2;        // 초
  const ROUNDS_PER_DAY = 4;

  const G = {
    day: 0,
    round: 0,
    queue: [],
    human: null,
    phase: 'idle',
    timeLeft: 0,
    observed: { smell: false, eyes: false, act: false },
    score: 0,
    correct: 0,
    streak: 0,
    maxCombo: 0,
    dayResults: [],
    results: [],
    humans: [],
    lastT: 0,
    autoNextTimer: 0,
    muted: !Sound.isOn()
  };

  function setScreen(name) {
    Object.entries(ui.screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  }

  function updateHud() {
    ui.dayLabel.textContent = DAYS[G.day].label;
    ui.roundLabel.textContent = `${Math.min(G.round + 1, ROUNDS_PER_DAY)}/${ROUNDS_PER_DAY}`;
    ui.score.textContent = G.score;
    if (G.streak >= 2) {
      ui.combo.hidden = false;
      ui.combo.textContent = `${G.streak}연속`;
    } else {
      ui.combo.hidden = true;
    }
  }

  function updateMuteBtn() {
    $('#btn-mute').textContent = Sound.isOn() ? '🔊' : '🔇';
  }

  function showBubble(text) {
    ui.bubbleText.textContent = text;
    ui.bubble.classList.add('show');
  }
  function hideBubble() { ui.bubble.classList.remove('show'); }

  function setNotes(html) { ui.notes.innerHTML = html; }

  function showPlacard(kind) {
    ui.placard.className = 'placard show ' + kind;
    ui.placardMark.textContent = kind === 'plus' ? '+' : kind === 'minus' ? '−' : '90';
    ui.catWrap.classList.add('raise');
  }
  function hidePlacard() {
    ui.placard.className = 'placard';
    ui.catWrap.classList.remove('raise');
  }

  function floatScore(text, bad) {
    ui.float.textContent = text;
    ui.float.className = 'float-score show' + (bad ? ' bad' : '');
    setTimeout(() => { ui.float.className = 'float-score'; }, 1100);
  }

  /* ─────────────── 하루 시작 ─────────────── */
  function startRun() {
    G.day = 0;
    G.round = 0;
    G.score = 0;
    G.correct = 0;
    G.streak = 0;
    G.maxCombo = 0;
    G.results = [];
    G.queue = shuffle(HUMANS).map((h, i) => ({ ...h, key: i }));

    // 하루 4명씩 나눠 담기
    const days = [[], [], []];
    G.queue.forEach((h, i) => days[i % 3].push(h));
    // 정답 성향이 몰리지 않게 섞기
    days.forEach(d => d.sort(() => Math.random() - 0.5));
    G.dayQueues = days.map(d => shuffle(d).slice(0, ROUNDS_PER_DAY));

    setScreen('game');
    startDay(0);
  }

  function startDay(dayIndex) {
    G.day = dayIndex;
    G.round = 0;
    G.dayResults = [];
    G.human = null;
    G.queue = G.dayQueues[dayIndex].slice();
    G.streak = 0;
    G.correctDay = 0;
    updateHud();
    setNotes(`<p class="hint">${HINT}</p>`);
    ui.humanName.textContent = '—';
    ui.humanTag.textContent = '';
    ui.judge.querySelectorAll('.sign').forEach(b => { b.disabled = true; });
    hideBubble();
    hidePlacard();
    ui.verdict.hidden = true;
    ui.judge.hidden = false;

    Scene.setDay(DAYS[dayIndex], 1000 + dayIndex * 77);

    ui.dayCardText.innerHTML = `<div>${DAYS[dayIndex].label}</div><div style="margin-top:6px">${DAYS[dayIndex].intro}</div>`;
    ui.dayCard.classList.add('show');
    G.phase = 'daycard';
    const dismiss = () => {
      if (G.phase !== 'daycard') return;
      G.phase = 'idle';
      ui.dayCard.classList.remove('show');
      ui.dayCard.removeEventListener('click', dismiss);
      Sound.meow();
      spawnHuman();
    };
    ui.dayCard.addEventListener('click', dismiss);
    setTimeout(dismiss, 2600);
  }

  function spawnHuman() {
    const data = G.queue[G.round];
    if (!data) return;
    G.human = {
      ...data,
      x: -26,
      dir: 1,
      phase: 0,
      moving: true,
      mood: null,
      blush: data.id === 'tsundere'
    };
    G.observed = { smell: false, eyes: false, act: false };
    G.timeLeft = WAIT_TIME;
    G.phase = 'enter';
    G.autoNextTimer = 0;
    ui.timeFill.style.width = '100%';
    ui.timeFill.classList.remove('low');

    ui.humanName.textContent = data.name;
    ui.humanTag.textContent = data.tag;
    ui.clues.querySelectorAll('.chip').forEach(chip => {
      chip.classList.remove('on', 'hit');
      chip.disabled = true;
    });
    setNotes(`<p class="hint">${HINT}</p>`);
    ui.verdict.hidden = true;
    ui.judge.hidden = false;
    ui.judge.querySelectorAll('.sign').forEach(b => { b.disabled = true; });
    hidePlacard();
    hideBubble();
    updateHud();
  }

  /* ─────────────── 관찰 ─────────────── */
  function observe(key) {
    if (G.phase !== 'decide' || G.observed[key]) return;
    const data = G.human;
    if (!data) return;
    G.observed[key] = true;
    G.timeLeft = Math.max(0.4, G.timeLeft - OBSERVE_COST);
    Sound.sniff();

    const chip = ui.clues.querySelector(`.chip[data-clue="${key}"]`);
    if (chip) {
      chip.classList.add('on', 'hit');
      chip.disabled = true;
      setTimeout(() => chip.classList.remove('hit'), 320);
    }

    const label = key === 'smell' ? '냄새' : key === 'eyes' ? '눈빛' : '행동';
    const notes = ui.notes.querySelectorAll('p');
    const hintP = ui.notes.querySelector('.hint');
    if (hintP) hintP.remove();
    const p = document.createElement('p');
    p.innerHTML = `<span class="k">${label}</span>${data.clues[key]}`;
    ui.notes.appendChild(p);
    ui.notes.scrollTop = ui.notes.scrollHeight;
    if (notes.length > 3) notes[0].remove();

    // 관찰할 때마다 고양이가 냄새 맡는 모션
    ui.catWrap.style.transform = 'translateY(1px)';
    setTimeout(() => { ui.catWrap.style.transform = ''; }, 160);
  }

  /* ─────────────── 판정 ─────────────── */
  function judge(choice) {
    if (G.phase !== 'decide') return;
    const data = G.human;
    if (!data) return;

    G.phase = 'judged';
    ui.judge.hidden = true;
    ui.clues.querySelectorAll('.chip').forEach(chip => { chip.disabled = true; });
    hideBubble();

    const isRight = choice === data.truth;
    showPlacard(choice);
    Sound.slap();

    // 인간 반응
    G.human.moving = false;
    G.human.mood = choice === 'plus'
      ? { map: 'heart', color: '#d9646b' }
      : choice === 'minus'
        ? { map: 'drop', color: '#5f8ac0' }
        : { map: 'q', color: '#c9a13c' };

    let gained = 0;
    if (isRight) {
      G.correct += 1;
      G.correctDay += 1;
      G.streak += 1;
      G.maxCombo = Math.max(G.maxCombo, G.streak);
      gained = 100 + Math.min(100, (G.streak - 1) * 20);
      G.score += gained;
      floatScore(`+${gained}`);
      setTimeout(() => Sound.ok(), 140);
    } else {
      G.streak = 0;
      G.score += 40;
      floatScore('+40', true);
      setTimeout(() => Sound.ng(), 140);
    }

    G.results.push({ id: data.id, choice, right: isRight });
    G.dayResults.push({ id: data.id, right: isRight, missed: false });

    ui.verdictText.className = 'verdict-text ' + (isRight ? 'ok' : 'ng');
    ui.verdictText.textContent = data.lines[choice];
    ui.verdictWhy.textContent = isRight ? '' : `구공이의 속내 — ${data.why}`;
    ui.verdict.hidden = false;
    ui.next.textContent = (G.round + 1 >= ROUNDS_PER_DAY && G.day + 1 >= DAYS.length)
      ? '심사 마감 →'
      : (G.round + 1 >= ROUNDS_PER_DAY ? `${G.day + 2}일차로 →` : '다음 인간 →');

    updateHud();

    // 5초 뒤 자동 진행
    G.autoNextTimer = 5.2;
  }

  function missHuman() {
    if (G.phase !== 'decide') return;
    const data = G.human;
    G.phase = 'judged';
    G.streak = 0;
    ui.judge.hidden = true;
    ui.clues.querySelectorAll('.chip').forEach(chip => { chip.disabled = true; });
    hideBubble();
    Sound.miss();
    G.dayResults.push({ id: data.id, right: false, missed: true });
    G.results.push({ id: data.id, choice: null, right: false, missed: true });

    ui.verdictText.className = 'verdict-text ng';
    ui.verdictText.textContent = '놓쳤다. 인간이 골목을 지나갔다. 고양이는 안 본 척할 수는 있어도, 못 본 건 못 본 것이다.';
    ui.verdictWhy.textContent = `구공이의 속내 — ${data.why}`;
    ui.verdict.hidden = false;
    ui.next.textContent = (G.round + 1 >= ROUNDS_PER_DAY && G.day + 1 >= DAYS.length)
      ? '심사 마감 →'
      : (G.round + 1 >= ROUNDS_PER_DAY ? `${G.day + 2}일차로 →` : '다음 인간 →');
    G.autoNextTimer = 4.4;
    updateHud();
  }

  function nextStep() {
    if (G.phase !== 'judged') return;
    G.autoNextTimer = 0;
    const last = G.round + 1 >= ROUNDS_PER_DAY;

    if (last) {
      if (G.day + 1 >= DAYS.length) {
        endRun();
      } else {
        endDay();
      }
      return;
    }

    // 이번 인간은 걸어서 퇴장, 다 나가면 다음 인간 등장
    ui.verdict.hidden = true;
    hidePlacard();
    G.phase = 'leave';
  }

  function endDay() {
    G.phase = 'dayend';
    hidePlacard();
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
    hidePlacard();
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
  let rafId = null;

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!G.lastT) G.lastT = now;
    let dt = (now - G.lastT) / 1000;
    G.lastT = now;
    if (dt > 0.25) dt = 0.25;

    const h = G.human;
    if (h) {
      if (G.phase === 'enter') {
        h.moving = true;
        h.x += 48 * dt;
        h.phase += dt * 5.5;
        if (h.x >= 92) {
          h.x = 92;
          h.moving = false;
          G.phase = 'decide';
          G.timeLeft = WAIT_TIME;
          ui.clues.querySelectorAll('.chip').forEach(c => { c.disabled = false; });
          ui.judge.querySelectorAll('.sign').forEach(b => { b.disabled = false; });
          showBubble(h.bubble);
          Sound.tap();
        }
      } else if (G.phase === 'decide') {
        h.phase += dt * 2;
        G.timeLeft -= dt;
        if (G.timeLeft <= 0) {
          G.timeLeft = 0;
          missHuman();
        }
      } else if (G.phase === 'judged') {
        h.phase += dt * 2;
        if (G.autoNextTimer > 0) {
          G.autoNextTimer -= dt;
          if (G.autoNextTimer <= 0) { G.autoNextTimer = 0; nextStep(); }
        }
      } else if (G.phase === 'leave') {
        h.moving = true;
        h.x += 62 * dt;
        h.phase += dt * 5.5;
        if (h.x > 258) {
          G.round += 1;
          G.phase = 'idle';
          spawnHuman();
        }
      }
    }

    // 공통 애니메이션
    G.humans = h && (G.phase !== 'dayend' && G.phase !== 'final') ? [h] : [];

    if (G.phase === 'decide' || G.phase === 'enter') {
      const ratio = clamp(G.timeLeft / WAIT_TIME, 0, 1);
      ui.timeFill.style.width = (ratio * 100).toFixed(1) + '%';
      ui.timeFill.classList.toggle('low', ratio < 0.28);
    }

    Scene.draw(now, G.humans);
  }

  /* ─────────────── 이벤트 ─────────────── */
  function bind() {
    $('#btn-start').addEventListener('click', () => { Sound.meow(); startRun(); });
    $('#btn-howto').addEventListener('click', () => { ui.modal.hidden = false; });
    $('#btn-help').addEventListener('click', () => { ui.modal.hidden = false; });
    $('#btn-close-help').addEventListener('click', () => { ui.modal.hidden = true; Sound.tap(); });
    ui.modal.addEventListener('click', (e) => { if (e.target === ui.modal) ui.modal.hidden = true; });

    $('#btn-mute').addEventListener('click', () => {
      Sound.set(!Sound.isOn());
      updateMuteBtn();
      if (Sound.isOn()) Sound.tap();
    });

    ui.clues.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      observe(chip.dataset.clue);
    });

    ui.judge.addEventListener('click', (e) => {
      const btn = e.target.closest('.sign');
      if (!btn) return;
      judge(btn.dataset.judge);
    });

    ui.next.addEventListener('click', () => { Sound.tap(); nextStep(); });

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
      } catch (e) {
        $('#btn-share').textContent = '복사 실패';
      }
      setTimeout(() => { $('#btn-share').textContent = '결과 복사'; }, 1600);
    });

    document.addEventListener('keydown', (e) => {
      if (G.phase === 'decide') {
        if (e.key === '1' || e.key === 'q') observe('smell');
        if (e.key === '2' || e.key === 'w') observe('eyes');
        if (e.key === '3' || e.key === 'e') observe('act');
        if (e.key === '+' || e.key === 'a') judge('plus');
        if (e.key === '-' || e.key === 's') judge('minus');
        if (e.key === '9' || e.key === 'd') judge('ninety');
      } else if (G.phase === 'judged' && (e.key === 'Enter' || e.key === ' ')) {
        nextStep();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.autoNextTimer = Math.max(G.autoNextTimer, 0.1);
      G.lastT = 0;
    });

    // 화면 회전·크기 변경 시 캔버스 픽셀 유지 (CSS가 처리, 상태만 초기화)
    window.addEventListener('orientationchange', () => { G.lastT = 0; });
  }

  /* ─────────────── 초기화 ─────────────── */
  function init() {
    const best = store.get('gugoong.best', null);
    if (best) ui.best.textContent = `최고 기록 · ${best.score} 냥력 (${best.title})`;
    updateMuteBtn();
    Scene.setDay(DAYS[0], 1000);
    bind();
    updateHud();
    rafId = requestAnimationFrame(loop);
  }

  init();
})();
