/* 구공이 3D 미니 탐험판 — 메인
   1인칭 고양이 시점 · 사람을 관찰하고 장난치기 */
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Gugoong } from './cat.js';
import { buildNpcs } from './npcs.js';
import { Sfx } from './audio.js';
import { shoutTexture } from './gfx.js';
import { Viewmodel } from './viewmodel.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const EYE_H = 0.4; // 고양이 눈높이 (바닥에서 40cm)
const TOTAL = 6;
const DEFAULT_HINT =
  '화면 왼쪽을 <b>드래그</b>해 걷고, 오른쪽을 <b>드래그</b>해 둘러본다. 바닥을 <b>톡</b> 누르면 그쪽으로.';

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
  actions: $('actions'),
  actionWho: $('action-target'),
  prankKind: $('prank-kind'),
  btnObserve: $('btn-observe'),
  btnPrank: $('btn-prank'),
  progText: $('prog-text'),
  dots: $('dots'),
  areaName: $('area-name'),
  sound: $('btn-sound'),
  stick: $('stick'),
  stickKnob: $('stick-knob'),
  statDist: $('stat-dist'),
  statPrank: $('stat-prank'),
  statObserve: $('stat-observe'),
  viewseg: $('viewseg'),
  btnObserve2: null,
};

const state = {
  started: false,
  area: 'room',
  pranks: 0,
  observed: new Set(),
  near: null,
  nearKey: '',
  distance: 0,
  time: 0,
  visitedAlley: false,
  moving: false,
  speedRatio: 0,
  acting: false,
};

const sfx = new Sfx();

class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.world = null;
    this.cat = null;
    this.vm = null;
    this.npcs = [];
    this.colliders = [];

    this.cam = {
      mode: 'first', // 시작은 언제나 1인칭
      yaw: 0,
      fpPitch: 0.07,
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
    this.fpFaceYaw = null;
    this.fpFaceUntil = 0;
    this.fpLift = 0;
    this.fpGrade = { t: -1 };
    this.prankFx = { t: -1, kind: '', npc: null };
    this.observeT = -1;

    this.stepTimer = 0;
    this.shoutT = -1;
    this.capTimer = null;
    this.tapRing = null;
    this.tapRingT = -1;
    this.stuckT = 0;
    this.lastTick = 0;
    this.shoutCache = new Map();
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

    this.camera = new THREE.PerspectiveCamera(64, 1, 0.05, 220);

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
      this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }

    // 1인칭 뷰모델 (입에 문 90 팻말 끝 · 앞발 · 수염)
    this.vm = new Viewmodel();

    this.buildShout();
    this.buildTapRing();
    this.buildDots();
    this.bindEvents();
    this.setView('first', true);
    this.resize();

    // 첫 프레임
    this.update(0, 0);
    this.renderFrame();
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
    for (let i = 0; i < TOTAL; i++) {
      const d = document.createElement('i');
      ui.dots.appendChild(d);
    }
  }

  buildShout() {
    const mat = new THREE.SpriteMaterial({
      map: shoutTexture('헉!'),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.0, 0.5, 1);
    s.visible = false;
    s.renderOrder = 22;
    this.scene.add(s);
    this.shout = s;
    this.shoutBase = new THREE.Vector3();
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
    const first = this.cam.mode === 'first';
    this.camera.fov = first ? (portrait ? 68 : 62) : (portrait ? 60 : 55);
    this.cam.dist = portrait ? 5.7 : 4.3;
    this.camera.near = first ? 0.05 : 0.06;
    this.camera.updateProjectionMatrix();
    if (this.vm) this.vm.layout(this.camera.fov, w / h);
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
      if (p.touch && e.clientX - rect.left < rect.width * 0.42) {
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
        const ddx = e.clientX - p.x;
        const ddy = e.clientY - p.y;
        this.cam.yaw -= ddx * (this.cam.mode === 'first' ? 0.0055 : 0.006);
        if (this.cam.mode === 'first') {
          this.cam.fpPitch = clamp(this.cam.fpPitch - ddy * 0.0032, -0.66, 0.95);
        } else {
          this.cam.pitch = clamp(this.cam.pitch + ddy * 0.0035, 0.05, 0.86);
        }
        this.cam.lastDrag = performance.now();
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });

    const endPointer = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const quick = performance.now() - p.t0 < 620;
      if (p.mode === 'pending' && p.moved < 10 && quick) {
        this.tapMove(e.clientX, e.clientY);
      }
      if (p.mode === 'stick') {
        // 왼쪽을 살짝 톡 치면 그쪽으로 걸어간다
        if (p.moved < 10 && quick) this.tapMove(e.clientX, e.clientY);
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
      const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyV'];
      if (codes.includes(e.code)) e.preventDefault();
      if (!state.started) {
        if (e.code === 'Enter' || e.code === 'Space') this.start();
        return;
      }
      this.input.keys.add(e.code);
      if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) this.prank();
      if (e.code === 'KeyQ' && !e.repeat) this.observe();
      if (e.code === 'KeyV' && !e.repeat) this.setView(this.cam.mode === 'first' ? 'third' : 'first');
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
    ui.btnObserve.addEventListener('click', () => this.observe());
    ui.btnPrank.addEventListener('click', () => this.prank());

    if (ui.viewseg) {
      ui.viewseg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !b.dataset.view) return;
        if (b.dataset.view === this.cam.mode) return;
        this.setView(b.dataset.view);
      });
    }

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

  /* ───────── 시점 전환 ───────── */
  setView(mode, silent = false) {
    const first = mode === 'first';
    this.cam.mode = first ? 'first' : 'third';
    this.cam.yaw = wrapAngle(this.cat.root.rotation.y + Math.PI);
    this.cam.fpPitch = 0.07;
    this.cam.pitch = 0.36;
    this.cam.init = false;
    this.cat.root.visible = !first;
    this.resize();

    if (ui.viewseg) {
      for (const b of ui.viewseg.children) {
        b.classList.toggle('on', b.dataset.view === this.cam.mode);
        b.setAttribute('aria-pressed', String(b.dataset.view === this.cam.mode));
      }
    }
    if (!silent) {
      sfx.tap();
      this.showToast(
        first
          ? '고양이 눈높이 40cm. 이제 네가 구공이다. 사람들을 올려다보고, 발목을 노려라.'
          : '3인칭. 구공이를 뒤에서 바라본다.',
        2800
      );
    }
  }

  start() {
    sfx.unlock();
    sfx.tap();
    state.started = true;
    ui.title.classList.add('gone');
    setTimeout(() => { ui.title.hidden = true; }, 460);
    this.showToast('고양이 눈높이 40cm. 문 밖 골목길까지 사람이 여섯. 관찰하고, 장난치고.', 4200);
    this.cam.lastDrag = performance.now();
  }

  /* ───────── 이동 ───────── */
  blocked(x, z) {
    const R = 0.32;
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
    if (d < 0.5 || d > 20) return;
    if (this.blocked(p.x, p.z)) return;
    this.input.target = new THREE.Vector2(p.x, p.z);
    this.stuckT = 0;
    this.tapRing.position.set(p.x, 0.02, p.z);
    this.tapRingT = 0;
    sfx.tap();
  }

  /* ───────── 가까운 사람 ───────── */
  updateNear() {
    const pos = this.cat.root.position;
    let best = null;
    for (const n of this.npcs) {
      const d = Math.hypot(pos.x - n.def.pos[0], pos.z - n.def.pos[1]);
      if (d < 2.6 && (!best || d < best.d)) best = { npc: n, d };
    }
    const prev = state.near && state.near.npc;
    state.near = best;
    const npc = best && best.npc;
    const key = npc ? npc.def.id + (npc.pranked ? '*' : '') : '';
    if (key !== state.nearKey) {
      state.nearKey = key;
      if (npc) {
        ui.actionWho.textContent = npc.def.name + ' · ' + npc.def.tag;
        ui.prankKind.textContent = npc.def.prank.label + (npc.pranked ? ' (한 번 더)' : '');
        ui.actions.hidden = false;
        ui.hint.style.opacity = '0';
      } else {
        ui.actions.hidden = true;
        ui.hint.style.opacity = '1';
      }
    }
    return prev;
  }

  /* ───────── 관찰 ───────── */
  observe() {
    const near = state.near;
    if (!near || !state.started) return;
    const npc = near.npc;
    const def = npc.def;
    const idx = (npc.observeIdx = ((npc.observeIdx ?? -1) + 1) % def.observe.length);
    state.observed.add(def.id);
    this.observeT = 0;
    sfx.tap();
    this.showCaption('구공이의 관찰 · ' + def.name, def.observe[idx], 'observe');
    this.updateHud();
  }

  /* ───────── 장난치기 ───────── */
  prank() {
    const near = state.near;
    if (!near || !state.started || state.acting) return;
    const npc = near.npc;
    const def = npc.def;
    const kind = def.prank.kind;
    const pos = this.cat.root.position;

    state.acting = true;
    npc.pranks = (npc.pranks ?? 0) + 1;
    const first = !npc.pranked;
    if (first) {
      npc.pranked = true;
      state.pranks += 1;
    }
    npc.react = { t: 0, dur: 1.75, kind };
    npc.eyeWide = 0;

    // 구공이 쪽 동작
    this.cat.swipe(kind);
    if (this.vm) this.vm.swipe(kind);
    this.prankFx = { t: 0, kind, npc };
    this.fpGrade.t = 0; // 살짝 들썩 + 시선 올리기
    if (kind === 'scare') sfx.meow();
    else sfx.swipe();
    setTimeout(() => sfx.startle(), kind === 'scare' ? 260 : 140);

    // 시선 고정
    if (this.cam.mode === 'first') {
      this.fpFaceYaw = Math.atan2(-(def.pos[0] - pos.x), -(def.pos[1] - pos.z));
      this.fpFaceUntil = performance.now() + 700;
    } else {
      this.faceYaw = Math.atan2(def.pos[0] - pos.x, def.pos[1] - pos.z);
      this.faceUntil = performance.now() + 750;
    }

    // 반응
    this.showShout(npc, def.prank.cry);
    this.showCaption(def.name + ' · ' + def.prank.label, def.prank.line, 'prank');
    if (npc.pushItem) this.knockItem(npc);

    this.updateHud();
    setTimeout(() => { state.acting = false; }, 1000);
    if (state.pranks >= TOTAL) setTimeout(() => this.complete(), 2500);
  }

  knockItem(npc) {
    const it = npc.pushItem;
    const pos = this.cat.root.position;
    let dx = it.group.position.x - pos.x;
    let dz = it.group.position.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const side = Math.random() < 0.5 ? 1 : -1;
    it.t = 0;
    it.vel.set(dx * 2.6 + side * 0.7, 0, dz * 2.6 + side * 0.7);
    it.spin = (Math.random() * 2 - 1) * 10;
  }

  showShout(npc, text) {
    let tex = this.shoutCache.get(text);
    if (!tex) {
      tex = shoutTexture(text);
      this.shoutCache.set(text, tex);
    }
    this.shout.material.map = tex;
    this.shout.material.needsUpdate = true;
    const def = npc.def;
    const headY = (def.seatY ? 1.4 : 1.66) * (def.scale ?? 1);
    this.shoutBase.set(def.pos[0], headY + 0.2, def.pos[1]);
    this.shout.position.copy(this.shoutBase);
    this.shout.scale.set(1.0, 0.5, 1);
    this.shout.visible = true;
    this.shout.material.opacity = 0;
    this.shoutT = 0;
  }

  showCaption(name, line, kind = 'prank') {
    ui.capName.textContent = name;
    ui.capLine.textContent = line;
    ui.caption.dataset.kind = kind;
    ui.caption.hidden = false;
    requestAnimationFrame(() => ui.caption.classList.add('show'));
    clearTimeout(this.capTimer);
    this.capTimer = setTimeout(() => this.hideCaption(), 15000);
  }

  hideCaption() {
    ui.caption.classList.remove('show');
    clearTimeout(this.capTimer);
    setTimeout(() => {
      if (!ui.caption.classList.contains('show')) ui.caption.hidden = true;
    }, 280);
  }

  updateHud() {
    ui.progText.textContent = `장난 ${state.pranks}/6`;
    Array.from(ui.dots.children).forEach((d, i) => d.classList.toggle('on', i < state.pranks));
  }

  complete() {
    ui.statPrank.textContent = `${state.pranks}/6`;
    ui.statObserve.textContent = `${state.observed.size}/6`;
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
    this.cat.root.rotation.x = 0;
    this.cat.gradeT = -1;
    this.cat.swipeT = -1;
    this.cat.root.position.y = 0;
    this.cam.yaw = 0;
    this.cam.fpPitch = 0.07;
    this.cam.pitch = 0.36;
    this.cam.init = false;
    this.input.target = null;
    this.input.jx = 0;
    this.input.jy = 0;
    this.input.keys.clear();
    this.faceYaw = null;
    this.fpFaceYaw = null;
    this.fpLift = 0;
    this.fpGrade.t = -1;
    this.prankFx.t = -1;
    this.observeT = -1;
    state.pranks = 0;
    state.observed.clear();
    state.distance = 0;
    state.acting = false;
    state.near = null;
    state.nearKey = '';
    state.visitedAlley = false;
    state.area = 'room';
    ui.areaName.textContent = '집 안';
    this.updateHud();
    this.hideCaption();
    ui.actions.hidden = true;
    ui.hint.style.opacity = '1';
    ui.done.hidden = true;
    this.shout.visible = false;
    this.shoutT = -1;

    for (const n of this.npcs) {
      n.pranked = false;
      n.pranks = 0;
      n.react = { t: -1, dur: 1.75, kind: '' };
      n.badge.material.opacity = 0;
      n.ring.visible = true;
      n.group.rotation.y = n.baseRotY;
      this.resetNpcPose(n);
      if (n.pushItem) {
        const it = n.pushItem;
        it.t = -1;
        it.vel.set(0, 0, 0);
        it.group.position.copy(it.base);
        it.group.rotation.set(0, it.rotY, 0);
      }
    }
    if (this.vm) this.vm.reset();
    state.started = true;
    this.cam.lastDrag = performance.now();
    this.showToast('처음부터 다시. 오늘은 여섯 명 전부 놀려 본다.', 2600);
  }

  resetNpcPose(n) {
    const b = n.basePose;
    n.person.arms.forEach((a, i) => {
      a.shoulder.rotation.x = b.arms[i].sx;
      a.shoulder.rotation.z = b.arms[i].sz;
      a.elbow.rotation.x = b.arms[i].ex;
    });
    n.person.upper.rotation.x = b.upperX;
    n.person.head.rotation.x = b.headX;
    n.group.position.y = b.baseY;
    n.group.scale.y = b.scaleY;
    n.eyeWide = 0;
    n.person.eyes.forEach((e) => e.scale.setScalar(1));
  }

  showToast(text, ms = 3000) {
    const el = $('hint');
    el.innerHTML = text;
    el.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.innerHTML = DEFAULT_HINT;
      if (state.near) el.style.opacity = '0';
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
      this.renderFrame();
    } catch (err) {
      window.__ggErrors.push('frame: ' + (err && err.message));
      throw err;
    }
    requestAnimationFrame(this.loop);
  }

  renderFrame() {
    this.renderer.render(this.scene, this.camera);
    if (this.cam.mode === 'first' && this.vm) {
      this.renderer.autoClear = false;
      this.vm.render(this.renderer);
      this.renderer.autoClear = true;
    }
  }

  update(dt, t) {
    const cat = this.cat;
    const pos = cat.root.position;

    /* 입력 → 방향 (보는 쪽 기준) */
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
      speed = 3.1 * clamp(mag * 1.15, 0.35, 1);
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
        speed = Math.min(3.1, 1.2 + d * 0.9);
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

      // 몸 방향 전환 (1인칭에서는 몸이 안 보이지만 3인칭 전환 대비)
      if (this.faceYaw === null) {
        const targetYaw = Math.atan2(dirX, dirZ);
        cat.root.rotation.y = this.lerpAngle(cat.root.rotation.y, targetYaw, Math.min(1, dt * 11));
      }
      state.moving = true;
      state.speedRatio = speed / 3.1;

      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        sfx.step();
        this.stepTimer = 0.32;
      }
    } else {
      state.moving = false;
      state.speedRatio = 0;
      this.stuckT = 0;
    }
    state.distance += Math.hypot(pos.x - prevX, pos.z - prevZ);

    // 장난칠 때 인간 쪽으로 몸 돌리기 (3인칭)
    if (this.faceYaw !== null) {
      if (performance.now() < this.faceUntil) {
        cat.root.rotation.y = this.lerpAngle(cat.root.rotation.y, this.faceYaw, Math.min(1, dt * 14));
      } else {
        this.faceYaw = null;
      }
    }

    /* 가까운 사람 · 사람들 반응 */
    this.updateNear();
    this.updateNpcs(dt, t);
    this.updatePushItems(dt);

    /* 고양이 애니메이션 */
    let lookYaw = 0;
    if (state.near) {
      const n = state.near.npc;
      const ang = Math.atan2(n.def.pos[0] - pos.x, n.def.pos[1] - pos.z);
      lookYaw = clamp(wrapAngle(ang - cat.root.rotation.y), -0.7, 0.7);
    }
    cat.update(dt, t, { moving: state.moving, speed: state.speedRatio, lookYaw });

    /* 뷰모델 */
    if (this.cam.mode === 'first' && this.vm) {
      this.vm.update(dt, t, { moving: state.moving, speed: state.speedRatio });
    }

    /* 놀란 말풍선 */
    if (this.shoutT >= 0) {
      this.shoutT += dt;
      const p = this.shoutT / 1.7;
      if (p >= 1) {
        this.shoutT = -1;
        this.shout.visible = false;
      } else {
        const pop = Math.min(1, p * 6);
        const ease = 1 - Math.pow(1 - pop, 3);
        const sc = 0.6 + 0.4 * ease + Math.sin(p * Math.PI) * 0.04;
        const wob = Math.sin(p * 30) * 0.02 * Math.max(0, 1 - p * 3);
        this.shout.scale.set(1.0 * sc, 0.5 * sc, 1);
        this.shout.position.set(this.shoutBase.x, this.shoutBase.y + p * 0.16 + wob, this.shoutBase.z);
        this.shout.material.opacity = p < 0.8 ? 1 : clamp(1 - (p - 0.8) / 0.2, 0, 1);
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
        this.showToast('골목길. 이제 사람들이 내 키를 확인할 차례다.', 4200);
      }
    }

    /* 카메라 */
    if (this.cam.mode === 'first') this.updateCameraFirst(dt, t);
    else this.updateCameraThird(dt);

    /* 월드 애니메이션 */
    this.world.update(dt, t);
  }

  /* ───────── 1인칭 카메라 ───────── */
  updateCameraFirst(dt, t) {
    const cam = this.cam;
    const cat = this.cat;
    const pos = cat.root.position;
    const now = performance.now();

    // 사람 쪽으로 잠깐 고개 돌리기
    if (this.fpFaceYaw !== null) {
      if (now < this.fpFaceUntil) {
        if (now - cam.lastDrag > 150) {
          cam.yaw = this.lerpAngle(cam.yaw, this.fpFaceYaw, Math.min(1, dt * 9));
        }
      } else {
        this.fpFaceYaw = null;
      }
    }

    const sp = state.moving ? state.speedRatio : 0;
    const ph = cat.walkPhase;

    // 발걸음에 맞춘 아주 은은한 머리 흔들림
    const bobY = Math.sin(ph * 2) * 0.011 * sp + Math.sin(t * 1.7) * 0.0018;
    const sway = Math.sin(ph) * 0.009 * sp;
    let roll = Math.sin(ph) * 0.009 * sp;

    // 점프 · 흔들림 · 앞으로 파고들기
    let lift = 0;
    let shake = 0;
    let lunge = 0;

    if (this.fpGrade.t >= 0) {
      this.fpGrade.t += dt;
      const p = clamp(this.fpGrade.t / 1.2, 0, 1);
      lift += Math.sin(clamp(p / 0.5, 0, 1) * Math.PI) * 0.09;
      this.fpLift = Math.sin(Math.min(1, p / 0.7) * Math.PI) * 0.16;
      if (this.fpGrade.t > 1.4) this.fpGrade.t = -1;
    } else {
      this.fpLift += (0 - this.fpLift) * Math.min(1, dt * 6);
    }

    if (this.prankFx.t >= 0) {
      this.prankFx.t += dt;
      const p = clamp(this.prankFx.t / 0.9, 0, 1);
      lunge = Math.sin(Math.min(1, p / 0.45) * Math.PI) * 0.13;
      shake = Math.exp(-p * 5) * Math.sin(p * 46) * 0.006;
      roll += Math.sin(p * Math.PI) * 0.03;
      if (this.prankFx.t > 1) this.prankFx.t = -1;
    }

    if (this.observeT >= 0) {
      this.observeT += dt;
      roll += Math.sin(clamp(this.observeT / 0.9, 0, 1) * Math.PI) * 0.055;
      if (this.observeT > 1.2) this.observeT = -1;
    }

    const fx = -Math.sin(cam.yaw);
    const fz = -Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw);
    const rz = -Math.sin(cam.yaw);

    const ex = pos.x + fx * (0.11 + lunge) + rx * sway;
    const ez = pos.z + fz * (0.11 + lunge) + rz * sway;
    const ey = EYE_H + bobY + lift + shake;

    this.camera.position.set(ex, ey, ez);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(
      clamp(cam.fpPitch + this.fpLift, -1.25, 1.25) + shake * 0.5,
      cam.yaw + shake * 0.4,
      roll
    );
  }

  /* ───────── 3인칭 카메라 ───────── */
  updateCameraThird(dt) {
    const pos = this.cat.root.position;
    const cam = this.cam;

    if (state.moving && Math.hypot(this.input.jx, this.input.jy) > 0.25) {
      if (performance.now() - cam.lastDrag > 1500) {
        const behind = this.cat.root.rotation.y + Math.PI;
        cam.yaw = this.lerpAngle(cam.yaw, behind, Math.min(1, dt * 1.4));
      }
    }

    const target = new THREE.Vector3(pos.x, 0.95, pos.z);
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
    if (Math.abs(pos.z) < 4.5 && Math.abs(pos.x) < 3.4) {
      desired.y = Math.min(desired.y, 2.3);
    }

    if (!cam.init) {
      cam.cur.copy(desired);
      cam.look.copy(target);
      cam.init = true;
    }
    cam.cur.lerp(desired, 1 - Math.exp(-10 * dt));
    cam.look.lerp(new THREE.Vector3(pos.x, 1.0, pos.z), 1 - Math.exp(-13 * dt));

    this.camera.position.copy(cam.cur);
    this.camera.lookAt(cam.look);
  }

  /* ───────── 사람들 ───────── */
  updateNpcs(dt, t) {
    const pos = this.cat.root.position;
    for (const n of this.npcs) {
      const def = n.def;
      const P = n.person;
      const g = n.group;
      const dx = pos.x - def.pos[0];
      const dz = pos.z - def.pos[1];
      const d = Math.hypot(dx, dz);

      // 가까우면 고개를 돌린다
      const rel = clamp(wrapAngle(Math.atan2(dx, dz) - n.baseRotY), -0.75, 0.75);
      const lookT = d < 5.5 ? rel : 0;
      P.head.rotation.y += (lookT - P.head.rotation.y) * Math.min(1, dt * 5);

      const r = n.react;
      let hop = 0;
      let wide = 0;
      let bob = Math.sin(t * 1.6 + n.phase) * 0.006;

      if (r.t >= 0) {
        r.t += dt;
        const p = clamp(r.t / r.dur, 0, 1);

        // 화들짝: 움찔 → 팔 들기 → 진정
        const flail = p < 0.14 ? p / 0.14 : Math.exp(-(p - 0.14) * 3.4);
        const crouch = p < 0.1 ? Math.sin((p / 0.1) * Math.PI) : Math.exp(-(p - 0.1) * 5.5) * 0.5;
        hop = p > 0.1 && p < 0.42 ? Math.sin(((p - 0.1) / 0.32) * Math.PI) * 0.08 : 0;
        wide = Math.min(1, p * 6) * (p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25));

        // 몸 돌려 쳐다보기
        const turn = p < 0.22 ? p / 0.22 : p > 0.7 ? Math.max(0, 1 - (p - 0.7) / 0.3) : 1;
        const toCat = Math.atan2(dx, dz);
        const want = n.baseRotY + wrapAngle(toCat - n.baseRotY) * Math.min(1, turn) * 0.95;
        g.rotation.y = this.lerpAngle(g.rotation.y, want, Math.min(1, dt * 10));

        P.arms.forEach((a, i) => {
          const b = n.basePose.arms[i];
          a.shoulder.rotation.x = b.sx - flail * (i === 0 ? 1.7 : 1.35);
          a.shoulder.rotation.z = b.sz + flail * 0.55 * a.side;
          a.elbow.rotation.x = b.ex - flail * 0.9;
        });
        P.upper.rotation.x = n.basePose.upperX - crouch * 0.2 + flail * 0.12;
        P.head.rotation.x = n.basePose.headX - flail * 0.28;
        g.scale.y = n.basePose.scaleY * (1 - crouch * 0.075);
        P.eyes.forEach((e) => e.scale.setScalar(1 + wide * 0.3));

        if (r.t >= r.dur) {
          r.t = -1;
          this.resetNpcPose(n);
        }
      } else {
        g.rotation.y = this.lerpAngle(g.rotation.y, n.baseRotY, Math.min(1, dt * 2.5));
      }

      g.position.y = n.basePose.baseY + bob + hop;

      // 이름표 — 거리에 맞춰 화면 크기 일정
      const dCam = this.camera.position.distanceTo(g.position);
      const wantOpacity = n.pranked ? 0 : d < 6.5 ? (d < 3.4 ? 1 : 0.85) : 0;
      const mat = n.nameSprite.material;
      mat.opacity += (wantOpacity - mat.opacity) * Math.min(1, dt * 6);
      const ts = clamp(dCam / 6, 0.4, 1.35);
      n.nameSprite.scale.set(0.95 * ts, 0.33 * ts, 1);

      // 발밑 링
      n.ring.visible = !n.pranked;
      if (!n.pranked) {
        n.ring.material.opacity = 0.26 + Math.sin(t * 2.6 + n.phase) * 0.12;
        const s = 1 + Math.sin(t * 2.6 + n.phase) * 0.04;
        n.ring.scale.set(s, s, s);
      }

      // 장난 성공 스티커
      const wantBadge = n.pranked && n.react.t < 0 ? 1 : 0;
      n.badge.material.opacity += (wantBadge - n.badge.material.opacity) * Math.min(1, dt * 4);
      n.badge.position.y = (def.seatY ? 1.62 : 1.9) * (def.scale ?? 1) + 0.3 + Math.sin(t * 2 + n.phase) * 0.03;
      const bs = clamp(dCam / 7, 0.5, 1.2);
      n.badge.scale.set(0.46 * bs, 0.46 * bs, 1);
    }
  }

  updatePushItems(dt) {
    for (const n of this.npcs) {
      const it = n.pushItem;
      if (!it || it.t < 0) continue;
      it.t += dt;
      const g = it.group;
      const sp = it.vel.length();
      if (sp > 0.03) {
        g.position.x += it.vel.x * dt;
        g.position.z += it.vel.z * dt;
        const ddx = g.position.x - it.base.x;
        const ddz = g.position.z - it.base.z;
        const dist = Math.hypot(ddx, ddz);
        if (dist > 1.1) {
          g.position.x = it.base.x + (ddx / dist) * 1.1;
          g.position.z = it.base.z + (ddz / dist) * 1.1;
          it.vel.multiplyScalar(0.2);
        }
        it.vel.multiplyScalar(Math.pow(0.14, dt));
        g.rotation.y += it.spin * dt;
        g.rotation.z = clamp(sp * 0.12, 0, 0.5) * (it.spin > 0 ? 1 : -1);
      }
      if (it.t > 2) it.t = -1;
    }
  }
}

/* 부트 */
(async () => {
  try {
    const g = new Game();
    await g.init();
  } catch (err) {
    if (window.__ggErrors) window.__ggErrors.push('init: ' + (err && err.message));
    const boot = $('boot');
    if (boot) {
      boot.innerHTML = '<span>3D를 시작하지 못했다. (WebGL 확인) </span><button onclick="location.reload()">다시 시도</button>';
    }
    console.error(err);
  }
})();
