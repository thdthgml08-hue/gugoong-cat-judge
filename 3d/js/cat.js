/* 구공이 3D 캐릭터 — 크림 털 · 점박이 · 나비넥타이 · 입에 문 90 팻말 */
import * as THREE from 'three';
import { COL, std, paintSpots, signTexture } from './gfx.js';

const D = THREE.MathUtils.degToRad;

export class Gugoong {
  constructor() {
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.9);
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

    /* ── 몸통 (길고 낮은 고양이 몸) ── */
    const bodySpots = [
      { x: 0.66, y: 0.3, z: -0.1, rx: 0.42, ry: 0.44, rz: 0.44, color: COL.patch },
      { x: -0.6, y: 0.26, z: 0.05, rx: 0.38, ry: 0.4, rz: 0.42, color: COL.patch2 },
      { x: 0.05, y: 0.6, z: -0.5, rx: 0.4, ry: 0.34, rz: 0.3, color: COL.patch },
      { x: 0.3, y: -0.44, z: 0.45, rx: 0.28, ry: 0.24, rz: 0.3, color: COL.patch2 },
      { x: 0.78, y: -0.05, z: 0.5, rx: 0.24, ry: 0.28, rz: 0.26, color: COL.patch },
    ];
    const bodyGeo = paintSpots(new THREE.SphereGeometry(1, 32, 24), COL.cream, bodySpots);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.scale.set(0.345, 0.3, 0.52);
    body.position.set(0, 0.55, -0.02);
    body.castShadow = true;
    body.receiveShadow = true;
    this.body = body;
    root.add(body);

    // 가슴 털
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), furLight);
    chest.scale.set(0.19, 0.19, 0.2);
    chest.position.set(0, 0.47, 0.34);
    chest.castShadow = true;
    root.add(chest);

    /* ── 다리 ── */
    const legPos = [
      [-0.185, 0.36, 0.28],
      [0.185, 0.36, 0.28],
      [-0.19, 0.36, -0.26],
      [0.19, 0.36, -0.26],
    ];
    for (const [x, y, z] of legPos) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.155), fur);
      leg.position.y = -0.16;
      leg.castShadow = true;
      pivot.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.087, 12, 10), furLight);
      paw.position.set(0, -0.32, 0.03);
      paw.scale.set(1, 0.72, 1.2);
      paw.castShadow = true;
      pivot.add(paw);
      root.add(pivot);
      this.legs.push(pivot);
    }

    /* ── 꼬리 (엉덩이 위로 말려 올라간다) ── */
    const tailRoot = new THREE.Group();
    tailRoot.position.set(0, 0.64, -0.46);
    tailRoot.rotation.x = 0.95;
    root.add(tailRoot);
    let parent = tailRoot;
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0, i === 0 ? 0 : -0.085);
      seg.rotation.x = i === 0 ? 0.2 : 0.13;
      const baseR = 0.082 - i * 0.0065;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 9),
        i % 2 === 0 ? fur : std(COL.patch, { roughness: 0.85 })
      );
      m.scale.set(baseR, baseR, baseR * 1.45);
      m.castShadow = true;
      seg.add(m);
      parent.add(seg);
      parent = seg;
      this.tailSegs.push(seg);
    }

    /* ── 머리 ── */
    const headG = new THREE.Group();
    headG.position.set(0, 0.78, 0.3);
    root.add(headG);
    this.head = headG;

    const headSpots = [
      { x: 0.52, y: 0.48, z: 0.2, rx: 0.5, ry: 0.44, rz: 0.46, color: COL.patch },
      { x: -0.56, y: 0.4, z: -0.15, rx: 0.34, ry: 0.3, rz: 0.34, color: COL.patch2 },
      { x: 0.1, y: -0.55, z: 0.5, rx: 0.24, ry: 0.2, rz: 0.2, color: COL.patch2 },
    ];
    const headGeo = paintSpots(new THREE.SphereGeometry(1, 30, 24), COL.cream, headSpots);
    const headMesh = new THREE.Mesh(headGeo, furMat);
    headMesh.scale.set(0.3, 0.285, 0.275);
    headMesh.position.y = 0.13;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headG.add(headMesh);

    // 목덜미 연결
    const neck = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), fur);
    neck.scale.set(0.2, 0.18, 0.18);
    neck.position.set(0, -0.02, 0.03);
    headG.add(neck);

    // 볼 · 주둥이
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furLight);
      cheek.scale.set(0.095, 0.075, 0.07);
      cheek.position.set(s * 0.082, 0.06, 0.23);
      cheek.castShadow = true;
      headG.add(cheek);
    }
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furLight);
    muzzle.scale.set(0.08, 0.055, 0.06);
    muzzle.position.set(0, 0.1, 0.248);
    muzzle.castShadow = true;
    headG.add(muzzle);

    // 코
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), std(0xd98b8b, { roughness: 0.6 }));
    nose.position.set(0, 0.118, 0.296);
    nose.scale.set(1.2, 0.85, 0.8);
    headG.add(nose);

    // 눈 (반쯤 감긴 심사하는 눈)
    for (const s of [-1, 1]) {
      const eyeG = new THREE.Group();
      eyeG.position.set(s * 0.125, 0.165, 0.215);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), dark);
      ball.scale.set(1.15, 0.85, 0.55);
      eyeG.add(ball);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), white);
      hi.position.set(s * -0.013, 0.015, 0.034);
      eyeG.add(hi);
      // 윗눈꺼풀
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), fur);
      lid.scale.set(0.078, 0.058, 0.048);
      lid.position.set(0, 0.02, 0.008);
      lid.rotation.x = -0.1;
      eyeG.add(lid);
      headG.add(eyeG);
      this.eyes.push(eyeG);
    }

    // 살짝 각진 눈썹
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.017, 0.015), std(0xb98a63));
      brow.position.set(s * 0.125, 0.23, 0.212);
      brow.rotation.z = s * -0.2;
      brow.rotation.x = -0.2;
      headG.add(brow);
    }

    // 수염
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.002, 0.2, 4), white);
        w.position.set(s * 0.17, 0.07 + i * 0.02, 0.235);
        w.rotation.z = s * (1.35 - i * 0.12);
        w.rotation.y = s * -0.4;
        headG.add(w);
      }
    }

    /* ── 귀 ── */
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.175, 0.33, 0.0);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.26, 5), std(COL.cream, { roughness: 0.85 }));
      outer.position.y = 0.11;
      outer.rotation.z = s * -0.17;
      outer.rotation.x = -0.05;
      outer.castShadow = true;
      ear.add(outer);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.17, 5), pink);
      inner.position.set(s * -0.012, 0.105, 0.032);
      inner.rotation.z = s * -0.17;
      ear.add(inner);
      ear.userData.baseZ = s * -0.17;
      ear.userData.side = s;
      headG.add(ear);
      this.ears.push(ear);
    }

    /* ── 나비넥타이 ── */
    const bow = new THREE.Group();
    bow.position.set(0, -0.12, 0.2);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.05), brown);
      wing.position.set(s * 0.052, 0, 0);
      wing.rotation.z = s * 0.32;
      wing.rotation.y = s * -0.32;
      wing.castShadow = true;
      bow.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.058, 0.052), std(COL.brownDark));
    bow.add(knot);
    headG.add(bow);

    /* ── 90 팻말 (입에 물고 옆으로) ── */
    const sign = new THREE.Group();
    sign.position.set(-0.02, -0.06, 0.245);
    sign.rotation.set(0.06, -0.78, -0.12);
    headG.add(sign);
    this.sign = sign;

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.019, 0.56, 8), std(COL.woodDark));
    stick.rotation.z = Math.PI / 2;
    stick.position.x = -0.28;
    stick.castShadow = true;
    sign.add(stick);

    const disc = new THREE.Group();
    disc.position.x = -0.54;
    disc.rotation.z = D(6);
    sign.add(disc);
    this.signDisc = disc;

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.045, 34), std(COL.wood));
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    disc.add(rim);

    const faceMatF = new THREE.MeshStandardMaterial({ map: signTexture(false), roughness: 0.85, metalness: 0 });
    const faceMatB = new THREE.MeshStandardMaterial({ map: signTexture(false), roughness: 0.85, metalness: 0 });
    const f1 = new THREE.Mesh(new THREE.CircleGeometry(0.218, 34), faceMatF);
    f1.position.z = 0.024;
    disc.add(f1);
    const f2 = new THREE.Mesh(new THREE.CircleGeometry(0.218, 34), faceMatB);
    f2.position.z = -0.024;
    f2.rotation.y = Math.PI;
    disc.add(f2);

    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
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

    const legSwing = 0.6 * speed * stride;
    this.legs.forEach((leg, i) => {
      const off = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.x = Math.sin(s + off) * legSwing;
    });

    /* 몸통 흔들림 · 호흡 */
    const bob = moving ? Math.abs(Math.sin(s)) * 0.024 * speed : Math.sin(time * 2.1) * 0.008;
    this.body.position.y = 0.55 + bob;
    this.body.rotation.z = moving ? Math.sin(s) * 0.03 * speed : Math.sin(time * 1.3) * 0.012;
    this.body.rotation.x = moving ? -0.02 * speed : 0;

    /* 꼬리 */
    const tailAmp = moving ? 0.26 : 0.15;
    this.tailSegs.forEach((seg, i) => {
      seg.rotation.y = Math.sin(time * (moving ? 4.2 : 2.0) - i * 0.55) * tailAmp * (0.35 + i * 0.1);
      seg.rotation.x = (i === 0 ? 0.2 : 0.13) + Math.sin(time * 2.4 - i * 0.4) * 0.045;
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
        if (p < 0.4) {
          const q = p / 0.4;
          jumpY = Math.sin(q * Math.PI) * 0.44;
          tilt = Math.sin(q * Math.PI) * -0.12;
          this.legs.forEach((leg) => { leg.rotation.x = -0.55 * Math.sin(q * Math.PI); });
        } else {
          const q = (p - 0.4) / 0.6;
          tilt = Math.sin(q * Math.PI * 2) * 0.34 * (1 - q * 0.35);
          signSwing = Math.sin(q * Math.PI * 2.5) * 0.22;
        }
        this.head.rotation.z = tilt;
        this.head.rotation.x = -0.06 + tilt * 0.2 + headBob;
        this.sign.rotation.z = -0.12 + signSwing;
        this.sign.rotation.x = 0.06 + Math.sin(time * 12) * 0.02 * (1 - p);
      } else {
        this.gradeT = -1;
      }
    } else {
      this.head.rotation.z = Math.sin(time * 1.1) * 0.010;
      this.head.rotation.x = -0.06 + headBob;
      this.sign.rotation.z = -0.12;
      this.sign.rotation.x = 0.06;
    }
    this.head.rotation.y = this.headYaw;
    this.jumpY = jumpY;
    this.root.position.y = jumpY;
  }
}
