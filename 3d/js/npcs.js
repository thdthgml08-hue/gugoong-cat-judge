/* 구공이 3D — 채점 대상 인간들 (3D 클레이 피규어)
   둥근 머리 · 동그란 코 · 안경 · 풍성한 머리 · 옷깃/주머니/치마/신발 디테일 */
import * as THREE from 'three';
import { COL, std, nameTexture, pawBadgeTexture, polkaTexture } from './gfx.js';

const SKIN = 0xf3cba8;
const D = THREE.MathUtils.degToRad;

/* ── 무광 클레이 재질 ── */
function clay(color, rough = 0.94) {
  return std(color, { roughness: rough, metalness: 0 });
}
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

function ball(r, material, x, y, z, sx = 1, sy = 1, sz = 1, seg = 20) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, seg, Math.max(10, Math.round(seg * 0.72))),
    material
  );
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cap(r, material, theta = 0.58, seg = 22) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, seg, 16, 0, Math.PI * 2, 0, Math.PI * theta),
    material
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ── 머리카락 ── */
function addHair(head, style, hairMat, cfg) {
  if (style === 'bald') {
    head.add(ball(0.075, hairMat, -0.185, 0.01, -0.03, 0.55, 0.85, 0.9));
    head.add(ball(0.075, hairMat, 0.185, 0.01, -0.03, 0.55, 0.85, 0.9));
    head.add(ball(0.16, hairMat, 0, -0.01, -0.10, 1.08, 0.55, 0.85));
    return;
  }
  if (style === 'cap') {
    head.add(ball(0.10, hairMat, -0.175, 0.0, -0.06, 0.7, 0.8, 0.9));
    head.add(ball(0.10, hairMat, 0.175, 0.0, -0.06, 0.7, 0.8, 0.9));
    const capMat = clay(cfg.capColor ?? 0x35506b, 0.92);
    const dome = cap(0.228, capMat, 0.52);
    dome.position.y = 0.012;
    head.add(dome);
    const brim = ball(0.14, capMat, 0, 0.055, 0.245, 1, 0.16, 0.85);
    brim.rotation.x = -0.12;
    head.add(brim);
    return;
  }
  if (style === 'cloud') {
    // 풍성한 구름 머리
    const puffs = [
      [0, 0.19, 0.03, 0.125], [-0.14, 0.15, 0.06, 0.112], [0.14, 0.15, 0.06, 0.112],
      [-0.205, 0.03, -0.01, 0.105], [0.205, 0.03, -0.01, 0.105],
      [-0.16, -0.08, -0.09, 0.10], [0.16, -0.08, -0.09, 0.10],
      [0, -0.03, -0.165, 0.115], [0, 0.245, -0.07, 0.10],
      [-0.075, 0.115, 0.155, 0.075], [0.075, 0.115, 0.155, 0.075],
      [-0.24, 0.10, -0.10, 0.085], [0.24, 0.10, -0.10, 0.085],
    ];
    for (const [x, y, z, r] of puffs) {
      const p = ball(r, hairMat, x, y, z, 1, 0.95, 1, 16);
      p.rotation.set(x * 1.2, y * 0.8, z * 0.6);
      head.add(p);
    }
    return;
  }
  // short · bun · long 공통: 윗머리 덮개
  const base = cap(0.224, hairMat, 0.5);
  base.position.y = 0.022;
  head.add(base);
  head.add(ball(0.135, hairMat, 0, 0.055, -0.155, 1.05, 0.9, 0.5));

  if (style === 'bun') {
    head.add(ball(0.088, hairMat, 0, 0.135, -0.185, 1, 1, 0.95));
  } else if (style === 'long') {
    head.add(ball(0.085, hairMat, -0.195, -0.13, -0.02, 0.62, 1.75, 0.85));
    head.add(ball(0.085, hairMat, 0.195, -0.13, -0.02, 0.62, 1.75, 0.85));
    head.add(ball(0.14, hairMat, 0, 0.02, -0.19, 1.0, 1.35, 0.62));
  } else {
    // 앞머리 잔머리
    head.add(ball(0.062, hairMat, -0.088, 0.175, 0.155, 1.15, 0.62, 0.75));
    head.add(ball(0.055, hairMat, 0.062, 0.185, 0.145, 1.0, 0.55, 0.7));
  }
}

/* ── 머리 (얼굴 · 안경) ── */
function buildHead(cfg) {
  const head = new THREE.Group();
  const skin = clay(cfg.skin ?? SKIN, 0.9);
  const blush = clay(cfg.blush ?? 0xe9a993, 1);
  const hairMat = clay(cfg.hair ?? 0x4a3328, 0.95);
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.38, metalness: 0 });
  const iris = clay(cfg.eye ?? 0x3c2f28, 0.4);
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });

  head.add(ball(0.216, skin, 0, 0, 0, 1, 1.04, 0.97, 26));
  head.add(ball(0.148, skin, 0, -0.095, 0.06, 1.12, 0.85, 0.95, 20));
  head.add(ball(0.078, skin, -0.115, -0.05, 0.128, 1, 0.92, 0.82));
  head.add(ball(0.078, skin, 0.115, -0.05, 0.128, 1, 0.92, 0.82));
  head.add(ball(0.052, skin, -0.215, -0.015, -0.01, 0.52, 1, 0.85, 14));
  head.add(ball(0.052, skin, 0.215, -0.015, -0.01, 0.52, 1, 0.85, 14));

  // 볼터치
  head.add(ball(0.04, blush, -0.118, -0.058, 0.193, 1, 0.7, 0.12, 14));
  head.add(ball(0.04, blush, 0.118, -0.058, 0.193, 1, 0.7, 0.12, 14));

  // 눈
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * 0.079, 0.035, 0.0);
    e.add(ball(0.052, eyeWhite, 0, 0, 0.172, 1, 1.12, 0.62, 16));
    e.add(ball(0.024, iris, 0, -0.004, 0.206, 1, 1, 0.62, 12));
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), glint);
    g.position.set(s * -0.008, 0.012, 0.216);
    e.add(g);
    head.add(e);
    eyes.push(e);
  }

  // 눈썹
  for (const s of [-1, 1]) {
    const b = ball(0.05, hairMat, s * 0.079, 0.108, 0.176, 1.05, 0.22, 0.35, 12);
    b.rotation.z = s * -0.16;
    head.add(b);
  }

  // 동그란 코
  head.add(ball(0.043, skin, 0, -0.018, 0.196, 1, 0.95, 1.08, 16));

  // 입 (스마일)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.0075, 6, 14, Math.PI),
    clay(0x9c5a4a, 0.7)
  );
  mouth.position.set(0, -0.082, 0.203);
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  // 안경
  if (cfg.glasses) {
    const gm = clay(cfg.glassesColor ?? 0x5a3720, 0.55);
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0045, 8, 22), gm);
      ring.position.set(s * 0.079, 0.032, 0.222);
      ring.rotation.y = s * 0.04;
      head.add(ring);
      const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.20, 6), gm);
      temple.position.set(s * 0.158, 0.042, 0.10);
      temple.rotation.set(Math.PI / 2, 0, s * 0.42);
      head.add(temple);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.035, 6), gm);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.04, 0.228);
    head.add(bridge);
  }

  addHair(head, cfg.hairStyle ?? 'short', hairMat, cfg);
  return { head, eyes };
}

/* ── 사람 한 명 ── */
export function makePerson(cfg = {}) {
  const g = new THREE.Group();
  const skin = clay(cfg.skin ?? SKIN, 0.9);
  const o = cfg.outfit || {};
  const outerCol = o.outer ?? 0x8fae94;
  const outer = clay(outerCol, 0.96);
  const outerDark = clay(shade(outerCol, 0.86), 0.96);
  const inner = clay(o.inner ?? 0xf2ece0, 0.95);
  const pantsCol = o.pants ?? 0x4a5870;
  const pants = clay(pantsCol, 0.96);
  const shoeMat = clay(o.shoes ?? 0x6b4a34, 0.9);
  const soleMat = clay(o.sole ?? 0xeadfc8, 0.95);
  const accent = clay(o.accent ?? 0xc9704f, 0.9);
  const skinMat = skin;

  /* ── 다리 ── */
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(s * 0.105, 0.82, 0);
    const tm = new THREE.Mesh(new THREE.CapsuleGeometry(0.086, 0.20, 6, 14), pants);
    tm.position.y = -0.19;
    tm.castShadow = true;
    thigh.add(tm);

    const shin = new THREE.Group();
    shin.position.y = -0.38;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.076, 14, 10), pants);
    knee.castShadow = true;
    shin.add(knee);
    const sm = new THREE.Mesh(new THREE.CapsuleGeometry(0.076, 0.185, 6, 14), pants);
    sm.position.y = -0.17;
    sm.castShadow = true;
    shin.add(sm);

    const shoe = new THREE.Group();
    shoe.position.set(0, -0.34, 0.015);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.10, 6, 12), shoeMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(1.12, 1, 1);
    body.position.set(0, -0.046, 0.02);
    body.castShadow = true;
    shoe.add(body);
    const so = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.10, 4, 10), soleMat);
    so.rotation.x = Math.PI / 2;
    so.scale.set(1.16, 1, 1.03);
    so.position.set(0, -0.072, 0.02);
    shoe.add(so);
    // 끈 · 스트랩
    if (cfg.shoeStrap) {
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 6, 14, Math.PI), clay(o.strap ?? 0x8e3a3a, 0.7));
      st.position.set(0, -0.02, 0.03);
      st.rotation.set(Math.PI / 2, 0, 0);
      shoe.add(st);
    } else {
      for (let i = 0; i < 2; i++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.01), soleMat);
        lace.position.set(0, -0.012 - i * 0.014, -0.005 - i * 0.022);
        lace.rotation.x = 0.25;
        shoe.add(lace);
      }
    }
    shin.add(shoe);
    thigh.add(shin);
    g.add(thigh);
    legs.push({ thigh, shin, shoe });
  }

  /* ── 치마 ── */
  if (o.skirt) {
    const skirtMat = new THREE.MeshStandardMaterial({
      map: polkaTexture(o.skirt, o.skirtDot ?? '#d6dfbd'),
      roughness: 0.97,
      metalness: 0,
    });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.365, 0.5, 26, 1, false), skirtMat);
    skirt.position.y = 0.60;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    g.add(skirt);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.362, 0.012, 6, 26), clay(shade(o.skirt, 0.9), 0.95));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.35;
    g.add(hem);
  }

  /* ── 상체 ── */
  const upper = new THREE.Group();
  upper.position.y = 0.82;
  g.add(upper);

  upper.add(ball(0.228, outer, 0, 0.17, 0, 1, 0.94, 0.86, 24));
  upper.add(ball(0.196, outer, 0, 0.34, 0, 1, 0.82, 0.88, 22));
  upper.add(ball(0.104, outer, -0.185, 0.385, 0, 1, 0.92, 0.95, 16));
  upper.add(ball(0.104, outer, 0.185, 0.385, 0, 1, 0.92, 0.95, 16));

  // 목
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.13, 14), skinMat);
  neck.position.y = 0.49;
  upper.add(neck);

  // 안쪽 셔츠 (앞트임)
  upper.add(ball(0.072, inner, 0, 0.30, 0.148, 0.9, 1.85, 0.55, 16));

  // 옷깃
  upper.add(ball(0.072, accent, -0.072, 0.452, 0.115, 1.25, 0.55, 0.72, 14));
  upper.add(ball(0.072, accent, 0.072, 0.452, 0.115, 1.25, 0.55, 0.72, 14));

  // 주머니
  upper.add(ball(0.058, outerDark, -0.145, 0.095, 0.155, 1.2, 0.72, 0.45, 12));
  upper.add(ball(0.058, outerDark, 0.145, 0.095, 0.155, 1.2, 0.72, 0.45, 12));

  // 벨트
  if (o.belt) {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.208, 0.026, 8, 24), accent);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.035;
    belt.scale.set(1, 0.9, 1);
    upper.add(belt);
  }

  /* ── 팔 ── */
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.203, 0.395, 0);
    const um = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.14, 6, 14), outer);
    um.position.y = -0.105;
    um.castShadow = true;
    shoulder.add(um);
    // 소매 커프스
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.014, 6, 14), accent);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.215;
    shoulder.add(cuff);

    const elbow = new THREE.Group();
    elbow.position.y = -0.235;
    // 팔꿈치 관절 (구부려도 틈이 벌어지지 않게)
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), skinMat);
    joint.scale.set(1, 0.95, 0.95);
    joint.castShadow = true;
    elbow.add(joint);
    const fm = new THREE.Mesh(new THREE.CapsuleGeometry(0.053, 0.125, 6, 14), skinMat);
    fm.position.y = -0.09;
    fm.castShadow = true;
    elbow.add(fm);
    const hand = ball(0.063, skinMat, 0, -0.215, 0.012, 1, 1.2, 0.92, 14);
    elbow.add(hand);
    shoulder.add(elbow);
    upper.add(shoulder);
    shoulder.rotation.z = s * -0.06;
    arms.push({ shoulder, elbow, hand, side: s });
  }

  /* ── 머리 ── */
  const { head, eyes } = buildHead(cfg);
  head.position.set(0, 0.735, 0.005);
  upper.add(head);
  const neckGlow = null;

  g.traverse((o2) => {
    if (o2.isMesh) {
      o2.castShadow = true;
      o2.receiveShadow = true;
    }
  });

  return { group: g, upper, head, legs, arms, eyes };
}

/* ── 들고 있는 물건 ── */
function holdItem(person, kind, cfg = {}) {
  const g = person.group;
  const upper = person.upper;
  const R = person.arms.find((a) => a.side > 0);

  if (kind === 'churu') {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.015, 0.17, 8),
      clay(0xf6ecd8, 0.85)
    );
    stick.position.set(0, -0.30, 0.05);
    stick.rotation.x = 0.5;
    R.elbow.add(stick);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), clay(0xd98b8b, 0.7));
    tip.position.set(0, 0.015, 0);
    tip.scale.set(1, 0.6, 1);
    stick.add(tip);
    R.shoulder.rotation.x = -0.55;
    R.elbow.rotation.x = -0.55;
    return [stick];
  }
  if (kind === 'box') {
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.28), clay(0xc79a63, 0.97));
    boxM.position.set(0, 0.17, 0.3);
    upper.add(boxM);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.305, 0.285), clay(0xe8dcc2, 0.9));
    tape.position.set(0, 0.17, 0.3);
    upper.add(tape);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.03), clay(0xb98a55, 0.97));
    flap.position.set(0, 0.32, 0.16);
    upper.add(flap);
    person.arms.forEach((a) => {
      a.shoulder.rotation.x = -1.15;
      a.elbow.rotation.x = -1.25;
    });
    return [boxM];
  }
  if (kind === 'camera') {
    const cam = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.085, 0.075), clay(0x3a3129, 0.8));
    cam.add(bodyM);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.06, 16), clay(0x241d18, 0.6));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.06;
    cam.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), clay(0xb8a98f, 0.5));
    ring.position.z = 0.088;
    cam.add(ring);
    cam.position.set(0, -0.255, 0.06);
    R.elbow.add(cam);
    R.shoulder.rotation.x = -1.75;
    R.elbow.rotation.x = -1.35;
    return [cam];
  }
  if (kind === 'phone') {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.018), clay(0x2f2a26, 0.75));
    phone.position.set(0, -0.225, 0.05);
    phone.rotation.set(0.1, 0, 0.1);
    R.elbow.add(phone);
    R.shoulder.rotation.x = -2.25;
    R.elbow.rotation.x = -1.85;
    R.shoulder.rotation.z = 0.14;
    person.arms.find((a) => a.side < 0).shoulder.rotation.z = -0.22;
    return [phone];
  }
  if (kind === 'bag') {
    const bagMat = clay(0x8d5b4a, 0.95);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.085), bagMat);
    bag.position.set(0.02, -0.36, 0.06);
    R.elbow.add(bag);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 6, 14, Math.PI), clay(0x7a4a3a, 0.9));
    handle.position.set(0.02, -0.27, 0.06);
    R.elbow.add(handle);
    R.shoulder.rotation.x = -0.35;
    R.elbow.rotation.x = -0.2;
    return [bag];
  }
  return [];
}

/* ── 발치에 놓는 장난감 (밀어서 굴리는 물건) ── */
export function makePushItem(type) {
  const g = new THREE.Group();
  if (type === 'can') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 14), clay(0xd9d2c4, 0.6));
    can.position.y = 0.065;
    can.castShadow = true;
    g.add(can);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.055, 14), clay(0xc9704f, 0.7));
    band.position.y = 0.07;
    g.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 14), clay(0xb0a89a, 0.5));
    top.position.y = 0.133;
    g.add(top);
  } else if (type === 'box') {
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.22), clay(0xc79a63, 0.97));
    boxM.position.y = 0.1;
    boxM.castShadow = true;
    g.add(boxM);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.205, 0.225), clay(0xe8dcc2, 0.9));
    tape.position.y = 0.1;
    g.add(tape);
  } else if (type === 'pot') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.15, 16), clay(0xc9704f, 0.95));
    pot.position.y = 0.075;
    pot.castShadow = true;
    g.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.02, 16), clay(0x5a4433, 1));
    soil.position.y = 0.15;
    g.add(soil);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), clay(0x6f9270, 0.95));
      leaf.position.set(Math.cos(i * 1.3) * 0.05, 0.21 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.05);
      leaf.scale.set(1, 1.35, 1);
      g.add(leaf);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.14, 8), clay(0x4e7052, 0.95));
    tail.position.set(0.03, 0.22, -0.03);
    tail.rotation.z = -0.3;
    g.add(tail);
  } else {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.19, 0.1), clay(0xf2e6d0, 0.9));
    bag.position.y = 0.1;
    g.add(bag);
  }
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

/* ── 인물 6명 ── */
export const NPC_DEFS = [
  {
    id: 'empty',
    name: '빈손 방문객',
    tag: '초인종만 눌렀다',
    area: 'room',
    pos: [-5.15, -12.18],
    rotY: 0,
    seatY: 0.66,
    pose: 'sit',
    look: {
      skin: 0xeec6a0, hair: 0x3b2b22, glasses: true, glassesColor: 0x8a6a4a, hairStyle: 'short',
      outfit: { outer: 0x8fae94, inner: 0xf6f0e2, pants: 0x4a5870, shoes: 0x5f4632, accent: 0xd9b06a, belt: true },
    },
    hold: null,
    observe: [
      '손은 비었고 눈은 내 츄르를 찾는다. 초인종은 눌렀는데 간식은 안 들고 왔다.',
      '내 자리를 빼앗고 앉아서, 나를 부르는 이름을 세 번 바꿨다. 세 번 다 틀렸다.',
    ],
    prank: {
      kind: 'ankle',
      label: '발목 톡',
      cry: '헉!',
      line: '"으악, 뭐야—" 소파 밑에서 발목을 톡. 손님이 다리를 접고 소파 위로 올라갔다. 내 자리가 반쯤 돌아왔다.',
    },
  },
  {
    id: 'churu',
    name: '츄르 절약가',
    tag: '반 개만 주는 자',
    area: 'room',
    pos: [-2.55, -8.55],
    rotY: 0.45,
    look: {
      skin: 0xf2cba6, hair: 0x2f2320, hairStyle: 'bun', glasses: false,
      outfit: { outer: 0xd9c9a8, inner: 0xfbf4e4, pants: 0x5b4a3c, shoes: 0x8e5a4a, accent: 0xc9704f, belt: true },
    },
    hold: 'churu',
    pushItem: { type: 'can', pos: [-1.92, -8.30] },
    observe: [
      '주머니에 츄르 봉지가 두 개. 하나는 나를 주고, 하나는 자기가 먹을 생각이다.',
      '한 번도 안 준 봉지 비닐 소리를 정확히 기억한다. 그 소리만 나면 다리가 먼저 간다.',
    ],
    prank: {
      kind: 'push',
      label: '캔 툭',
      cry: '어?!',
      line: '"어?! 캔이 왜—" 발치의 캔이 굴러가고, 츄르 봉지가 손에서 미끄러졌다. 반 개가 한 개가 되는 순간은 이렇게 온다.',
    },
  },
  {
    id: 'parcel',
    name: '택배 기사',
    tag: '상자 열 개, 쓰다듬기 0회',
    area: 'alley',
    pos: [3.45, 11.75],
    rotY: Math.PI - 0.25,
    look: {
      skin: 0xe9be9a, hair: 0x2f2320, hairStyle: 'cap', capColor: 0x35506b, glasses: false,
      outfit: { outer: 0x6f8fb5, inner: 0xe8eef4, pants: 0x39445a, shoes: 0x2f2a26, accent: 0x35506b, belt: true },
    },
    hold: 'box',
    pushItem: { type: 'box', pos: [2.80, 11.30] },
    observe: [
      '상자 열 개를 옮겼는데 내 머리는 한 번도 안 쓸었다. 그게 이 골목의 문제다.',
      '손이 두 개뿐인 게 죄다. 대신 발로 문을 닫는다. 나는 그 틈으로 나간다.',
    ],
    prank: {
      kind: 'push',
      label: '상자 밀기',
      cry: '아이고!',
      line: '"아이고!" 작은 상자가 발끝에서 툭. 기사는 잡으려다 두 개를 더 떨어뜨렸고, 그 사이 내가 제일 위에 올라갔다.',
    },
  },
  {
    id: 'grandma',
    name: '장바구니 할머니',
    tag: '바구니에 간식이 없다',
    area: 'alley',
    pos: [-3.45, 9.6],
    rotY: Math.PI + 0.35,
    scale: 0.9,
    look: {
      skin: 0xe8c3a2, hair: 0xd8d3cb, hairStyle: 'cloud', glasses: true, glassesColor: 0xa8463c,
      outfit: {
        outer: 0x8fb0a4, inner: 0xf6efe0, pants: 0x6a4a5a, shoes: 0x35506b, sole: 0xe8dcc2,
        accent: 0xd9b06a, belt: true, skirt: '#8fa88a', skirtDot: '#d6dfbd', strap: 0x8e3a3a,
      },
      shoeStrap: true,
    },
    hold: 'bag',
    observe: [
      '바구니엔 무가 있고 간식은 없다. 순서가 잘못됐다.',
      '나를 아주 오래 봐 준다. 그런데 그 눈은 내 츄르 지갑을 보고 있다.',
    ],
    prank: {
      kind: 'scare',
      label: '야옹!',
      cry: '어머나!',
      line: '"어머나!" 뒤에서 야옹. 할머니가 바구니를 흔들며 웃었고, 나는 미안해서 다리를 한 번 비볐다. 그 손이 결국 내 머리에 왔다.',
    },
  },
  {
    id: 'photo',
    name: '사진사',
    tag: '렌즈만 든 사람',
    area: 'alley',
    pos: [3.35, 6.9],
    rotY: Math.PI - 0.5,
    look: {
      skin: 0xf4cfa9, hair: 0x4a3328, hairStyle: 'long', glasses: false,
      outfit: { outer: 0x8a8060, inner: 0xece4d0, pants: 0x4a4038, shoes: 0x3a2c22, accent: 0xb98a63, belt: true },
    },
    hold: 'camera',
    observe: [
      '렌즈는 세 개, 간식은 0개. 구성이 형편없다.',
      '내 하품을 찍어 놓고 제일 잘 나왔다고 한다. 인정은 한다.',
    ],
    prank: {
      kind: 'ankle',
      label: '발목 톡',
      cry: '우와!',
      line: '"우와—!" 셔터가 하늘을 찍고 다리 한쪽이 접혔다. 렌즈 대신 손이 나를 찾았으니 오늘 사진은 내가 이겼다.',
    },
  },
  {
    id: 'shout',
    name: '큰 소리 통화남',
    tag: '골목을 다 채우는 목소리',
    area: 'alley',
    pos: [-2.35, 15.4],
    rotY: Math.PI + 0.2,
    look: {
      skin: 0xf2cba6, hair: 0x2b211c, hairStyle: 'bald', glasses: false,
      outfit: { outer: 0xc9704f, inner: 0xf6efe0, pants: 0x3f4a5c, shoes: 0x2f2a26, accent: 0xd9b06a, belt: true },
    },
    hold: 'phone',
    observe: [
      '목소리가 골목을 다 채운다. 내 귀를 두 번 놀라게 했고, 앉은 자리엔 이어폰이 없다.',
      '한 손엔 전화기, 다른 손엔 아무것도 없다. 둘 다 내 것이 아닌 게 문제다.',
    ],
    prank: {
      kind: 'scare',
      label: '야옹!',
      cry: '뭐야?!',
      line: '"뭐야?! 야옹?" 수화기 너머에서도 들렸다. 통화는 끊기고, 나는 그 발밑에서 하품을 한 번 했다.',
    },
  },
];

/* ── 무대에 세우기 ── */
export function buildNpcs(parent) {
  const list = [];
  for (const def of NPC_DEFS) {
    const scale = def.scale ?? 1;
    const person = makePerson(def.look);
    const g = person.group;
    g.scale.setScalar(scale);
    g.position.set(def.pos[0], 0, def.pos[1]);
    g.rotation.y = def.rotY;
    if (def.seatY !== undefined) g.position.y = def.seatY - 0.82 * scale;
    const propMeshes = def.hold ? holdItem(person, def.hold, def.look) : [];

    if (def.pose === 'sit') {
      person.legs.forEach(({ thigh, shin }) => {
        thigh.rotation.x = -1.45;
        shin.rotation.x = 1.42;
      });
      person.arms.forEach(({ shoulder, elbow, side }) => {
        shoulder.rotation.x = -0.55;
        shoulder.rotation.z = side * -0.12;
        elbow.rotation.x = -0.9;
      });
    } else if (def.id === 'grandma') {
      person.upper.rotation.x = 0.12;
      person.arms.forEach(({ shoulder }) => { shoulder.rotation.x = -0.35; });
    } else if (def.id === 'photo') {
      person.upper.rotation.x = -0.05;
    }

    parent.add(g);

    // 이름표
    const nameSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nameTexture(def.name, def.tag),
        transparent: true,
        depthTest: false,
        opacity: 0,
      })
    );
    nameSprite.scale.set(0.95, 0.33, 1);
    nameSprite.position.set(def.pos[0], (def.seatY ? 1.84 : 2.12) * scale, def.pos[1]);
    nameSprite.renderOrder = 8;
    parent.add(nameSprite);

    // 발밑 링
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.66, 36),
      new THREE.MeshBasicMaterial({
        color: COL.gold,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(def.pos[0], 0.015, def.pos[1]);
    parent.add(ring);

    // 장난 성공 표시
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: pawBadgeTexture(),
        transparent: true,
        depthTest: false,
        opacity: 0,
      })
    );
    badge.scale.set(0.46, 0.46, 1);
    badge.position.set(def.pos[0], 2.0, def.pos[1]);
    badge.renderOrder = 9;
    parent.add(badge);

    // 밀어서 굴릴 물건
    let pushItem = null;
    if (def.pushItem) {
      const item = makePushItem(def.pushItem.type);
      item.position.set(def.pushItem.pos[0], 0, def.pushItem.pos[1]);
      item.rotation.y = Math.random() * Math.PI * 2;
      parent.add(item);
      pushItem = { group: item, base: item.position.clone(), rotY: item.rotation.y, t: -1, vel: new THREE.Vector3(), spin: 0 };
    }

    // 반응 애니메이션 기준 자세
    const basePose = {
      arms: person.arms.map((a) => ({
        sx: a.shoulder.rotation.x,
        sz: a.shoulder.rotation.z,
        ex: a.elbow.rotation.x,
      })),
      upperX: person.upper.rotation.x,
      headX: person.head.rotation.x,
      scaleY: g.scale.y,
      baseY: g.position.y,
    };

    list.push({
      def,
      group: g,
      person,
      ring,
      badge,
      nameSprite,
      propMeshes,
      pushItem,
      basePose,
      pranked: false,
      pranks: 0,
      phase: Math.random() * Math.PI * 2,
      baseRotY: def.rotY,
      headYaw: 0,
      react: { t: -1, dur: 1.7, kind: '' },
      eyeWide: 0,
    });
  }
  return list;
}
