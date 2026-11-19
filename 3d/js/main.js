/* 구공이 3D 미니 탐험판 — 메인 */
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Gugoong } from './cat.js';
import { buildNpcs } from './npcs.js';
import { Sfx } from './audio.js';
import { popupTexture } from './gfx.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const DEFAULT_HINT = '화면 왼쪽을 <b>드래그</b>해 걷고, <b>바닥을 톡</b> 누르면 그쪽으로 간다.';

const ui = {
  canvas: $('scene'),
  boot: $('boot'),
  title: $('title'),
  done: $('done'),
  help: $('help'),
  fade: $('fade'),
  hint: $('hint'),
  caption: $('caption'),
  capName: $('cap-name'),
  capLine: $('cap-line'),
  gradeBtn: $('btn-grade'),
  gradeTarget: $('grade-target'),
  progText: $('prog-text'),
  dots: $('dots'),
  areaName: $('area-name'),
  sound: $('btn-sound'),
  stick: $('stick'),
  stickKnob: $('stick-knob'),
  statDist: $('stat-dist'),
};

const state = {
  started: false,
  area: 'room',
  graded: 0,
  near: null,
  distance: 0,
  time: 0,
  visitedAlley: false,
  moving: false,
  speedRatio: 0,
  grading: false,
};

const sfx = new Sfx();

class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.world = null;
    this.cat = null;
    this.npcs = [];
    this.colliders = [];
    this.cam = {
      yaw: 0,
      pitch: 0.36,
      dist: 4.3,
      cur: new THREE.Vector3(),
      look: new THREE.Vector3(),
      init: false,
      lastDrag: -9999,
    };
    this.input = { jx: 0, jy: 0, keys: new Set(), target: null };
    this.pointers = new Map();
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.faceYaw = null;
    this.faceUntil = 0;
    this.stepTimer = 0;
    this.popupT = -1;
    this.capTimer = null;
    this.tapRing = null;
    this.tapRingT = -1;
    this.stuckT = 0;
    this.lastPos = new THREE.Vector3();
    this.lastTick = 0;
  }

  async init() {
    // 픽셀 폰트가 준비된 뒤 캔버스 텍스처를 그린다
    try {
      await Promise.race([
        document.fonts.load('700 40px Galmuri11').then(() => document.fonts.ready),
        new Promise((r) => setTimeout(r, 1600)),
      ]);
    } catch (e) {
      /* 폰트 실패 시 시스템 폰트로 그린다 */
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: ui.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf3d9b8, 26, 70);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.05, 220);

    this.world = buildWorld();
    this.scene.add(this.world.root);
    this.colliders = this.world.colliders;

    this.cat = new Gugoong();
    this.cat.root.position.set(0.9, 0, -6.6);
    this.cat.root.rotation.y = Math.PI;
    this.scene.add(this.cat.root);

    this.npcs = buildNpcs(this.scene);
    // 사람 몸통도 통과하지 못하게
    for (const n of this.npcs) {
      const [x, z] = n.def.pos;
      this.colliders.push({ minX: x - 0.28, maxX: x + 0.28, minZ: z - 0.28, maxZ: z + 0.28 });
    }

    this.buildPopup();
    this.buildTapRing();
    this.buildDots();
    this.bindEvents();
    this.resize();

    // 첫 프레임
    this.update(0, 0);
    this.renderer.render(this.scene, this.camera);
    ui.boot.classList.add('off');
    setTimeout(() => { ui.boot.hidden = true; }, 500);
    window.__ggReady = true;
    window.__gg = this;
    this.state = state;

    this.lastTick = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildDots() {
    ui.dots.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('i');
      ui.dots.appendChild(d);
    }
  }

  buildPopup() {
    const mat = new THREE.SpriteMaterial({
      map: popupTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.3, 0.65, 1);
    s.visible = false;
    s.renderOrder = 22;
    this.scene.add(s);
    this.popup = s;
    this.popupBase = new THREE.Vector3();
  }

  buildTapRing() {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.4, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff6e4, transparent: true, opacity: 0, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    this.scene.add(m);
    this.tapRing = m;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = h > w;
    this.camera.fov = portrait ? 60 : 55;
    this.cam.dist = portrait ? 5.1 : 4.3;
    this.cam.pitch = portrait ? 0.4 : 0.36;
    this.camera.updateProjectionMatrix();
  }

  /* ───────── 입력 ───────── */
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    const canvas = ui.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (!state.started) return;
      sfx.unlock();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      const rect = canvas.getBoundingClientRect();
      const p = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        t0: performance.now(),
        mode: 'pending',
        moved: 0,
        touch: e.pointerType !== 'mouse',
        rect,
      };
      if (p.touch && e.clientX - rect.left < rect.width * 0.45) {
        p.mode = 'stick';
        this.showStick(e.clientX, e.clientY, 0, 0);
      }
      this.pointers.set(e.pointerId, p);
      this.input.target = null;
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      p.moved = Math.max(p.moved, Math.hypot(dx, dy));
      if (p.mode === 'pending' && p.moved > 9) p.mode = 'cam';

      if (p.mode === 'stick') {
        const max = 52;
        let vx = (e.clientX - p.x0) / max;
        let vy = (e.clientY - p.y0) / max;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }
        this.input.jx = vx;
        this.input.jy = -vy;
        this.showStick(p.x0, p.y0, vx, vy);
      } else if (p.mode === 'cam') {
        this.cam.yaw -= (e.clientX - p.x) * 0.006;
        this.cam.pitch = clamp(this.cam.pitch + (e.clientY - p.y) * 0.0035, 0.05, 0.86);
        this.cam.lastDrag = performance.now();
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });

    const endPointer = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (p.mode === 'pending' && p.moved < 10 && performance.now() - p.t0 < 600) {
        this.tapMove(e.clientX, e.clientY);
      }
      if (p.mode === 'stick') {
        this.input.jx = 0;
        this.input.jy = 0;
        ui.stick.hidden = true;
      }
      this.pointers.delete(e.pointerId);
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p && p.mode === 'stick') {
        this.input.jx = 0;
        this.input.jy = 0;
        ui.stick.hidden = true;
      }
      this.pointers.delete(e.pointerId);
    });

    window.addEventListener('keydown', (e) => {
      const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'];
      if (codes.includes(e.code)) e.preventDefault();
      if (!state.started) {
        if (e.code === 'Enter' || e.code === 'Space') this.start();
        return;
      }
      this.input.keys.add(e.code);
      if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) this.tryGrade();
      if (e.code === 'KeyR') this.reset();
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));

    // UI
    $('btn-start').addEventListener('click', () => this.start());
    $('btn-howto').addEventListener('click', () => { ui.help.hidden = false; });
    $('btn-close-help').addEventListener('click', () => { ui.help.hidden = true; });
    $('btn-help').addEventListener('click', () => {
      sfx.unlock();
      ui.help.hidden = false;
    });
    $('btn-again').addEventListener('click', () => this.reset(true));
    $('btn-walk').addEventListener('click', () => {
      ui.done.hidden = true;
      state.started = true;
      this.input.keys.clear();
      this.cam.lastDrag = performance.now();
    });
    ui.gradeBtn.addEventListener('click', () => this.tryGrade());

    ui.sound.addEventListener('click', () => {
      sfx.unlock();
      sfx.setEnabled(!sfx.enabled);
      this.syncSound();
      if (sfx.enabled) sfx.tap();
    });
    this.syncSound();

    // 첫 터치에서 오디오 열기
    window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

    ui.caption.addEventListener('click', () => this.hideCaption());
  }

  syncSound() {
    ui.sound.textContent = sfx.enabled ? '🔊' : '🔇';
    ui.sound.classList.toggle('off', !sfx.enabled);
  }

  showStick(x, y, vx, vy) {
    ui.stick.hidden = false;
    ui.stick.style.left = x + 'px';
    ui.stick.style.top = y + 'px';
    ui.stickKnob.style.transform = `translate(${vx * 32}px, ${vy * 32}px)`;
  }

  start() {
    sfx.unlock();
    sfx.tap();
    state.started = true;
    ui.title.classList.add('gone');
    setTimeout(() => { ui.title.hidden = true; }, 460);
    this.showToast('문 밖 골목길까지 이어진다. 발도장을 따라가 봐.', 3600);
    this.cam.lastDrag = performance.now();
  }

  /* ───────── 이동 ───────── */
  blocked(x, z) {
    const R = 0.34;
    for (const c of this.colliders) {
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < R * R) return true;
    }
    return false;
  }

  tapMove(cx, cy) {
    const rect = ui.canvas.getBoundingClientRect();
    this.ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.raycaster.near = 0;
    this.raycaster.far = 80;
    const hits = this.raycaster.intersectObjects(this.world.groundPick, false);
    if (!hits.length) return;
    const p = hits[0].point;
    const pos = this.cat.root.position;
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d < 0.5 || d > 18) return;
    if (this.blocked(p.x, p.z)) return;
    this.input.target = new THREE.Vector2(p.x, p.z);
    this.stuckT = 0;
    // 탭 표시
    this.tapRing.position.set(p.x, 0.02, p.z);
    this.tapRingT = 0;
    sfx.tap();
  }

  /* ───────── 채점 ───────── */
  updateNear() {
    const pos = this.cat.root.position;
    let best = null;
    for (const n of this.npcs) {
      if (n.graded) continue;
      const d = Math.hypot(pos.x - n.def.pos[0], pos.z - n.def.pos[1]);
      if (d < 2.55 && (!best || d < best.d)) best = { npc: n, d };
    }
    const current = state.near && state.near.npc;
    const next = best && best.npc;
    state.near = best;
    if (current !== next) {
      if (next) {
        ui.gradeTarget.textContent = next.def.name + ' · ' + next.def.tag;
        ui.gradeBtn.hidden = false;
        ui.hint.style.opacity = '0';
      } else {
        ui.gradeBtn.hidden = true;
        ui.hint.style.opacity = '1';
      }
    }
  }

  tryGrade() {
    const near = state.near;
    if (!near || !state.started) return;
    const npc = near.npc;
    if (npc.graded || state.grading) return;
    state.grading = true;
    npc.graded = true;
    state.graded += 1;

    this.cat.grade();
    this.faceYaw = Math.atan2(npc.def.pos[0] - this.cat.root.position.x, npc.def.pos[1] - this.cat.root.position.z);
    this.faceUntil = performance.now() + 700;
    sfx.grade();

    // 머리 위 90점 팝업
    const headY = (npc.def.seatY ? 1.35 : 1.85) * (npc.def.scale ?? 1);
    this.popupBase.set(npc.def.pos[0], headY + 0.85, npc.def.pos[1]);
    this.popup.position.copy(this.popupBase);
    this.popup.visible = true;
    this.popup.material.opacity = 0;
    this.popup.scale.set(1.3, 0.65, 1);
    this.popupT = 0;

    this.showCaption(npc.def.name, npc.def.line);
    this.updateHud();

    if (state.graded === 6) {
      setTimeout(() => this.complete(), 1900);
    }
    setTimeout(() => { state.grading = false; }, 950);
  }

  showCaption(name, line) {
    ui.capName.textContent = name + ' · 90점';
    ui.capLine.textContent = line;
    ui.caption.hidden = false;
    requestAnimationFrame(() => ui.caption.classList.add('show'));
    clearTimeout(this.capTimer);
    this.capTimer = setTimeout(() => this.hideCaption(), 14000);
  }

  hideCaption() {
    ui.caption.classList.remove('show');
    clearTimeout(this.capTimer);
    setTimeout(() => {
      if (!ui.caption.classList.contains('show')) ui.caption.hidden = true;
    }, 280);
  }

  updateHud() {
    ui.progText.textContent = `채점 ${state.graded}/6`;
    Array.from(ui.dots.children).forEach((d, i) => d.classList.toggle('on', i < state.graded));
  }

  complete() {
    ui.statDist.textContent = Math.round(state.distance) + 'm';
    ui.done.hidden = false;
    ui.done.classList.add('gone');
    requestAnimationFrame(() => ui.done.classList.remove('gone'));
    state.started = false;
    sfx.complete();
  }

  reset(full = false) {
    const pos = this.cat.root.position;
    pos.set(0.9, 0, -6.6);
    this.cat.root.rotation.y = Math.PI;
    this.cat.gradeT = -1;
    this.cat.root.position.y = 0;
    this.cam.yaw = 0;
    this.cam.pitch = 0.36;
    this.cam.init = false;
    this.input.target = null;
    this.input.jx = 0;
    this.input.jy = 0;
    this.input.keys.clear();
    this.faceYaw = null;
    state.graded = 0;
    state.distance = 0;
    state.grading = false;
    state.near = null;
    state.visitedAlley = false;
    state.area = 'room';
    ui.areaName.textContent = '집 안';
    this.updateHud();
    this.hideCaption();
    ui.gradeBtn.hidden = true;
    ui.hint.style.opacity = '1';
    ui.done.hidden = true;
    if (!full) ui.done.hidden = true;
    ui.done.hidden = true;

    for (const n of this.npcs) {
      n.graded = false;
      n.badge.material.opacity = 0;
      n.ring.visible = true;
    }
    this.popup.visible = false;
    this.popupT = -1;
    state.started = true;
    this.cam.lastDrag = performance.now();
    this.showToast('처음부터 다시. 발도장을 따라가 봐.', 2600);
  }

  showToast(text, ms = 3000) {
    const el = $('hint');
    el.innerHTML = text;
    el.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.innerHTML = DEFAULT_HINT;
    }, ms);
  }

  lerpAngle(a, b, t) {
    return a + wrapAngle(b - a) * t;
  }

  /* ───────── 프레임 ───────── */
  loop(now) {
    const dt = Math.min((now - this.lastTick) / 1000, 0.05);
    this.lastTick = now;
    state.time += dt;
    try {
      this.update(dt, state.time);
      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      window.__ggErrors.push('frame: ' + (err && err.message));
      throw err;
    }
    requestAnimationFrame(this.loop);
  }

  update(dt, t) {
    const cat = this.cat;
    const pos = cat.root.position;

    /* 입력 → 방향 */
    const keys = this.input.keys;
    const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const kf = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    let ix = this.input.jx + kx;
    let iy = this.input.jy + kf;
    let mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }

    let dirX = 0;
    let dirZ = 0;
    let speed = 0;

    if (state.started && mag > 0.06) {
      const fX = -Math.sin(this.cam.yaw);
      const fZ = -Math.cos(this.cam.yaw);
      const rX = Math.cos(this.cam.yaw);
      const rZ = -Math.sin(this.cam.yaw);
      dirX = fX * iy + rX * ix;
      dirZ = fZ * iy + rZ * ix;
      const dl = Math.hypot(dirX, dirZ);
      if (dl > 0.0001) { dirX /= dl; dirZ /= dl; }
      speed = 3.05 * clamp(mag * 1.15, 0.35, 1);
      this.input.target = null;
    } else if (state.started && this.input.target) {
      const dx = this.input.target.x - pos.x;
      const dz = this.input.target.y - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.32) {
        this.input.target = null;
      } else {
        dirX = dx / d;
        dirZ = dz / d;
        speed = Math.min(3.05, 1.2 + d * 0.9);
      }
    }

    /* 이동 + 충돌 */
    const prevX = pos.x;
    const prevZ = pos.z;
    if (speed > 0.01) {
      const stepX = dirX * speed * dt;
      const stepZ = dirZ * speed * dt;
      let moved = false;
      if (!this.blocked(pos.x + stepX, pos.z)) { pos.x += stepX; moved = true; }
      if (!this.blocked(pos.x, pos.z + stepZ)) { pos.z += stepZ; moved = true; }

      if (this.input.target && !moved) {
        this.stuckT += dt;
        if (this.stuckT > 0.5) this.input.target = null;
      } else {
        this.stuckT = 0;
      }

      // 방향 전환
      if (this.faceYaw === null) {
        const targetYaw = Math.atan2(dirX, dirZ);
        cat.root.rotation.y = this.lerpAngle(cat.root.rotation.y, targetYaw, Math.min(1, dt * 11));
      }
      state.moving = true;
      state.speedRatio = speed / 3.05;

      // 발소리
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        sfx.step();
        this.stepTimer = 0.33;
      }
    } else {
      state.moving = false;
      state.speedRatio = 0;
      this.stuckT = 0;
    }
    state.distance += Math.hypot(pos.x - prevX, pos.z - prevZ);

    // 채점 중 강제로 인간 쪽 보기
    if (this.faceYaw !== null) {
      if (performance.now() < this.faceUntil) {
        cat.root.rotation.y = this.lerpAngle(cat.root.rotation.y, this.faceYaw, Math.min(1, dt * 14));
      } else {
        this.faceYaw = null;
      }
    }

    /* 가까운 인간 */
    this.updateNear();

    /* 고양이 애니메이션 */
    let lookYaw = 0;
    if (state.near && state.near.d < 4.5) {
      const n = state.near.npc;
      const ang = Math.atan2(n.def.pos[0] - pos.x, n.def.pos[1] - pos.z);
      lookYaw = clamp(wrapAngle(ang - cat.root.rotation.y), -0.65, 0.65);
    }
    cat.update(dt, t, { moving: state.moving, speed: state.speedRatio, lookYaw });

    /* NPC 표정 · 이름표 · 배지 */
    for (const n of this.npcs) {
      const dx = pos.x - n.def.pos[0];
      const dz = pos.z - n.def.pos[1];
      const d = Math.hypot(dx, dz);

      // 고개 돌리기
      const rel = clamp(wrapAngle(Math.atan2(dx, dz) - n.baseRotY), -0.6, 0.6);
      n.person.head.rotation.y += ((d < 5.5 ? rel : 0) - n.person.head.rotation.y) * Math.min(1, dt * 5);
      n.group.position.y = (n.def.seatY !== undefined ? n.def.seatY - 0.82 * (n.def.scale ?? 1) : 0)
        + Math.sin(t * 1.6 + n.phase) * 0.006;

      // 이름표
      const wantOpacity = n.graded ? 0 : d < 7.5 ? (d < 3.4 ? 1 : 0.9) : 0;
      const mat = n.nameSprite.material;
      mat.opacity += (wantOpacity - mat.opacity) * Math.min(1, dt * 6);

      // 링
      n.ring.visible = !n.graded;
      if (!n.graded) {
        n.ring.material.opacity = 0.32 + Math.sin(t * 2.6 + n.phase) * 0.16;
        const s = 1 + Math.sin(t * 2.6 + n.phase) * 0.04;
        n.ring.scale.set(s, s, s);
      }

      // 배지
      const wantBadge = n.graded ? 1 : 0;
      n.badge.material.opacity += (wantBadge - n.badge.material.opacity) * Math.min(1, dt * 5);
      n.badge.position.y = (n.def.seatY ? 1.55 : 1.95) * (n.def.scale ?? 1) + 0.32 + Math.sin(t * 2 + n.phase) * 0.035;
    }

    /* 팝업 */
    if (this.popupT >= 0) {
      this.popupT += dt;
      const p = this.popupT / 1.5;
      if (p >= 1) {
        this.popupT = -1;
        this.popup.visible = false;
      } else {
        const pop = Math.min(1, p * 5);
        const ease = 1 - Math.pow(1 - pop, 3);
        const sc = 0.55 + 0.45 * ease + Math.sin(p * Math.PI) * 0.06;
        this.popup.scale.set(1.3 * sc, 0.65 * sc, 1);
        this.popup.position.set(this.popupBase.x, this.popupBase.y + p * 0.95, this.popupBase.z);
        this.popup.material.opacity = p < 0.72 ? 1 : clamp(1 - (p - 0.72) / 0.28, 0, 1);
      }
    }

    /* 탭 링 */
    if (this.tapRingT >= 0) {
      this.tapRingT += dt;
      const p = this.tapRingT / 0.65;
      if (p >= 1) {
        this.tapRingT = -1;
        this.tapRing.material.opacity = 0;
      } else {
        this.tapRing.material.opacity = 0.7 * (1 - p);
        const s = 0.7 + p * 0.9;
        this.tapRing.scale.set(s, s, s);
      }
    }

    /* 구역 전환 */
    const inRoom = pos.z < 0;
    const area = inRoom ? 'room' : 'alley';
    if (area !== state.area) {
      state.area = area;
      ui.areaName.textContent = inRoom ? '집 안' : '골목길';
      ui.fade.classList.add('on');
      setTimeout(() => ui.fade.classList.remove('on'), 170);
      sfx.whoosh();
      if (!inRoom && !state.visitedAlley) {
        state.visitedAlley = true;
        this.showToast('골목길. 우체통, 상자, 가로등 너머로 인간들이 서 있다.', 4200);
      }
    }

    /* 카메라 */
    this.updateCamera(dt);

    /* 월드 애니메이션 */
    this.world.update(dt, t);
  }

  updateCamera(dt) {
    const pos = this.cat.root.position;
    const cam = this.cam;

    // 앞으로 걸으면 카메라가 뒤로 따라온다
    const moving = state.moving && Math.hypot(this.input.jx, this.input.jy) > 0.25;
    if (moving && performance.now() - cam.lastDrag > 1500) {
      const behind = this.cat.root.rotation.y + Math.PI;
      cam.yaw = this.lerpAngle(cam.yaw, behind, Math.min(1, dt * 1.4));
    }

    const target = new THREE.Vector3(pos.x, 1.0, pos.z);
    const cp = Math.cos(cam.pitch);
    const offset = new THREE.Vector3(
      Math.sin(cam.yaw) * cp,
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * cp
    ).multiplyScalar(cam.dist);

    let desired = target.clone().add(offset);
    const dir = desired.clone().sub(target);
    const len = dir.length();
    dir.normalize();
    this.raycaster.set(target, dir);
    this.raycaster.far = len;
    const hits = this.raycaster.intersectObjects(this.world.occluders, false);
    if (hits.length) {
      const d = Math.max(1.25, hits[0].distance - 0.28);
      desired = target.clone().add(dir.multiplyScalar(d));
    }
    if (desired.y < 0.55) desired.y = 0.55;

    if (!cam.init) {
      cam.cur.copy(desired);
      cam.look.copy(target);
      cam.init = true;
    }
    cam.cur.lerp(desired, 1 - Math.exp(-10 * dt));
    cam.look.lerp(new THREE.Vector3(pos.x, 1.02, pos.z), 1 - Math.exp(-13 * dt));

    this.camera.position.copy(cam.cur);
    this.camera.lookAt(cam.look);
  }
}

/* 부트 */
(async () => {
  try {
    const g = new Game();
    await g.init();
  } catch (err) {
    window.__ggErrors.push('init: ' + (err && err.message));
    const boot = $('boot');
    if (boot) {
      boot.innerHTML = '<span>3D를 시작하지 못했다. (WebGL 확인) </span><button onclick="location.reload()">다시 시도</button>';
    }
    console.error(err);
  }
})();
