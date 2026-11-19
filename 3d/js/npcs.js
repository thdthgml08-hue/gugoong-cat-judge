/* 구공이 3D — 채점 대상 인간들 (로우폴리 블록 인형) */
import * as THREE from 'three';
import { COL, std, box, sphere, cyl, nameTexture, badgeTexture } from './gfx.js';

const SKIN = 0xf2cba6;

/* ── 인간 한 명 만들기 ── */
export function makePerson(cfg = {}) {
  const g = new THREE.Group();
  const skin = std(cfg.skin ?? SKIN, { roughness: 0.8 });
  const hairCol = std(cfg.hair ?? 0x4a3328, { roughness: 0.85 });
  const shirt = std(cfg.shirt ?? 0x6f9174, { roughness: 0.9 });
  const pants = std(cfg.pants ?? 0x3f4a5c, { roughness: 0.9 });
  const shoes = std(cfg.shoes ?? 0x3a2c22, { roughness: 0.8 });

  /* 다리 */
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(s * 0.105, 0.82, 0);
    const tm = box(0.15, 0.37, 0.16, pants, 0, -0.185, 0);
    thigh.add(tm);
    const shin = new THREE.Group();
    shin.position.y = -0.37;
    const sm = box(0.125, 0.36, 0.14, pants, 0, -0.18, 0);
    shin.add(sm);
    const shoe = box(0.14, 0.08, 0.25, shoes, 0, -0.38, 0.045);
    shin.add(shoe);
    thigh.add(shin);
    g.add(thigh);
    legs.push({ thigh, shin, shoe });
  }

  /* 상체 */
  const upper = new THREE.Group();
  upper.position.y = 0.82;
  g.add(upper);

  const torso = box(0.42, 0.5, 0.24, shirt, 0, 0.26, 0);
  torso.geometry = new THREE.BoxGeometry(0.42, 0.5, 0.24);
  upper.add(torso);
  // 어깨
  const shoulders = box(0.46, 0.1, 0.25, shirt, 0, 0.47, 0);
  upper.add(shoulders);
  // 목
  upper.add(cyl(0.05, 0.055, 0.08, skin, 0, 0.55, 0));

  const headG = new THREE.Group();
  headG.position.set(0, 0.7, 0);
  upper.add(headG);

  const head = sphere(0.172, skin, 0, 0, 0, 20);
  head.scale.set(1, 1.06, 0.98);
  headG.add(head);

  // 눈
  for (const s of [-1, 1]) {
    const eye = sphere(0.018, std(0x33241a, { roughness: 0.4 }), s * 0.06, 0.015, 0.152, 8);
    eye.scale.set(1, 1.15, 0.6);
    headG.add(eye);
  }
  // 코
  const nose = sphere(0.019, std(0xe0b18d), 0, -0.022, 0.168, 8);
  nose.scale.set(1, 1.1, 0.9);
  headG.add(nose);
  // 입
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.032, 0.006, 6, 12, Math.PI),
    std(0x8a5a4a, { roughness: 0.7 })
  );
  mouth.position.set(0, -0.075, 0.153);
  mouth.rotation.set(0, 0, Math.PI);
  headG.add(mouth);

  // 머리카락
  const style = cfg.hairStyle ?? 'short';
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.44),
    hairCol
  );
  hairCap.position.y = 0.022;
  hairCap.scale.set(1.02, 1.04, 1.02);
  hairCap.castShadow = true;
  headG.add(hairCap);

  if (style === 'bun') {
    headG.add(sphere(0.075, hairCol, 0, 0.09, -0.13, 12));
  } else if (style === 'long') {
    const back = box(0.26, 0.42, 0.1, hairCol, 0, -0.16, -0.12);
    headG.add(back);
    headG.add(box(0.06, 0.3, 0.09, hairCol, -0.14, -0.1, 0.06));
    headG.add(box(0.06, 0.3, 0.09, hairCol, 0.14, -0.1, 0.06));
  } else if (style === 'cap') {
    const cap = cyl(0.17, 0.178, 0.1, std(cfg.capColor ?? 0x3f5a6b), 0, 0.13, 0, 16);
    headG.add(cap);
    headG.add(box(0.27, 0.03, 0.16, std(cfg.capColor ?? 0x3f5a6b), 0, 0.085, 0.12));
    hairCap.visible = false;
  } else if (style === 'scarf') {
    const scarf = new THREE.Mesh(
      new THREE.SphereGeometry(0.198, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      std(cfg.scarfColor ?? 0x8f7bb5, { roughness: 0.95 })
    );
    scarf.position.y = 0.006;
    scarf.scale.set(1.02, 1.04, 1.02);
    scarf.castShadow = true;
    headG.add(scarf);
    headG.add(box(0.12, 0.1, 0.06, std(cfg.scarfColor ?? 0x8f7bb5), 0.11, -0.1, -0.1));
    hairCap.visible = false;
  } else if (style === 'bald') {
    hairCap.visible = false;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.125, 0.028, 6, 16, Math.PI),
      hairCol
    );
    ring.position.set(0, 0.06, -0.01);
    ring.rotation.x = Math.PI / 2.2;
    headG.add(ring);
  }

  if (cfg.glasses) {
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 6, 14), std(0x4d3320));
      lens.position.set(s * 0.058, 0.012, 0.145);
      headG.add(lens);
    }
    headG.add(box(0.03, 0.007, 0.007, std(0x4d3320), 0, 0.012, 0.145));
  }

  /* 팔 */
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.25, 0.46, 0);
    upper.add(shoulder);
    const upperArm = box(0.1, 0.29, 0.12, shirt, 0, -0.145, 0);
    shoulder.add(upperArm);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    shoulder.add(elbow);
    const fore = box(0.09, 0.27, 0.1, cfg.sleeve ? shirt : skin, 0, -0.135, 0);
    elbow.add(fore);
    const hand = sphere(0.058, skin, 0, -0.285, 0.01, 10);
    hand.scale.set(1, 0.95, 0.85);
    elbow.add(hand);
    arms.push({ shoulder, elbow, hand, side: s });
  }

  return { group: g, upper, head: headG, legs, arms, torso };
}

/* ── 사람 위에 얹는 소품 ── */
function holdItem(person, item) {
  const { arms } = person;
  const R = arms.find((a) => a.side === 1); // 오른팔
  const L = arms.find((a) => a.side === -1);

  if (item === 'churu') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), std(0xfff6e4));
    stick.rotation.set(1.3, 0, 0);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.07, 8), std(0xd98b4a));
    tip.rotation.x = 1.3;
    stick.position.set(0, -0.26, 0.12);
    tip.position.set(0, -0.22, 0.2);
    R.elbow.add(stick);
    R.elbow.add(tip);
    R.elbow.rotation.x = -1.3;
  } else if (item === 'box') {
    const bx = box(0.46, 0.34, 0.36, std(0xc59a67), 0, 0.02, 0.2);
    bx.rotation.x = 0.06;
    person.group.add(bx);
    const tape = box(0.47, 0.05, 0.06, std(0xe8d3a8), 0, 0.17, 0.2);
    person.group.add(tape);
    person.group.userData.boxOffY = 1.02;
    bx.position.y = 1.0;
    tape.position.y = 1.17;
    R.shoulder.rotation.x = -0.55;
    L.shoulder.rotation.x = -0.55;
    R.elbow.rotation.x = -1.0;
    L.elbow.rotation.x = -1.0;
  } else if (item === 'camera') {
    const camBody = box(0.2, 0.13, 0.12, std(0x2f2a26), 0, 0, 0);
    const lens = cyl(0.055, 0.06, 0.1, std(0x4a443d), 0, 0, 0.11, 14);
    lens.rotation.x = Math.PI / 2;
    const lensGlass = cyl(0.04, 0.04, 0.02, std(0x7fa8c0, { roughness: 0.2, metalness: 0.3 }), 0, 0, 0.17, 14);
    lensGlass.rotation.x = Math.PI / 2;
    const camG = new THREE.Group();
    camG.add(camBody, lens);
    camG.add(lensGlass);
    camG.position.set(0, 0, 0.06);
    person.head.add(camG);
    camG.position.set(0, -0.01, 0.2);
    R.shoulder.rotation.x = -1.35;
    L.shoulder.rotation.x = -1.35;
    R.elbow.rotation.x = -1.25;
    L.elbow.rotation.x = -1.25;
    R.shoulder.rotation.z = 0.25;
    L.shoulder.rotation.z = -0.25;
  } else if (item === 'phone') {
    const phone = box(0.05, 0.11, 0.015, std(0x2f2a26), 0, 0, 0);
    R.elbow.add(phone);
    phone.position.set(0, -0.3, 0.05);
    phone.rotation.set(0.3, 0, 0);
    R.shoulder.rotation.x = -2.35;
    R.elbow.rotation.x = -1.9;
    R.shoulder.rotation.z = 0.12;
    L.shoulder.rotation.z = -0.2;
    // 벌린 입
    person.head.add(sphere(0.026, std(0x7a3b36), 0, -0.062, 0.146, 8));
  } else if (item === 'bag') {
    const bag = box(0.26, 0.3, 0.16, std(0xb58a5a), 0, 0, 0);
    bag.position.set(0, -0.42, 0.02);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12), std(0x8a5a3a));
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, -0.27, 0.02);
    R.elbow.add(bag);
    R.elbow.add(handle);
    R.elbow.rotation.x = -0.1;
  }
}

/* ── 채점 포인트 6곳 ── */
export const NPC_DEFS = [
  {
    id: 'empty',
    name: '빈손 방문객',
    tag: '초인종만 눌렀다',
    area: 'room',
    pos: [-5.15, -12.28],
    rotY: 0,
    seatY: 0.5,
    pose: 'sit',
    look: { skin: 0xeec6a0, hair: 0x3b2b22, shirt: 0x6f9174, pants: 0x6b4a38, hairStyle: 'short' },
    line: '90점. 손은 비었는데 눈은 내 츄르를 찾고 있었다. 남은 10점은 그 손이 뭘 들고 오는지로 채점한다.',
    note: '초인종을 누르고, 아무것도 들지 않고, 소파에 앉았다.',
  },
  {
    id: 'churu',
    name: '츄르 절약가',
    tag: '반 개만 주는 자',
    area: 'room',
    pos: [-2.55, -8.55],
    rotY: 0.45,
    look: { skin: 0xf2cba6, hair: 0x2f2320, shirt: 0xd9c9a8, pants: 0x5b4a3c, hairStyle: 'bun' },
    prop: 'churu',
    line: '90점. 반 개는 반 사랑이다. 남은 10점은 봉지가 두 개였던 이유로 깎았다.',
    note: '츄르를 반만 짜고 빈 봉지를 주머니에 넣는다.',
  },
  {
    id: 'parcel',
    name: '택배 기사',
    tag: '상자 열 개, 쓰다듬기 0회',
    area: 'alley',
    pos: [3.45, 11.75],
    rotY: Math.PI - 0.25,
    look: { skin: 0xe9be9a, hair: 0x2f2320, shirt: 0x6f8fb5, pants: 0x39445a, hairStyle: 'cap', capColor: 0x35506b },
    prop: 'box',
    line: '90점. 상자 열 개는 옮겼고 내 머리는 한 번도 안 쓸었다. 10점은 문 앞에 두고 가는 손길.',
    note: '상자를 안고 골목을 오른다. 손이 두 개뿐인 게 죄다.',
  },
  {
    id: 'grandma',
    name: '장바구니 할머니',
    tag: '바구니에 간식이 없다',
    area: 'alley',
    pos: [-3.45, 9.6],
    rotY: Math.PI + 0.35,
    scale: 0.88,
    look: { skin: 0xe8c3a2, hair: 0x9a938a, shirt: 0x8f7bb5, pants: 0x4a4256, hairStyle: 'scarf', scarfColor: 0xa98fbe },
    line: '90점. 바구니엔 내 간식이 없지만, 나를 아주 오래 봐 줬다. 10점은 다음 장보기로 외상.',
    note: '장바구니를 끌고 가다가 구공이 앞에서 잠깐 멈춘다.',
  },
  {
    id: 'photo',
    name: '사진사',
    tag: '렌즈만 든 사람',
    area: 'alley',
    pos: [2.05, 6.1],
    rotY: Math.PI - 0.5,
    look: { skin: 0xf4cfa9, hair: 0x4a3328, shirt: 0x8a8060, pants: 0x4a4038, hairStyle: 'long' },
    prop: 'camera',
    line: '90점. 사진은 잘 나왔다. 다만 렌즈 대신 츄르를 들었으면 오늘 100점이었다.',
    note: '구공이만 보면 렌즈를 들이댄다. 간식은 없다.',
  },
  {
    id: 'shout',
    name: '큰 소리 통화남',
    tag: '골목을 다 채우는 목소리',
    area: 'alley',
    pos: [-2.35, 15.4],
    rotY: Math.PI + 0.2,
    look: { skin: 0xf2cba6, hair: 0x2b211c, shirt: 0xc9704f, pants: 0x3f4a5c, hairStyle: 'bald' },
    prop: 'phone',
    line: '90점. 목소리가 골목을 다 채워서 내가 두 번 놀랐다. 10점은 조용히 해서 돌려받아라.',
    note: '가로등 아래에서 통화 중. 이어폰은 없다.',
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
    if (def.prop) holdItem(person, def.prop);

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
      person.upper.rotation.x = 0.22;
      person.arms.forEach(({ shoulder }) => { shoulder.rotation.x = -0.45; });
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
    nameSprite.scale.set(1.22, 0.42, 1);
    nameSprite.position.set(def.pos[0], (def.seatY ? 1.55 : 1.95) * scale, def.pos[1]);
    nameSprite.renderOrder = 8;
    parent.add(nameSprite);

    // 발밑 링
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.68, 36),
      new THREE.MeshBasicMaterial({
        color: COL.gold,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(def.pos[0], 0.015, def.pos[1]);
    parent.add(ring);

    // 채점 완료 배지
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: badgeTexture(),
        transparent: true,
        depthTest: false,
        opacity: 0,
      })
    );
    badge.scale.set(0.5, 0.5, 1);
    badge.position.set(def.pos[0], 1.55 + 0.35, def.pos[1]);
    badge.renderOrder = 9;
    parent.add(badge);

    list.push({
      def,
      group: g,
      person,
      ring,
      badge,
      nameSprite,
      graded: false,
      phase: Math.random() * Math.PI * 2,
      baseRotY: def.rotY,
      headYaw: 0,
    });
  }
  return list;
}
