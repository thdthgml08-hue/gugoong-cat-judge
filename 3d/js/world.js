/* 구공이 3D — 작은 세계: 거실 → 문 → 골목길 */
import * as THREE from 'three';
import {
  COL, std, box, sphere, cyl, canvasTexture,
  woodTexture, cobbleTexture, asphaltTexture, rugTexture, pawTexture,
  chalkTexture, skyWindowTexture, blobShadowTexture,
} from './gfx.js';

const FONT = "'Galmuri11', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

export function buildWorld() {
  const root = new THREE.Group();
  const colliders = [];
  const occluders = [];
  const groundPick = [];
  const animated = [];

  const addCollider = (x, z, w, d) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };

  const mWall = std(COL.wall, { roughness: 0.96, unique: true });
  const mWallOut = std(0xe9d3b2, { roughness: 0.96, unique: true });
  const mWainscot = std(0xe7d0ae, { roughness: 0.95, unique: true });
  const mTrim = std(0xfff6e4, { roughness: 0.9 });
  const mWood = std(COL.wood, { roughness: 0.88 });
  const mWoodDark = std(COL.woodDark, { roughness: 0.85 });
  const mFabric = std(0x8f9c86, { roughness: 1 });
  const mFabric2 = std(0xc9a98b, { roughness: 1 });

  /* ─────────────── 바닥 ─────────────── */
  const roomFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 14),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85, metalness: 0 })
  );
  roomFloor.rotation.x = -Math.PI / 2;
  roomFloor.position.set(0, 0, -7);
  roomFloor.receiveShadow = true;
  root.add(roomFloor);
  groundPick.push(roomFloor);

  const alleyGround = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 26),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.98 })
  );
  alleyGround.rotation.x = -Math.PI / 2;
  alleyGround.position.set(0, -0.004, 10.5);
  alleyGround.receiveShadow = true;
  root.add(alleyGround);
  groundPick.push(alleyGround);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 20.6),
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.002, 10.6);
  path.receiveShadow = true;
  root.add(path);
  groundPick.push(path);

  // 잔디 띠
  const grassMat = std(0x7d9a6a, { roughness: 1 });
  for (const [x, z, w, d] of [[-4.75, 10.5, 1.7, 20.6], [4.75, 10.5, 1.7, 20.6]]) {
    const g = box(w, 0.04, d, grassMat, x, -0.01, z, { cast: false });
    root.add(g);
  }

  /* ─────────────── 집 벽 ─────────────── */
  const WALL_H = 5.0;
  const wall = (w, h, d, mat, x, y, z) => {
    const m = box(w, h, d, mat, x, y, z, { cast: true, receive: true });
    root.add(m);
    occluders.push(m);
    return m;
  };

  // 뒷벽
  wall(16, WALL_H, 0.3, mWall, 0, WALL_H / 2, -14.15);
  // 옆벽
  wall(0.3, WALL_H, 14, mWall, -8.15, WALL_H / 2, -7);
  wall(0.3, WALL_H, 14, mWall, 8.15, WALL_H / 2, -7);
  // 앞벽 (문 구멍: x -1.4 ~ 1.4)
  wall(6.6, WALL_H, 0.3, mWall, -4.7, WALL_H / 2, 0);
  wall(6.6, WALL_H, 0.3, mWall, 4.7, WALL_H / 2, 0);
  wall(2.8, 2.4, 0.3, mWall, 0, 3.8, 0);

  // 걸레받이 / 몰딩
  root.add(box(16, 0.14, 0.06, mTrim, 0, 0.07, -13.96, { cast: false }));
  root.add(box(0.06, 0.14, 14, mTrim, -7.96, 0.07, -7, { cast: false }));
  root.add(box(0.06, 0.14, 14, mTrim, 7.96, 0.07, -7, { cast: false }));
  root.add(box(16, 0.9, 0.03, mWainscot, 0, 0.45, -13.97, { cast: false }));
  root.add(box(0.03, 0.9, 14, mWainscot, -7.97, 0.45, -7, { cast: false }));
  root.add(box(0.03, 0.9, 14, mWainscot, 7.97, 0.45, -7, { cast: false }));

  // 벽 충돌
  addCollider(0, -14.2, 16, 0.6);
  addCollider(-8.2, -7, 0.6, 14.4);
  addCollider(8.2, -7, 0.6, 14.4);
  addCollider(-4.7, 0, 6.6, 0.4);
  addCollider(4.7, 0, 6.6, 0.4);

  /* ─────────────── 창문 · 커튼 ─────────────── */
  const winX = -1.0;
  const winY = 2.0;
  const skyTex = skyWindowTexture();
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 1.75),
    new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })
  );
  glass.position.set(winX, winY, -13.97);
  root.add(glass);
  const frameMat = std(0xfffaf0, { roughness: 0.7 });
  root.add(box(3.1, 0.1, 0.12, frameMat, winX, winY + 0.95, -13.94));
  root.add(box(3.1, 0.1, 0.12, frameMat, winX, winY - 0.95, -13.94));
  root.add(box(0.1, 1.9, 0.12, frameMat, winX - 1.52, winY, -13.94));
  root.add(box(0.1, 1.9, 0.12, frameMat, winX + 1.52, winY, -13.94));
  root.add(box(0.07, 1.85, 0.1, frameMat, winX, winY, -13.92));
  root.add(box(3.0, 0.07, 0.1, frameMat, winX, winY, -13.92));
  root.add(box(3.3, 0.1, 0.28, mTrim, winX, winY - 1.02, -13.9)); // 창틀 선반
  // 커튼
  for (const s of [-1, 1]) {
    const cur = box(0.55, 2.05, 0.1, std(0xd7a98a, { roughness: 1 }), winX + s * 1.72, winY + 0.02, -13.82);
    root.add(cur);
  }
  root.add(cyl(0.03, 0.03, 3.9, mWoodDark, winX, winY + 1.1, -13.82, 8).rotateZ(Math.PI / 2));

  // 앞벽 창 (집 밖에서도 보이는)
  const glass2 = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.3),
    new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false, side: THREE.DoubleSide })
  );
  glass2.position.set(-4.9, 1.95, -0.17);
  glass2.rotation.y = Math.PI;
  root.add(glass2);
  root.add(box(2.2, 0.09, 0.14, frameMat, -4.9, 2.64, -0.16));
  root.add(box(2.2, 0.09, 0.14, frameMat, -4.9, 1.27, -0.16));
  root.add(box(0.09, 1.45, 0.14, frameMat, -5.96, 1.95, -0.16));
  root.add(box(0.09, 1.45, 0.14, frameMat, -3.84, 1.95, -0.16));
  root.add(box(0.06, 1.36, 0.1, frameMat, -4.9, 1.95, -0.16));

  /* ─────────────── 벽시계 · 액자 ─────────────── */
  const clock = new THREE.Group();
  clock.position.set(6.4, 2.9, -13.94);
  const cFace = cyl(0.32, 0.32, 0.06, std(0xfffaf0), 0, 0, 0, 26);
  cFace.rotation.x = Math.PI / 2;
  clock.add(cFace);
  clock.add(cyl(0.35, 0.35, 0.04, mWoodDark, 0, 0, -0.02, 26).rotateX(Math.PI / 2));
  const hand1 = box(0.02, 0.18, 0.02, std(COL.ink), 0, 0.08, 0.045);
  const hand2 = box(0.02, 0.12, 0.02, std(COL.ink), 0.05, 0.02, 0.045, { rotZ: -1.1 });
  clock.add(hand1, hand2);
  root.add(clock);

  const artTex = (kind) => canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#f8efdd';
    c.fillRect(0, 0, w, h);
    if (kind === 0) {
      c.fillStyle = '#c9704f';
      c.beginPath();
      c.arc(w / 2, h / 2, 84, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fffaf0';
      c.font = `700 96px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('90', w / 2, h / 2 + 6);
    } else {
      c.strokeStyle = '#8a6b52';
      c.lineWidth = 8;
      c.strokeRect(24, 24, w - 48, h - 48);
      c.fillStyle = '#b98a5a';
      c.font = `700 52px ${FONT}`;
      c.textAlign = 'center';
      c.fillText('집사', w / 2, 104);
      c.fillStyle = '#7a5f45';
      c.font = `400 34px ${FONT}`;
      c.fillText('월 90점', w / 2, 164);
    }
  }, { repeat: false });

  [0, 1].forEach((k) => {
    const f = new THREE.Group();
    f.position.set(3.0 + k * 1.35, 2.45, -13.93);
    f.add(box(1.0, 1.0, 0.06, mWoodDark, 0, 0, 0));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshBasicMaterial({ map: artTex(k) }));
    art.position.z = 0.04;
    f.add(art);
    root.add(f);
  });

  /* ─────────────── 소파 ─────────────── */
  const sofa = new THREE.Group();
  sofa.position.set(-5.2, 0, -12.75);
  sofa.add(box(3.4, 0.32, 1.35, mFabric, 0, 0.34, 0));
  sofa.add(box(3.4, 0.62, 0.32, mFabric, 0, 0.72, -0.52));
  sofa.add(box(0.34, 0.62, 1.35, mFabric, -1.55, 0.5, 0));
  sofa.add(box(0.34, 0.62, 1.35, mFabric, 1.55, 0.5, 0));
  for (const s of [-1, 1]) {
    sofa.add(box(1.42, 0.18, 1.1, mFabric2, s * 0.76, 0.58, 0.05));
    sofa.add(box(0.62, 0.42, 0.14, std(0xd8b98f), s * 0.85, 0.82, -0.34, { rotZ: s * 0.05 }));
  }
  for (const [x, z] of [[-1.5, 0.55], [1.5, 0.55], [-1.5, -0.55], [1.5, -0.55]]) {
    sofa.add(box(0.14, 0.16, 0.14, mWoodDark, x, 0.1, z));
  }
  root.add(sofa);
  addCollider(-5.2, -12.75, 3.6, 1.55);

  /* ─────────────── 찬장 · 콘솔 ─────────────── */
  const counter = new THREE.Group();
  counter.position.set(-7.35, 0, -3.3);
  counter.add(box(1.0, 0.84, 2.8, std(0xd8c3a2, { roughness: 0.95 }), 0, 0.42, 0));
  counter.add(box(1.12, 0.08, 2.95, mWood, 0, 0.88, 0));
  for (let i = 0; i < 2; i++) {
    counter.add(box(0.03, 0.62, 1.24, std(0xc9b291), 0.51, 0.44, -0.7 + i * 1.4));
    counter.add(box(0.04, 0.05, 0.16, std(COL.gold), 0.54, 0.62, -0.7 + i * 1.4));
  }
  counter.add(cyl(0.14, 0.17, 0.22, std(0x8f9c86, { roughness: 0.6, metalness: 0.15 }), -0.1, 1.03, -0.75, 14));
  counter.add(cyl(0.05, 0.05, 0.1, std(0x6f7a66), -0.1, 1.18, -0.75, 8));
  counter.add(cyl(0.09, 0.09, 0.2, std(0xf0e0c4), 0.12, 1.02, 0.15, 12));
  counter.add(cyl(0.09, 0.09, 0.14, std(0xc9704f), 0.12, 1.02, 0.45, 12));
  counter.add(sphere(0.1, std(0x6f9270), 0.18, 1.05, 0.8, 10));
  root.add(counter);
  addCollider(-7.35, -3.3, 1.15, 3.0);

  const console2 = new THREE.Group();
  console2.position.set(6.85, 0, -2.5);
  console2.add(box(0.7, 0.72, 1.5, mWoodDark, 0, 0.36, 0));
  console2.add(box(0.8, 0.06, 1.6, mWood, 0, 0.75, 0));
  console2.add(cyl(0.14, 0.1, 0.09, std(0x8f7bb5), 0, 0.82, -0.3, 14));
  for (let i = 0; i < 3; i++) {
    console2.add(cyl(0.008, 0.008, 0.09, std(COL.gold), -0.1 + i * 0.1, 0.78, 0.4, 5));
  }
  root.add(console2);
  addCollider(6.85, -2.5, 0.85, 1.6);

  /* ─────────────── 러그 · 탁자 ─────────────── */
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 4.3),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-3.9, 0.006, -10.15);
  rug.receiveShadow = true;
  root.add(rug);

  const table = new THREE.Group();
  table.position.set(-4.5, 0, -9.3);
  const top = cyl(1.15, 1.15, 0.12, mWood, 0, 0.42, 0, 26);
  table.add(top);
  table.add(cyl(0.14, 0.18, 0.4, mWoodDark, 0, 0.2, 0, 12));
  table.add(cyl(0.4, 0.4, 0.05, mWoodDark, 0, 0.03, 0, 16));
  // 머그
  const mug = cyl(0.08, 0.07, 0.13, std(0xd88a6a), 0.4, 0.55, 0.18, 14);
  table.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI * 1.2), std(0xd88a6a));
  handle.position.set(0.48, 0.56, 0.18);
  handle.rotation.y = Math.PI / 2;
  table.add(handle);
  // 털실
  const yarn = sphere(0.14, std(0xd98b4a, { roughness: 1 }), -0.42, 0.55, 0.05, 14);
  table.add(yarn);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.006, 4, 20), std(0xb5713c));
    ring.position.set(-0.42, 0.55, 0.05);
    ring.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0);
    table.add(ring);
  }
  root.add(table);
  addCollider(-4.5, -9.3, 2.3, 2.3);

  /* ─────────────── 캣타워 ─────────────── */
  const tower = new THREE.Group();
  tower.position.set(6.15, 0, -12.2);
  tower.add(box(1.2, 0.14, 1.2, mFabric2, 0, 0.07, 0));
  tower.add(cyl(0.13, 0.15, 1.25, mWood, -0.3, 0.7, -0.25, 10));
  tower.add(cyl(0.13, 0.15, 0.95, mWood, 0.28, 0.55, 0.32, 10));
  tower.add(box(1.05, 0.12, 1.0, mFabric2, -0.3, 1.36, -0.25));
  tower.add(box(0.62, 0.12, 0.62, mFabric2, 0.28, 1.06, 0.32));
  // 집
  const house = box(0.78, 0.62, 0.7, std(0xd9b98f), 0.1, 1.75, -0.1);
  tower.add(house);
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 18),
    new THREE.MeshBasicMaterial({ color: 0x5b4534 })
  );
  hole.position.set(0.1, 1.78, 0.26);
  tower.add(hole);
  tower.add(box(0.94, 0.1, 0.86, std(0xc9a47c), 0.1, 2.11, -0.1));
  // 매달린 장난감
  const toyPivot = new THREE.Group();
  toyPivot.position.set(0.62, 1.42, 0.28);
  const toyString = cyl(0.008, 0.008, 0.45, std(0xe8dcc4), 0, -0.22, 0, 6);
  toyPivot.add(toyString);
  const toy = sphere(0.075, std(0xc9704f), 0, -0.46, 0, 12);
  toyPivot.add(toy);
  tower.add(toyPivot);
  animated.push({ kind: 'swing', obj: toyPivot, amp: 0.22, speed: 1.4 });
  root.add(tower);
  addCollider(6.15, -12.2, 1.4, 1.4);

  /* ─────────────── 펫방석 · 장난감 ─────────────── */
  const bed = new THREE.Group();
  bed.position.set(3.9, 0, -7.6);
  bed.add(cyl(0.72, 0.66, 0.16, std(0xc9704f, { roughness: 1 }), 0, 0.08, 0, 24));
  bed.add(cyl(0.55, 0.55, 0.12, std(0xf3dcc0, { roughness: 1 }), 0, 0.14, 0, 24));
  bed.add(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.1, 8, 24), std(0xb1544c, { roughness: 1 })));
  bed.children[2].rotation.x = Math.PI / 2;
  bed.children[2].position.y = 0.12;
  root.add(bed);

  const ball = sphere(0.16, std(0xd98b4a, { roughness: 0.8 }), 1.75, 0.16, -9.6, 14);
  root.add(ball);
  const mouseToy = new THREE.Group();
  mouseToy.position.set(-1.4, 0, -11.2);
  mouseToy.add(sphere(0.13, std(0x9a8f80), 0, 0.11, 0, 12));
  mouseToy.add(sphere(0.02, std(COL.ink), 0.04, 0.2, 0.1, 6));
  mouseToy.add(cyl(0.012, 0.008, 0.3, std(0x8a8078), 0, 0.08, -0.2, 5).rotateX(Math.PI / 2));
  root.add(mouseToy);

  /* ─────────────── 화분 ─────────────── */
  const plant = new THREE.Group();
  plant.position.set(3.35, 0, -13.15);
  const pot = cyl(0.32, 0.24, 0.46, std(0xb5713c), 0, 0.23, 0, 18);
  plant.add(pot);
  plant.add(cyl(0.3, 0.3, 0.06, std(0x5b4534), 0, 0.47, 0, 18));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stem = cyl(0.015, 0.015, 0.55 + (i % 3) * 0.14, std(0x5f7a52), Math.cos(a) * 0.08, 0.78 + (i % 3) * 0.07, Math.sin(a) * 0.08, 6);
    stem.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    plant.add(stem);
    const leaf = sphere(0.2, std(i % 2 ? 0x6f9270 : 0x5f8a68, { roughness: 0.95 }), Math.cos(a) * 0.3, 1.0 + (i % 3) * 0.13, Math.sin(a) * 0.3, 12);
    leaf.scale.set(1, 0.62, 0.75);
    leaf.rotation.set(0.2, a, -0.2);
    plant.add(leaf);
  }
  root.add(plant);
  addCollider(3.35, -13.15, 0.8, 0.8);

  /* ─────────────── 책장 ─────────────── */
  const shelf = new THREE.Group();
  shelf.position.set(7.62, 0, -8.1);
  shelf.add(box(0.42, 2.1, 2.9, mWoodDark, 0, 1.05, 0));
  for (let i = 0; i < 3; i++) {
    shelf.add(box(0.38, 0.06, 2.7, mWood, 0, 0.5 + i * 0.62, 0));
    for (let k = 0; k < 7; k++) {
      const cols = [0xc9704f, 0x6f8fb5, 0x8f9c76, 0xd8b98f, 0xb1544c, 0x7a6f95];
      const bh = 0.3 + ((k * 7 + i * 3) % 4) * 0.04;
      shelf.add(box(0.26, bh, 0.11, std(cols[(k + i) % cols.length]), 0.03, 0.53 + i * 0.62 + bh / 2, -1.1 + k * 0.3, { rotY: 0.02 }));
    }
  }
  root.add(shelf);
  addCollider(7.62, -8.1, 0.8, 3.1);

  /* ─────────────── 펜던트 조명 ─────────────── */
  const lamp = new THREE.Group();
  lamp.position.set(-0.6, 3.55, -6.4);
  lamp.add(cyl(0.012, 0.012, 0.55, std(0x3a2c22), 0, -0.2, 0, 6));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.34, 20, 1, true), std(0xe8c9a0, { roughness: 0.9, side: THREE.DoubleSide }));
  shade.position.y = -0.62;
  shade.rotation.x = Math.PI;
  lamp.add(shade);
  const bulb = sphere(0.11, new THREE.MeshBasicMaterial({ color: 0xffe7b8 }), 0, -0.72, 0, 12);
  lamp.add(bulb);
  root.add(lamp);

  const roomLight = new THREE.PointLight(0xffd9a0, 20, 17, 2);
  roomLight.position.set(-0.6, 2.72, -6.4);
  roomLight.castShadow = false;
  root.add(roomLight);

  /* ─────────────── 문 · 현관 ─────────────── */
  // 문틀
  const doorW = 2.7;
  root.add(box(0.16, 2.7, 0.36, mWoodDark, -1.42, 1.35, 0));
  root.add(box(0.16, 2.7, 0.36, mWoodDark, 1.42, 1.35, 0));
  root.add(box(3.0, 0.16, 0.36, mWoodDark, 0, 2.66, 0));
  // 문짝 (바깥으로 활짝)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(1.32, 0, 0.17);
  doorPivot.rotation.y = Math.PI - 0.16;
  const doorPanel = box(2.58, 2.55, 0.08, std(0xb98a5c, { roughness: 0.85 }), -1.29, 1.28, 0);
  doorPivot.add(doorPanel);
  for (const [dx, dy, dw, dh] of [[-1.29, 1.75, 2.0, 0.95], [-1.29, 0.62, 2.0, 0.85]]) {
    doorPivot.add(box(dw, dh, 0.03, std(0xc99a6a), dx, dy, 0.06));
  }
  const knob = sphere(0.06, std(COL.gold, { metalness: 0.35, roughness: 0.5 }), -2.3, 1.25, 0.1, 12);
  doorPivot.add(knob);
  root.add(doorPivot);
  addCollider(2.6, 0.28, 2.5, 0.4);

  // 문턱 · 발매트
  root.add(box(2.9, 0.09, 0.5, mWoodDark, 0, 0.02, 0, { cast: false }));
  const matIn = box(1.9, 0.04, 1.0, std(0x9c7f5f, { roughness: 1 }), 0, 0.03, -0.85);
  root.add(matIn);
  const matOut = box(1.9, 0.04, 1.0, std(0x9c7f5f, { roughness: 1 }), 0, 0.03, 0.9);
  root.add(matOut);

  // 문패 · 현관등
  const plate = new THREE.Group();
  plate.position.set(1.95, 1.85, -0.18);
  plate.add(box(0.42, 0.24, 0.04, std(COL.gold, { metalness: 0.3, roughness: 0.6 }), 0, 0, 0));
  const plateTex = canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#e8b45a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a3720';
    c.font = `700 92px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('90', w / 2, h / 2);
  }, { repeat: false });
  const plateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), new THREE.MeshBasicMaterial({ map: plateTex }));
  plateFace.position.z = 0.025;
  plateFace.rotation.y = Math.PI;
  plate.add(plateFace);
  root.add(plate);

  const porchLamp = new THREE.Group();
  porchLamp.position.set(-1.95, 2.35, 0.18);
  porchLamp.add(box(0.2, 0.1, 0.2, mWoodDark, 0, 0.06, 0));
  const pl = sphere(0.09, new THREE.MeshBasicMaterial({ color: 0xffdca8 }), 0, -0.04, 0, 10);
  porchLamp.add(pl);
  root.add(porchLamp);
  const porchLight = new THREE.PointLight(0xffc98a, 3.2, 5.5, 2);
  porchLight.position.set(-1.95, 2.3, 0.4);
  root.add(porchLight);

  // 현관 차양
  root.add(box(3.4, 0.1, 1.1, std(0xb98a5c), 0, 2.72, 0.55));
  root.add(box(3.4, 0.14, 0.08, mWoodDark, 0, 2.78, 1.09));
  root.add(box(0.08, 0.55, 0.08, mWoodDark, -1.5, 2.45, 1.05));
  root.add(box(0.08, 0.55, 0.08, mWoodDark, 1.5, 2.45, 1.05));

  // 계단
  root.add(box(3.6, 0.1, 1.1, std(0xb9ab97), 0, 0.02, 1.3, { cast: false }));
  // 집 외벽 하단 마감
  root.add(box(16.4, 0.18, 0.34, std(0x9a8064), 0, 0.09, 0.02, { cast: false }));

  /* ─────────────── 골목: 집들 ─────────────── */
  const facade = new THREE.Group();
  const facadeCols = [0xe8d2b2, 0xdcc3a4, 0xefdcc2, 0xd8bfa2, 0xe4c9ad, 0xd2b795];
  const roofs = [0x9a7a5f, 0x8a6a52, 0xa4826a];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const h = [5.2, 4.3, 5.6][i];
      const z0 = 2.2 + i * 6.4;
      const w = 6.2;
      const b = box(1.6, h, w, std(facadeCols[(i + (side > 0 ? 3 : 0)) % facadeCols.length], { roughness: 0.96 }), side * 6.35, h / 2, z0);
      facade.add(b);
      // 지붕
      facade.add(box(2.1, 0.22, w + 0.4, std(roofs[i % 3]), side * 6.35, h + 0.1, z0));
      facade.add(box(1.6, 0.36, 0.3, std(roofs[i % 3]), side * 6.35, h + 0.3, z0 - w / 2 + 0.15));
      // 창문
      for (let k = 0; k < 2; k++) {
        const wz = z0 - w / 2 + 1.5 + k * 3.2;
        const wy = 1.7 + (i % 2) * 0.9;
        const wm = box(0.1, 1.35, 1.05, std(0x6c8fa8, { roughness: 0.4, metalness: 0.1 }), side * 5.48, wy, wz);
        facade.add(wm);
        facade.add(box(0.14, 1.5, 0.12, std(0xfff6e4), side * 5.45, wy, wz - 0.58));
        facade.add(box(0.14, 1.5, 0.12, std(0xfff6e4), side * 5.45, wy, wz + 0.58));
        facade.add(box(0.14, 0.12, 1.18, std(0xfff6e4), side * 5.45, wy + 0.72, wz));
        facade.add(box(0.14, 0.12, 1.18, std(0xfff6e4), side * 5.45, wy - 0.72, wz));
        facade.add(box(0.14, 0.08, 1.06, std(0xfff6e4), side * 5.45, wy, wz));
      }
      // 현관문
      const dz = z0 - w / 2 + 0.75;
      facade.add(box(0.12, 1.95, 0.9, std(0x8a6a52), side * 5.47, 0.98, dz));
      facade.add(box(0.16, 0.1, 1.1, std(0xfff6e4), side * 5.45, 2.0, dz));
      // 차양 (가게 느낌)
      if (i === 1) {
        const stripe = canvasTexture(128, 64, (c, w, h) => {
          for (let s = 0; s < 8; s++) {
            c.fillStyle = s % 2 ? '#c9704f' : '#f8efdd';
            c.fillRect((s * w) / 8, 0, w / 8, h);
          }
        }, { repeat: false });
        const aw = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 3.2), new THREE.MeshBasicMaterial({ map: stripe }));
        aw.position.set(side * 5.45, 2.45, z0 + 1.2);
        aw.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        aw.rotation.x = 0.35;
        facade.add(aw);
      }
    }
  }
  root.add(facade);
  addCollider(-6.35, 10.5, 1.8, 21);
  addCollider(6.35, 10.5, 1.8, 21);

  // 집 옆 틈 막는 울타리
  for (const side of [-1, 1]) {
    const fx = side * 5.95;
    const fenceG = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      fenceG.add(box(0.12, 0.9, 0.3, mWood, -0.65 + i * 0.44, 0.45, 0));
    }
    fenceG.add(box(1.5, 0.12, 0.14, mWood, 0, 0.66, 0));
    fenceG.add(box(1.5, 0.12, 0.14, mWood, 0, 0.3, 0));
    fenceG.position.set(fx, 0, 0.55);
    fenceG.rotation.y = Math.PI / 2;
    root.add(fenceG);
    addCollider(fx, 0.55, 0.5, 1.6);
  }

  /* ─────────────── 뒤 울타리 ─────────────── */
  const backFence = new THREE.Group();
  backFence.position.set(0, 0, 20.4);
  for (let i = -8; i <= 8; i++) {
    backFence.add(box(0.16, 1.15, 0.14, mWood, i * 0.75, 0.58, 0));
    const tip = box(0.18, 0.16, 0.16, mWoodDark, i * 0.75, 1.2, 0);
    tip.rotation.y = Math.PI / 4;
    backFence.add(tip);
  }
  backFence.add(box(12.4, 0.12, 0.1, mWoodDark, 0, 0.45, 0.12));
  backFence.add(box(12.4, 0.12, 0.1, mWoodDark, 0, 0.95, 0.12));
  root.add(backFence);
  addCollider(0, 20.4, 13, 0.6);

  // 울타리 뒤 수풀 · 언덕
  for (let i = 0; i < 14; i++) {
    const x = -7 + i * 1.05;
    const b = sphere(0.9 + Math.random() * 0.5, std(i % 2 ? 0x6f8a5f : 0x7d9a6a, { roughness: 1 }), x, 0.7 + Math.random() * 0.3, 21.6 + Math.random() * 0.8, 10);
    b.scale.set(1.2, 0.9, 1);
    root.add(b);
  }
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(9 + i * 2, 5 + (i % 2) * 2, 7), std(0xd8b48f, { roughness: 1 }));
    hill.position.set(-24 + i * 12, 0.4, 30 + (i % 2) * 3);
    hill.rotation.y = i;
    root.add(hill);
  }

  /* ─────────────── 가로등 ─────────────── */
  const street = new THREE.Group();
  street.position.set(3.35, 0, 4.25);
  street.add(cyl(0.22, 0.3, 0.35, std(0x4a4038), 0, 0.17, 0, 12));
  street.add(cyl(0.09, 0.11, 3.3, std(0x3f4a4a), 0, 1.9, 0, 10));
  const armCurve = new THREE.Group();
  armCurve.position.set(0, 3.55, 0);
  const arm = cyl(0.06, 0.06, 0.9, std(0x3f4a4a), -0.42, 0.05, 0, 8);
  arm.rotation.z = Math.PI / 2;
  armCurve.add(arm);
  armCurve.add(cyl(0.06, 0.06, 0.3, std(0x3f4a4a), -0.85, -0.1, 0, 8));
  const lampHead = cyl(0.3, 0.16, 0.26, std(0x3f4a4a), -0.85, -0.3, 0, 12);
  armCurve.add(lampHead);
  const lampGlow = sphere(0.15, new THREE.MeshBasicMaterial({ color: 0xffe2ab }), -0.85, -0.42, 0, 12);
  armCurve.add(lampGlow);
  street.add(armCurve);
  root.add(street);
  const streetLight = new THREE.PointLight(0xffc98a, 9, 13, 2);
  streetLight.position.set(2.5, 3.2, 4.25);
  root.add(streetLight);
  addCollider(3.35, 4.25, 0.7, 0.7);

  /* ─────────────── 우체통 ─────────────── */
  const mail = new THREE.Group();
  mail.position.set(-3.75, 0, 2.7);
  const mRed = std(0xb1544c, { roughness: 0.7 });
  mail.add(box(0.8, 0.95, 0.55, mRed, 0, 1.15, 0));
  mail.add(cyl(0.4, 0.4, 0.1, mRed, 0, 1.62, 0, 16).rotateZ(Math.PI / 2));
  const mailTop = cyl(0.4, 0.4, 0.85, mRed, 0, 1.65, 0, 20);
  mailTop.rotation.z = Math.PI / 2;
  mail.add(mailTop);
  mail.add(box(0.5, 0.06, 0.06, std(0x6d332f), 0, 1.35, 0.29));
  mail.add(box(0.14, 0.72, 0.14, std(0x6d332f), -0.25, 0.36, 0));
  mail.add(box(0.14, 0.72, 0.14, std(0x6d332f), 0.25, 0.36, 0));
  // 꽂힌 편지
  mail.add(box(0.34, 0.22, 0.02, std(0xfff6e4), 0.15, 1.55, 0.3, { rotZ: 0.2, rotX: -0.3 }));
  mail.add(box(0.34, 0.22, 0.02, std(0xf4e2c2), -0.18, 1.42, 0.3, { rotZ: -0.35, rotX: -0.2 }));
  root.add(mail);
  addCollider(-3.75, 2.7, 1.1, 0.9);

  /* ─────────────── 택배 상자 더미 ─────────────── */
  const boxesG = new THREE.Group();
  boxesG.position.set(4.55, 0, 13.0);
  const cardboard = std(0xc59a67, { roughness: 0.95 });
  const tapeMat = std(0xe8d3a8);
  const stacks = [
    [0, 0.28, 0, 0.9, 0.56, 0.8],
    [0.1, 0.78, 0.05, 0.75, 0.44, 0.7],
    [-0.05, 1.12, 0.02, 0.5, 0.36, 0.5],
    [0.95, 0.22, 0.3, 0.7, 0.44, 0.6],
    [-0.85, 0.2, -0.2, 0.6, 0.4, 0.55],
  ];
  for (const [x, y, z, w, h, d] of stacks) {
    boxesG.add(box(w, h, d, cardboard, x, y, z, { rotY: (x + z) * 0.12 }));
    boxesG.add(box(w * 0.98, 0.03, 0.1, tapeMat, x, y + h / 2, z, { rotY: (x + z) * 0.12 }));
  }
  root.add(boxesG);
  addCollider(4.55, 13.0, 2.4, 1.9);

  /* ─────────────── 할머니 손수레 ─────────────── */
  const cart = new THREE.Group();
  cart.position.set(-4.55, 0, 9.0);
  cart.rotation.y = 0.5;
  cart.add(box(0.66, 0.6, 0.8, std(0xb9ab97, { roughness: 0.6 }), 0, 0.66, 0));
  const meshMat = std(0x7d7468, { roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    cart.add(box(0.68, 0.03, 0.03, meshMat, 0, 0.5 + i * 0.18, 0.4));
    cart.add(box(0.03, 0.03, 0.82, meshMat, -0.33, 0.5 + i * 0.18, 0.4));
  }
  cart.add(cyl(0.02, 0.02, 0.9, meshMat, 0, 1.1, -0.38, 6));
  cart.add(box(0.5, 0.06, 0.06, std(0x4a4038), 0, 1.52, -0.38));
  for (const s of [-1, 1]) {
    const wheel = cyl(0.14, 0.14, 0.07, std(0x3a2c22), s * 0.3, 0.14, 0.28, 12);
    wheel.rotation.z = Math.PI / 2;
    cart.add(wheel);
  }
  // 장바구니 속 장바구니
  cart.add(box(0.5, 0.28, 0.42, std(0x8f7bb5), 0, 0.95, 0.05));
  cart.add(sphere(0.11, std(0x6f9270), -0.12, 0.55, 0.06, 10));
  cart.add(sphere(0.1, std(0xc9704f), 0.14, 0.55, -0.1, 10));
  cart.add(cyl(0.07, 0.07, 0.22, std(0xf4e2c2), 0.04, 0.62, 0.2, 10));
  root.add(cart);
  addCollider(-4.55, 9.0, 1.0, 1.1);

  /* ─────────────── 벤치 · 화분 ─────────────── */
  const bench = new THREE.Group();
  bench.position.set(4.4, 0, 8.5);
  bench.rotation.y = -Math.PI / 2;
  bench.add(box(1.7, 0.09, 0.5, mWood, 0, 0.46, 0));
  bench.add(box(1.7, 0.42, 0.08, mWood, 0, 0.72, -0.24));
  for (const s2 of [-1, 1]) {
    bench.add(box(0.1, 0.46, 0.5, mWoodDark, s2 * 0.7, 0.23, 0));
    bench.add(box(0.1, 0.46, 0.5, std(0x9a7a5f), s2 * 0.7, 0.72, -0.24));
  }
  root.add(bench);
  addCollider(4.4, 8.5, 0.7, 1.8);

  const potAt = (x, z, col) => {
    const g2 = new THREE.Group();
    g2.position.set(x, 0, z);
    g2.add(cyl(0.17, 0.12, 0.28, std(0xb5713c), 0, 0.14, 0, 12));
    g2.add(cyl(0.16, 0.16, 0.04, std(0x5b4534), 0, 0.29, 0, 12));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g2.add(sphere(0.07, std(col, { roughness: 0.9 }), Math.cos(a) * 0.08, 0.38, Math.sin(a) * 0.08, 8));
    }
    g2.add(sphere(0.1, std(0x6f9270), 0, 0.4, 0, 10));
    root.add(g2);
  };
  potAt(-5.15, 4.2, 0xd98b6a);
  potAt(5.1, 6.4, 0xe8b45a);
  potAt(-5.1, 12.4, 0xc9704f);
  potAt(5.05, 15.9, 0xd98b6a);

  // 우체통 옆 나무 상자
  root.add(box(0.5, 0.4, 0.5, std(0xb98a5c), -2.9, 0.2, 2.4, { rotY: 0.2 }));
  root.add(box(0.4, 0.3, 0.4, std(0xa97a4c), -2.7, 0.55, 2.5, { rotY: -0.3 }));

  /* ─────────────── 나무 · 수풀 ─────────────── */
  const treeAt = (x, z, s = 1) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.add(cyl(0.18 * s, 0.24 * s, 2.1 * s, std(0x8a6a52), 0, 1.05 * s, 0, 8));
    for (let i = 0; i < 3; i++) {
      const c = sphere(
        (0.95 - i * 0.12) * s,
        std(i % 2 ? 0x6f9270 : 0x5f8a68, { roughness: 1 }),
        (i - 1) * 0.55 * s,
        (2.2 + i * 0.45) * s,
        (i % 2) * 0.35 * s,
        12
      );
      c.scale.set(1, 0.85, 1);
      t.add(c);
    }
    root.add(t);
    addCollider(x, z, 0.7 * s, 0.7 * s);
  };
  treeAt(-4.5, 6.6, 1.0);
  treeAt(4.6, 17.4, 1.1);
  treeAt(-4.5, 15.2, 0.9);
  treeAt(2.9, 21.4, 1.2);

  for (let i = 0; i < 8; i++) {
    const x = (i % 2 ? 1 : -1) * (4.9 + Math.random() * 0.4);
    const z = 3 + i * 2.2;
    const b = sphere(0.45 + Math.random() * 0.2, std(0x6f8a5f, { roughness: 1 }), x, 0.36, z, 10);
    b.scale.set(1.2, 0.8, 1.2);
    root.add(b);
  }

  /* ─────────────── 현수막 깃발 ─────────────── */
  const buntingCols = [0xc9704f, 0xe8b45a, 0x6f8fb5, 0x8f9c76, 0xd7a98a];
  const bunting = new THREE.Group();
  const flagGeo = new THREE.ConeGeometry(0.16, 0.28, 3);
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const x = -5.3 + t * 10.6;
    const sag = Math.sin(t * Math.PI) * 0.65;
    const f = new THREE.Mesh(flagGeo, std(buntingCols[i % buntingCols.length], { roughness: 0.9, side: THREE.DoubleSide }));
    f.position.set(x, 3.35 - sag, 8.4);
    f.rotation.x = Math.PI;
    f.rotation.y = Math.PI / 2;
    bunting.add(f);
  }
  const stringMat = std(0x6d5a48);
  root.add(bunting);
  root.add(box(10.9, 0.02, 0.02, stringMat, 0, 3.24, 8.4, { cast: false }));

  /* ─────────────── 바닥 낙서 · 발도장 ─────────────── */
  const chalk = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    new THREE.MeshBasicMaterial({ map: chalkTexture(), transparent: true, opacity: 0.75, depthWrite: false })
  );
  chalk.rotation.x = -Math.PI / 2;
  chalk.position.set(1.55, 0.012, 3.4);
  root.add(chalk);

  const pawTex = pawTexture();
  const pawMat = new THREE.MeshBasicMaterial({ map: pawTex, transparent: true, opacity: 0.5, depthWrite: false });
  const trail = [
    [0.4, -4.2, 0.1], [0.1, -3.2, 0.5], [-0.2, -2.2, 0.9], [0.1, -1.2, 0.2],
    [0.3, 0.9, 0.15], [0.2, 2.0, 0.35], [-0.1, 3.0, 0.8], [0.1, 4.1, 0.2],
    [0.3, 5.2, 0.4], [0.0, 6.3, 0.9],
  ];
  trail.forEach(([x, z, r], i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), pawMat);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = r + (i % 2 ? 0.1 : -0.1);
    p.position.set(x + (i % 2 ? 0.18 : -0.18), 0.011, z);
    root.add(p);
  });

  // 골목 바닥 얼룩 (분위기)
  const stainMat = new THREE.MeshBasicMaterial({ color: 0x6f665c, transparent: true, opacity: 0.12, depthWrite: false });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.7, 16), stainMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(-8 + Math.random() * 16, 0.008, 1 + Math.random() * 18);
    s.scale.set(1, 0.6, 1);
    root.add(s);
  }

  /* ─────────────── 하늘 ─────────────── */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      cTop: { value: new THREE.Color(0x86bddd) },
      cMid: { value: new THREE.Color(0xffe1bd) },
      cBot: { value: new THREE.Color(0xf6cda2) },
    },
    vertexShader: `
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 cTop;
      uniform vec3 cMid;
      uniform vec3 cBot;
      void main() {
        float h = normalize(vP).y;
        vec3 c = h > 0.0 ? mix(cMid, cTop, clamp(pow(h, 0.65), 0.0, 1.0))
                         : mix(cBot, cMid, clamp((h + 0.22) / 0.22, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(72, 32, 20), skyMat);
  root.add(sky);

  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.7, fog: false });
  const cloudSpots = [[-24, 17, -34], [10, 20, -42], [30, 15, -18], [-38, 14, 8], [26, 22, 26], [-14, 19, 38]];
  for (const [x, y, z] of cloudSpots) {
    const cg = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(2.4 + Math.random() * 1.6, 10, 8), cloudMat);
      c.position.set(i * 2.4 - 3.2, Math.random() * 0.8, Math.random() * 1.2);
      c.scale.set(1, 0.55, 1);
      cg.add(c);
    }
    cg.position.set(x, y, z);
    root.add(cg);
  }

  /* ─────────────── 조명 ─────────────── */
  const hemi = new THREE.HemisphereLight(0xfff1d8, 0x9a7f63, 1.15);
  root.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe0b0, 2.1);
  sun.position.set(-8, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;
  root.add(sun);
  root.add(sun.target);
  sun.target.position.set(0, 0, 2);

  const fill = new THREE.DirectionalLight(0xa8c8e8, 0.45);
  fill.position.set(6, 8, -12);
  root.add(fill);

  const fill2 = new THREE.DirectionalLight(0xffd9b8, 0.35);
  fill2.position.set(-4, 5, 16);
  root.add(fill2);

  root.add(new THREE.AmbientLight(0xffeedd, 0.28));

  /* ─────────────── 갱신 ─────────────── */
  const update = (dt, t) => {
    for (const a of animated) {
      if (a.kind === 'swing') {
        a.obj.rotation.z = Math.sin(t * a.speed) * a.amp;
        a.obj.rotation.x = Math.cos(t * a.speed * 0.7) * a.amp * 0.4;
      }
    }
    // 가로등 살짝 일렁임
    streetLight.intensity = 9 + Math.sin(t * 1.7) * 0.5;
    roomLight.intensity = 20 + Math.sin(t * 2.3) * 0.6;
  };

  return { root, colliders, occluders, groundPick, update };
}
