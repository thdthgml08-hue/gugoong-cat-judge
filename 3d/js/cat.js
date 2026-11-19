/* 구공이 3D 캐릭터 — 크림 털 · 점박이 · 나비넥타이 · 입에 문 90 팻말 */
import * as THREE from 'three';
import { COL, std, paintSpots, signTexture } from './gfx.js';

const D = THREE.MathUtils.degToRad;

export class Gugoong {
  constructor() {
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.85);
    this.gradeT = -1;
    this.gradeDur = 1.05;
    this.walkPhase = 0;
    this.blinkTimer = 2 + Math.random() * 2;
    this.blink = 0;
    this.jumpY = 0;
    this.time = 0;

    this.ears = [];
    this.legs = [];
    this.eyes = [];
    this.tailSegs = [];
    this.headYaw = 0;

    this._build();
  }

  _build() {
    const root = this.root;

    const furMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    });
    this.furMat = furMat;
    const fur = std(COL.cream, { roughness: 0.85 });
    const furLight = std(COL.creamLight, { roughness: 0.85 });
    const pink = std(COL.pink, { roughness: 0.9 });
    const dark = std(COL.ink, { roughness: 0.55 });
    const brown = std(COL.brown, { roughness: 0.8 });
    const white = new THREE.MeshBasicMaterial({ color: 0xfff8ea });

    /* ── 몸통 ── */
    const bodySpots = [
      { x: 0.62, y: 0.34, z: -0.12, rx: 0.44, ry: 0.42, rz: 0.5, color: COL.patch },
      { x: -0.58, y: 0.3, z: 0.1, rx: 0.4, ry: 0.38, rz: 0.46, color: COL.patch2 },
      { x: 0.05, y: 0.62, z: -0.45, rx: 0.42, ry: 0.3, rz: 0.34, color: COL.patch },
      { x: 0.2, y: -0.42, z: 0.5, rx: 0.3, ry: 0.3, rz: 0.3, color: COL.patch2 },
      { x: 0.72, y: 0.0, z: 0.6, rx: 0.26, ry: 0.3, rz: 0.26, color: COL.patch },
    ];
    const bodyGeo = paintSpots(new THREE.SphereGeometry(1, 30, 22), COL.cream, bodySpots);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.scale.set(0.37, 0.31, 0.5);
    body.position.set(0, 0.52, -0.02);
    body.castShadow = true;
    body.receiveShadow = true;
    this.body = body;
    root.add(body);

    // 가슴 털
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), furLight);
    chest.scale.set(0.21, 0.2, 0.22);
    chest.position.set(0, 0.44, 0.3);
    chest.castShadow = true;
    root.add(chest);

    /* ── 다리 ── */
    const legPos = [
      [-0.20, 0.34, 0.26, 'FL'],
      [0.20, 0.34, 0.26, 'FR'],
      [-0.20, 0.34, -0.24, 'BL'],
      [0.20, 0.34, -0.24, 'BR'],
    ];
    for (const [x, y, z, tag] of legPos) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.3, 0.15), fur);
      leg.position.y = -0.15;
      leg.castShadow = true;
      pivot.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), furLight);
      paw.position.set(0, -0.29, 0.025);
      paw.scale.set(1, 0.8, 1.15);
      paw.castShadow = true;
      pivot.add(paw);
      pivot.userData.tag = tag;
      root.add(pivot);
      this.legs.push(pivot);
    }

    /* ── 꼬리 ── */
    const tailRoot = new THREE.Group();
    tailRoot.position.set(0, 0.56, -0.44);
    tailRoot.rotation.x = 0.5;
    root.add(tailRoot);
    let parent = tailRoot;
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0, i === 0 ? 0 : -0.095);
      seg.rotation.x = i === 0 ? 0.18 : 0.16;
      const baseR = 0.085 - i * 0.0085;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 9),
        i % 2 === 0 ? fur : std(COL.patch, { roughness: 0.85 })
      );
      m.scale.set(baseR, baseR, baseR * 1.5);
      m.castShadow = true;
      seg.add(m);
      parent.add(seg);
      parent = seg;
      this.tailSegs.push(seg);
    }

    /* ── 머리 ── */
    const headG = new THREE.Group();
    headG.position.set(0, 0.72, 0.28);
    root.add(headG);
    this.head = headG;

    const headSpots = [
      { x: 0.55, y: 0.5, z: 0.18, rx: 0.5, ry: 0.42, rz: 0.48, color: COL.patch },
      { x: -0.55, y: 0.42, z: -0.2, rx: 0.36, ry: 0.3, rz: 0.36, color: COL.patch2 },
      { x: 0.1, y: -0.5, z: 0.55, rx: 0.26, ry: 0.22, rz: 0.2, color: COL.patch2 },
    ];
    const headGeo = paintSpots(new THREE.SphereGeometry(1, 28, 22), COL.cream, headSpots);
    const headMesh = new THREE.Mesh(headGeo, furMat);
    headMesh.scale.set(0.275, 0.26, 0.25);
    headMesh.position.y = 0.1;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headG.add(headMesh);

    // 볼 · 주둥이
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furLight);
      cheek.scale.set(0.085, 0.07, 0.062);
      cheek.position.set(s * 0.075, 0.035, 0.205);
      cheek.castShadow = true;
      headG.add(cheek);
    }
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furLight);
    muzzle.scale.set(0.075, 0.05, 0.055);
    muzzle.position.set(0, 0.075, 0.222);
    muzzle.castShadow = true;
    headG.add(muzzle);

    // 코
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), std(0xd98b8b, { roughness: 0.6 }));
    nose.position.set(0, 0.095, 0.268);
    nose.scale.set(1.2, 0.85, 0.8);
    headG.add(nose);

    // 눈 (반쯤 감긴 심사하는 눈)
    for (const s of [-1, 1]) {
      const eyeG = new THREE.Group();
      eyeG.position.set(s * 0.115, 0.135, 0.19);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), dark);
      ball.scale.set(1.15, 0.85, 0.6);
      eyeG.add(ball);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), white);
      hi.position.set(s * -0.012, 0.014, 0.032);
      eyeG.add(hi);
      // 윗눈꺼풀
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), fur);
      lid.scale.set(0.072, 0.055, 0.045);
      lid.position.set(0, 0.018, 0.008);
      lid.rotation.x = -0.1;
      eyeG.add(lid);
      headG.add(eyeG);
      this.eyes.push(eyeG);
    }

    // 눈썹처럼 살짝 각진 표정
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.016, 0.014), std(0xb98a63));
      brow.position.set(s * 0.115, 0.196, 0.19);
      brow.rotation.z = s * -0.22;
      brow.rotation.x = -0.2;
      headG.add(brow);
    }

    // 수염
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.002, 0.19, 4), white);
        w.position.set(s * 0.16, 0.045 + i * 0.018, 0.205);
        w.rotation.z = s * (1.35 - i * 0.12);
        w.rotation.y = s * -0.4;
        headG.add(w);
      }
    }

    /* ── 귀 ── */
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.165, 0.29, 0.005);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.24, 5), std(COL.cream, { roughness: 0.85 }));
      outer.position.y = 0.1;
      outer.rotation.z = s * -0.16;
      outer.rotation.x = -0.05;
      outer.castShadow = true;
      ear.add(outer);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.16, 5), pink);
      inner.position.set(s * -0.012, 0.095, 0.028);
      inner.rotation.z = s * -0.16;
      ear.add(inner);
      ear.userData.baseZ = s * -0.16;
      ear.userData.side = s;
      headG.add(ear);
      this.ears.push(ear);
    }

    /* ── 나비넥타이 ── */
    const bow = new THREE.Group();
    bow.position.set(0, -0.13, 0.155);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.095, 0.045), brown);
      wing.position.set(s * 0.05, 0, 0);
      wing.rotation.z = s * 0.32;
      wing.rotation.y = s * -0.35;
      wing.castShadow = true;
      bow.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.05), std(COL.brownDark));
    bow.add(knot);
    headG.add(bow);

    /* ── 90 팻말 (입에 물고 옆으로) ── */
    const sign = new THREE.Group();
    sign.position.set(-0.012, -0.062, 0.2);
    sign.rotation.set(0.08, -0.62, -0.1);
    headG.add(sign);
    this.sign = sign;

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.46, 8), std(COL.woodDark));
    stick.rotation.z = Math.PI / 2;
    stick.position.x = -0.24;
    stick.castShadow = true;
    sign.add(stick);

    const disc = new THREE.Group();
    disc.position.x = -0.46;
    disc.rotation.z = D(8);
    sign.add(disc);
    this.signDisc = disc;

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 34), std(COL.wood));
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    disc.add(rim);

    const frontTex = signTexture(false);
    const backTex = signTexture(true);
    const faceMatF = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.85, metalness: 0 });
    const faceMatB = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.85, metalness: 0 });
    const f1 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 34), faceMatF);
    f1.position.z = 0.021;
    disc.add(f1);
    const f2 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 34), faceMatB);
    f2.position.z = -0.021;
    f2.rotation.y = Math.PI;
    disc.add(f2);

    /* 접지 그림자 */
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
      }
    });
  }

  /** 채점 점프 + 갸우뚱 */
  grade() {
    this.gradeT = 0;
  }

  get isGrading() {
    return this.gradeT >= 0 && this.gradeT < this.gradeDur;
  }

  update(dt, time, opts = {}) {
    const moving = !!opts.moving;
    const speed = opts.speed ?? 0; // 0..1
    const lookYaw = opts.lookYaw ?? 0;
    this.time = time;

    /* 걷기 */
    const stride = moving ? 1 : 0;
    this.walkPhase += dt * (7.5 + speed * 5) * stride;
    const s = this.walkPhase;

    const legSwing = 0.55 * speed * stride;
    this.legs.forEach((leg, i) => {
      const off = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.x = Math.sin(s + off) * legSwing;
    });

    /* 몸통 흔들림 · 호흡 */
    const bob = moving ? Math.abs(Math.sin(s)) * 0.022 * speed : Math.sin(time * 2.1) * 0.008;
    this.body.position.y = 0.52 + bob;
    this.body.rotation.z = moving ? Math.sin(s) * 0.03 * speed : Math.sin(time * 1.3) * 0.012;
    this.body.rotation.x = moving ? -0.02 * speed : 0;

    /* 꼬리 */
    const tailAmp = moving ? 0.28 : 0.16;
    this.tailSegs.forEach((seg, i) => {
      seg.rotation.y = Math.sin(time * (moving ? 4.2 : 2.0) - i * 0.55) * tailAmp * (0.35 + i * 0.12);
      seg.rotation.x = (i === 0 ? 0.18 : 0.16) + Math.sin(time * 2.4 - i * 0.4) * 0.05;
    });

    /* 귀 */
    this.ears.forEach((ear) => {
      const side = ear.userData.side;
      const twitch = Math.max(0, Math.sin(time * 0.7 + side) - 0.985) * 6;
      ear.rotation.z = ear.userData.baseZ + twitch * side * 0.3 + (moving ? Math.sin(s * 2) * 0.04 : 0);
      ear.rotation.x = -0.05 + (moving ? Math.sin(s * 2 + 1) * 0.03 : 0);
    });

    /* 눈 깜박임 */
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2.4 + Math.random() * 3.2;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const eyeScale = 1 - Math.min(1, this.blink) * 0.92;
    this.eyes.forEach((e) => {
      e.scale.y = 0.35 + 0.65 * eyeScale;
    });

    /* 머리 — 걸을 때 살짝, 가까운 인간을 볼 때 갸웃 */
    const targetYaw = THREE.MathUtils.clamp(lookYaw, -0.7, 0.7);
    this.headYaw += (targetYaw - this.headYaw) * Math.min(1, dt * 6);
    const headBob = moving ? Math.sin(s * 2) * 0.035 * speed : Math.sin(time * 1.7) * 0.012;

    /* 채점 연출 */
    let jumpY = 0;
    let tilt = 0;
    let signSwing = 0;
    if (this.gradeT >= 0) {
      this.gradeT += dt;
      const p = this.gradeT / this.gradeDur;
      if (p < 1) {
        // 0 ~ 0.38: 점프, 이후 갸우뚱
        if (p < 0.4) {
          const q = p / 0.4;
          jumpY = Math.sin(q * Math.PI) * 0.42;
          tilt = Math.sin(q * Math.PI) * -0.12;
          this.legs.forEach((leg) => { leg.rotation.x = -0.5 * Math.sin(q * Math.PI); });
        } else {
          const q = (p - 0.4) / 0.6;
          tilt = Math.sin(q * Math.PI * 2) * 0.34 * (1 - q * 0.35);
          signSwing = Math.sin(q * Math.PI * 2.5) * 0.22;
        }
        this.head.rotation.z = tilt;
        this.head.rotation.x = -0.08 + tilt * 0.2 + headBob;
        this.sign.rotation.z = -0.1 + signSwing;
        this.sign.rotation.x = 0.08 + Math.sin(time * 12) * 0.02 * (1 - p);
        if (jumpY > 0.02 && !this._landed) {
          this._landed = true;
        }
      } else {
        this.gradeT = -1;
        this._landed = false;
      }
    } else {
      this.head.rotation.z = Math.sin(time * 1.1) * 0.010;
      this.head.rotation.x = -0.06 + headBob;
      this.sign.rotation.z = -0.1;
      this.sign.rotation.x = 0.08;
    }
    this.head.rotation.y = this.headYaw;
    this.jumpY = jumpY;
    this.root.position.y = jumpY;
  }
}
