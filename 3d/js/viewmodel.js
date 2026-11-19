/* 구공이 3D — 1인칭 뷰모델
   카메라 코앞에 붙는 구공이의 몸: 입에 문 90 팻말 끝 · 앞발 · 수염 · 주둥이
   (별도 씬 + 카메라로 그려서 월드에 파묻히지 않고, 조명도 늘 같다)

   좌표계 — inner 평면(카메라 앞 0.5m)에서
     y = ±1  → 화면 위/아래 끝
     x = ±aspect → 화면 좌우 끝
   그래서 세로 화면에서도 가로 화면에서도 같은 자리에 앉는다. */
import * as THREE from 'three';
import { COL, std, signTexture } from './gfx.js';

const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);

/* 팻말 궤적 — x는 화면 반폭에 대한 비율 */
const MOUTH_REST = V(0.06, -1.12, 0.0);
const DISC_REST = V(-0.92, -1.14, -0.08);
const DISC_UP = V(-0.05, 0.27, -0.04);
const DISC_R = 0.34;

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.03, 4);
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.scene.add(this.root);

    // 카메라에 붙은 조명 — 어디를 보든 같은 밝기
    this.scene.add(new THREE.HemisphereLight(0xfff4e2, 0x9c7c5a, 2.1));
    const key = new THREE.DirectionalLight(0xffeacb, 2.0);
    key.position.set(-1.0, 1.6, 1.3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc6dcff, 0.45);
    rim.position.set(1.4, 0.2, -1.1);
    this.scene.add(rim);

    this.u = 0.28;
    this.aspect = 0.46;
    this.baseZ = -1.8;
    this.time = 0;
    this.swing = 0;
    this.gradeT = -1;
    this.gradeDur = 1.2;
    this.walkPhase = 0;
    this.swipeT = -1;
    this.swipeKind = '';

    this.paws = [];
    this.whisks = [];
    this.mouth = new THREE.Vector3();
    this.discRest = new THREE.Vector3();
    this.discUp = new THREE.Vector3();
    this.discCtrl = new THREE.Vector3();

    this._build();
    this.layout(58, 0.46);
    this.setSwing(0);
  }

  /* ─────────── 만들기 ─────────── */
  _build() {
    const fur = std(COL.cream, { roughness: 0.94 });
    const furLight = std(COL.creamLight, { roughness: 0.94 });
    const spot = std(COL.patch, { roughness: 0.92 });
    const pink = std(COL.pink, { roughness: 0.88 });
    const woodDark = std(COL.woodDark, { roughness: 0.8 });
    const wood = std(COL.wood, { roughness: 0.85 });

    /* ── 주둥이 (화면 아래 가운데서 아주 조금) ── */
    const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fur);
    snout.scale.set(0.30, 0.23, 0.34);
    snout.position.set(0.0, -1.16, 0.02);
    snout.rotation.x = -0.3;
    this.inner.add(snout);
    this.snout = snout;

    // 코끝 (작게)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), pink);
    nose.scale.set(0.05, 0.038, 0.04);
    nose.position.set(0.0, -0.985, 0.11);
    this.inner.add(nose);
    this.nose = nose;

    /* ── 앞발 두 개 ── */
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), furLight);
      paw.scale.set(0.155, 0.1, 0.21);
      g.add(paw);
      for (let i = 0; i < 3; i++) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), furLight);
        toe.scale.set(0.045, 0.04, 0.062);
        toe.position.set((i - 1) * 0.064, 0.012, -0.198);
        g.add(toe);
      }
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), spot);
      dot.scale.set(0.062, 0.036, 0.07);
      dot.position.set(s * 0.045, 0.062, -0.02);
      g.add(dot);

      g.position.set(s * 0.72, -1.0, 0.02);
      this.inner.add(g);
      this.paws.push({ g, side: s, base: g.position.clone() });
    }

    /* ── 수염 ── */
    const whiskMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d8,
      roughness: 0.5,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const start = V(s * 0.2, -1.06 + i * 0.045, 0.0);
        const dir = V(s * 0.95, 0.32 - i * 0.28, -0.14).normalize();
        const len = 0.62;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0065, 1, 4), whiskMat);
        m.scale.set(1, len, 1);
        m.quaternion.setFromUnitVectors(UP, dir);
        m.position.copy(start).addScaledVector(dir, len * 0.5);
        m.renderOrder = 1;
        this.inner.add(m);
        this.whisks.push({ m, start, dir, len, s, i });
      }
    }

    /* ── 90 팻말 ── */
    this.stick = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 1, 8), woodDark);
    this.stick.geometry.translate(0, 0.5, 0); // 아랫동이 = 입
    this.inner.add(this.stick);

    const disc = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(DISC_R, DISC_R, 0.075, 40), wood);
    rim.rotation.x = Math.PI / 2;
    disc.add(rim);
    const faceF = new THREE.Mesh(
      new THREE.CircleGeometry(DISC_R * 0.93, 40),
      new THREE.MeshStandardMaterial({ map: signTexture(false), roughness: 0.88, metalness: 0 })
    );
    faceF.position.z = 0.04;
    disc.add(faceF);
    const faceB = new THREE.Mesh(
      new THREE.CircleGeometry(DISC_R * 0.93, 40),
      new THREE.MeshStandardMaterial({ map: signTexture(true), roughness: 0.88, metalness: 0 })
    );
    faceB.position.z = -0.04;
    faceB.rotation.y = Math.PI;
    disc.add(faceB);
    this.inner.add(disc);
    this.disc = disc;

    this.inner.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
  }

  /* ─────────── 화면 맞춤 ─────────── */
  layout(fov, aspect) {
    this.aspect = aspect;
    const u = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 0.5;
    this.u = u;
    this.root.scale.setScalar(u);
    this.baseZ = -0.5 / u;
    this.inner.position.z = this.baseZ;
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // 앞발은 화면 양 끝 모서리로
    const px = clamp(0.74 * aspect, 0.28, 1.5);
    this.paws.forEach((p) => {
      p.base.x = p.side * px;
      p.g.position.x = p.base.x;
    });

    // 팻말 자리 (x는 화면 반폭 비율)
    this.mouth.copy(MOUTH_REST).setX(MOUTH_REST.x * aspect);
    this.discRest.copy(DISC_REST).setX(DISC_REST.x * aspect);
    this.discUp.copy(DISC_UP).setX(DISC_UP.x * aspect);
    this.discCtrl.copy(this.discRest).lerp(this.discUp, 0.5);
    this.discCtrl.y -= 0.42;
    this.discCtrl.x -= 0.06 * aspect;
  }

  /* ─────────── 팻말 자세 ─────────── */
  setSwing(sw) {
    this.swing = sw;
    const mouth = this.mouth.clone().lerp(MOUTH_REST.clone().setX(MOUTH_REST.x * this.aspect).setY(-0.34), sw);
    // 곡선으로 들어올린다
    const it = 1 - sw;
    const discPos = V(
      it * it * this.discRest.x + 2 * it * sw * this.discCtrl.x + sw * sw * this.discUp.x,
      it * it * this.discRest.y + 2 * it * sw * this.discCtrl.y + sw * sw * this.discUp.y,
      it * it * this.discRest.z + 2 * it * sw * this.discCtrl.z + sw * sw * this.discUp.z
    );

    const dir = discPos.clone().sub(mouth);
    const len = dir.length();
    const stickLen = Math.max(0.06, len - DISC_R * 0.8);
    this.stick.position.copy(mouth);
    this.stick.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    this.stick.scale.set(1, stickLen, 1);

    this.disc.position.copy(discPos);
    this.disc.rotation.set(
      lerp(-0.22, -0.05, sw),
      lerp(-1.32, -0.12, sw),
      lerp(0.2, 0.04, sw)
    );
  }

  /* ─────────── 채점 ─────────── */
  grade() {
    this.gradeT = 0;
  }

  /* ─────────── 장난 (앞발 휘두르기 · 머리 내밀기) ─────────── */
  swipe(kind = 'ankle') {
    this.swipeT = 0;
    this.swipeKind = kind;
  }

  reset() {
    this.gradeT = -1;
    this.swing = 0;
    this.walkPhase = 0;
    this.swipeT = -1;
    this.inner.position.z = this.baseZ;
    this.setSwing(0);
  }

  /* ─────────── 매 프레임 ─────────── */
  update(dt, t, opts = {}) {
    this.time = t;
    const moving = !!opts.moving;
    const speed = clamp(opts.speed ?? 0, 0, 1);

    /* 걸음 — 앞발이 번갈아 오르내린다 */
    if (moving) this.walkPhase += dt * (8.5 + speed * 4.5);
    const ph = this.walkPhase;

    /* 숨쉬듯 아주 작은 흔들림 + 채점 연출 */
    let swing = Math.sin(t * 1.5) * 0.02;
    let pawLift = 0;
    if (this.gradeT >= 0) {
      this.gradeT += dt;
      const p = clamp(this.gradeT / this.gradeDur, 0, 1);
      let s;
      if (p < 0.16) {
        s = -0.09 * Math.sin((p / 0.16) * Math.PI); // 살짝 내렸다가
      } else if (p < 0.46) {
        s = easeOut((p - 0.16) / 0.3); // 휙 들어 올린다
      } else if (p < 0.8) {
        s = 1 + Math.sin((p - 0.46) * 24) * 0.012; // 들고 자랑
      } else {
        s = 1 - easeOut((p - 0.8) / 0.2); // 내려놓는다
      }
      swing = s;
      pawLift = p > 0.14 && p < 0.74 ? Math.sin(clamp((p - 0.14) / 0.6, 0, 1) * Math.PI) : 0;
      if (this.gradeT >= this.gradeDur) this.gradeT = -1;
    }
    this.setSwing(swing);

    /* 앞발 — 걷기 + 채점 때 왼발 들기 */
    this.paws.forEach((p) => {
      const off = p.side < 0 ? 0 : Math.PI;
      const step = moving ? Math.sin(ph + off) * speed : 0;
      p.g.position.y = p.base.y + step * 0.04 + (p.side < 0 ? pawLift * 0.1 : pawLift * 0.03);
      p.g.position.z = p.base.z + (moving ? Math.cos(ph + off) * 0.05 * speed : 0) + pawLift * 0.03;
      p.g.rotation.z = step * 0.05;
    });

    /* 수염 — 아주 조금 흔들린다 */
    for (const w of this.whisks) {
      const sway = Math.sin(t * 1.9 + w.i * 0.9 + w.s) * 0.03 * (1 + speed)
        + (moving ? Math.sin(ph + w.i) * 0.02 * speed : 0);
      const dir = w.dir.clone();
      dir.y += sway * 0.5;
      dir.x += sway * 0.16 * w.s;
      dir.normalize();
      w.m.quaternion.setFromUnitVectors(UP, dir);
      w.m.position.copy(w.start).addScaledVector(dir, w.len * 0.5);
    }

    /* 머리 흔들림을 뷰모델에도 살짝 */
    const bob = moving ? Math.sin(ph * 2) * 0.024 * speed : Math.sin(t * 1.6) * 0.005;
    this.inner.position.y = bob;
    this.inner.rotation.z = (moving ? Math.sin(ph) * 0.026 * speed : 0) + pawLift * 0.02;

    /* 장난 — 오른발을 뻗어 툭, 또는 머리를 내밀어 야옹 */
    if (this.swipeT >= 0) {
      this.swipeT += dt;
      const p = this.swipeT / 0.8;
      if (p >= 1) {
        this.swipeT = -1;
        this.inner.position.z = this.baseZ;
      } else {
        const sw = Math.sin(Math.min(1, p * 1.55) * Math.PI);
        if (this.swipeKind === 'push') {
          this.paws.forEach((pw) => {
            pw.g.position.z = pw.base.z - sw * 0.26;
            pw.g.position.y = pw.base.y + sw * 0.1;
            pw.g.rotation.z = sw * 0.1 * pw.side;
          });
        } else if (this.swipeKind === 'scare') {
          this.inner.position.z = this.baseZ + sw * 0.07;
          this.setSwing(this.swing + sw * 0.3);
          this.inner.position.y = bob + sw * 0.03;
        } else {
          const paw = this.paws[1];
          paw.g.position.y = paw.base.y + sw * 0.28;
          paw.g.position.x = paw.base.x - sw * 0.18;
          paw.g.position.z = paw.base.z + sw * 0.22;
          paw.g.rotation.z = -sw * 0.5;
        }
      }
    }
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
