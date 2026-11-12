// Pembina dunia statik: bangunan satu tingkat (daripada data bilik), perabot, kawasan luar, laguna dan latar KL.
import * as THREE from 'three';

export interface Door { side: 'n' | 's' | 'e' | 'w'; pos: number; width: number }
export interface Room {
  id: number; key: string; name: string; type: string; x0: number; z0: number; x1: number; z1: number;
  doors: Door[]; walled: number; outdoor: number; is_private: number; can_enter: boolean; description: string;
}
export interface Box { x0: number; x1: number; z0: number; z1: number }
export interface Interactable { x: number; z: number; r: number; label: string; kind: 'agent' | 'page' | 'tv' | 'info' | 'locked'; ref?: unknown }
export interface Seat { roomId: number; x: number; z: number; rot: number; route: [number, number][]; open: Box }
export interface TvSpec { screen: THREE.Mesh; x: number; z: number; channel: string; room: string }
export interface Quality { shadows: boolean; detail: number }

export const WALL_H = 3.4;
const T = 0.25;
const unit = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: number, o: { rough?: number; metal?: number; emissive?: number; ei?: number; opacity?: number } = {}) {
  const key = `${color}|${o.rough}|${o.metal}|${o.emissive}|${o.ei}|${o.opacity}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.8, metalness: Math.min(0.25, o.metal ?? 0), // tiada peta persekitaran, jadi logam tinggi kelihatan gelap emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1,
      transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null,
    });
    mats.set(key, m);
  }
  return m;
}

const C = {
  wall: mat(0xf1ece2), trim: mat(0xd2ad62, { rough: 0.4, metal: 0.25 }), glass: mat(0x9fd3e6, { rough: 0.05, metal: 0.2, opacity: 0.22 }),
  wood: mat(0x6b4a2f, { rough: 0.6 }), darkWood: mat(0x3a2718, { rough: 0.5 }), white: mat(0xf7f7f5, { rough: 0.5 }),
  steel: mat(0x8d949c, { rough: 0.35, metal: 0.8 }), black: mat(0x15171c, { rough: 0.5 }), fabric: mat(0x2f4a6b, { rough: 0.95 }),
  cream: mat(0xe9dfcc, { rough: 0.9 }), leaf: mat(0x2f7d46, { rough: 0.9 }), pot: mat(0x8a8275, { rough: 0.8 }),
  screenOff: mat(0x0c1220, { rough: 0.2 }), gold: mat(0xd9b76a, { rough: 0.3, metal: 0.8 }),
};
const FLOOR: Record<string, number> = {
  lobi: 0xe8e2d6, kafe: 0xc9a777, rehat: 0x8fa38c, latihan: 0x7f8fa3, jabatan: 0x5f6f86, koridor: 0xdcd5c7, studio: 0x6b6f8f,
  mesyuarat: 0x4d5a70, operasi: 0x2e3a4f, makmal: 0xc8d6da, bilik_tidur: 0x8a6a4f, suite_rehat: 0x9a7a5a, pejabat_ceo: 0x6e5038,
  pejabat_pa: 0x9c8468, tandas: 0xbfd0d4, surau: 0x3f7a5c, utiliti: 0x6a6f75,
};

export interface WorldBuild {
  root: THREE.Group; roof: THREE.Object3D; colliders: Box[]; seats: Seat[]; interactables: Interactable[]; tvs: TvSpec[];
  tick: ((t: number, dt: number) => void)[];
}

export function textSprite(text: string, o: { size?: number; color?: string; bg?: string; scale?: number; sub?: string } = {}) {
  const size = o.size ?? 44;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d')!;
  g.font = `600 ${size}px system-ui, sans-serif`;
  const w = Math.max(g.measureText(text).width, o.sub ? g.measureText(o.sub).width * 0.62 : 0) + 48;
  cv.width = Math.ceil(w); cv.height = o.sub ? size * 2.3 : size * 1.6;
  g.fillStyle = o.bg ?? 'rgba(11,18,32,0.82)';
  g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 18); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${size}px system-ui, sans-serif`; g.fillStyle = o.color ?? '#f4e3b5';
  g.fillText(text, cv.width / 2, o.sub ? size * 0.82 : cv.height / 2);
  if (o.sub) { g.font = `500 ${size * 0.6}px system-ui, sans-serif`; g.fillStyle = '#cfd6e4'; g.fillText(o.sub, cv.width / 2, size * 1.72); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const k = (o.scale ?? 1) * 0.0085;
  s.scale.set(cv.width * k, cv.height * k, 1);
  return s;
}

export function buildWorld(rooms: Room[], q: Quality): WorldBuild {
  const root = new THREE.Group();
  const colliders: Box[] = [];
  const seats: Seat[] = [];
  const interactables: Interactable[] = [];
  const tvs: TvSpec[] = [];
  const tick: ((t: number, dt: number) => void)[] = [];

  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o: { cast?: boolean; recv?: boolean; ry?: number; parent?: THREE.Object3D } = {}) => {
    const mesh = new THREE.Mesh(unit, m);
    mesh.scale.set(w, h, d); mesh.position.set(x, y + h / 2, z);
    if (o.ry) mesh.rotation.y = o.ry;
    mesh.castShadow = Boolean(o.cast && q.shadows); mesh.receiveShadow = Boolean(o.recv && q.shadows);
    (o.parent ?? root).add(mesh);
    return mesh;
  };
  const solid = (x: number, z: number, w: number, d: number) => colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, cast = false, seg = 16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = cast && q.shadows; root.add(mesh);
    return mesh;
  };
  const sphere = (r: number, m: THREE.Material, x: number, y: number, z: number, cast = false) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
    mesh.position.set(x, y, z); mesh.castShadow = cast && q.shadows; root.add(mesh);
    return mesh;
  };
  const plane = (w: number, d: number, m: THREE.Material, x: number, y: number, z: number, recv = false) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = recv && q.shadows; root.add(mesh);
    return mesh;
  };

  const indoor = rooms.filter((r) => !r.outdoor);
  const corridors = indoor.filter((r) => r.type === 'koridor');
  const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
  const GLASS = new Set(['jabatan', 'studio', 'operasi', 'makmal', 'mesyuarat', 'latihan', 'kafe', 'rehat', 'lobi']);

  // ---------- Lantai ----------
  for (const r of indoor) {
    plane(r.x1 - r.x0, r.z1 - r.z0, mat(FLOOR[r.type] ?? 0xcccccc, { rough: r.type === 'lobi' || r.type === 'koridor' ? 0.25 : 0.85 }), (r.x0 + r.x1) / 2, 0.02, (r.z0 + r.z1) / 2);
  }

  // ---------- Dinding (dinyahduplikasi mengikut garisan) ----------
  interface Seg { axis: 'x' | 'z'; c: number; a: number; b: number; glass: boolean; doors: { pos: number; width: number; locked: boolean; room: Room }[] }
  const segs = new Map<string, Seg>();
  for (const r of indoor) {
    if (!r.walled) continue;
    const sides: [Door['side'], 'x' | 'z', number, number, number][] = [['n', 'z', r.z0, r.x0, r.x1], ['s', 'z', r.z1, r.x0, r.x1], ['w', 'x', r.x0, r.z0, r.z1], ['e', 'x', r.x1, r.z0, r.z1]];
    for (const [side, axis, c, a, b] of sides) {
      const borders = corridors.some((k) => axis === 'z'
        ? (k.z1 === c || k.z0 === c) && overlap(a, b, k.x0, k.x1)
        : (k.x1 === c || k.x0 === c) && overlap(a, b, k.z0, k.z1));
      const glass = GLASS.has(r.type) && borders;
      const key = `${axis}|${c}|${a}|${b}`;
      const seg = segs.get(key) ?? { axis, c, a, b, glass, doors: [] };
      seg.glass = seg.glass && glass;
      for (const d of r.doors) if (d.side === side) seg.doors.push({ pos: d.pos, width: d.width, locked: !r.can_enter, room: r });
      segs.set(key, seg);
    }
  }
  const wallPiece = (s: Seg, a: number, b: number, y0: number, h: number, m: THREE.Material, thick = T) => {
    const len = b - a; const mid = (a + b) / 2;
    if (len <= 0.01) return;
    if (s.axis === 'z') box(len, h, thick, m, mid, y0, s.c); else box(thick, h, len, m, s.c, y0, mid);
  };
  for (const s of segs.values()) {
    const doors = [...s.doors].sort((p, q2) => p.pos - q2.pos);
    let cur = s.a;
    const pieces: [number, number][] = [];
    for (const d of doors) { pieces.push([cur, d.pos - d.width / 2]); cur = d.pos + d.width / 2; }
    pieces.push([cur, s.b]);
    for (const [a, b] of pieces) {
      if (b - a <= 0.01) continue;
      if (s.glass) {
        wallPiece(s, a, b, 0, 0.9, C.wall); wallPiece(s, a, b, 0.9, WALL_H - 1.2, C.glass, 0.06); wallPiece(s, a, b, WALL_H - 0.3, 0.3, C.wall);
        wallPiece(s, a, b, 0.9, 0.05, C.trim, T + 0.04);
      } else wallPiece(s, a, b, 0, WALL_H, C.wall);
      if (s.axis === 'z') colliders.push({ x0: a, x1: b, z0: s.c - T / 2, z1: s.c + T / 2 });
      else colliders.push({ x0: s.c - T / 2, x1: s.c + T / 2, z0: a, z1: b });
    }
    for (const d of doors) {
      const a = d.pos - d.width / 2; const b = d.pos + d.width / 2;
      wallPiece(s, a, b, 2.5, WALL_H - 2.5, C.wall);
      wallPiece(s, a - 0.08, a + 0.04, 0, 2.5, C.trim, T + 0.06); wallPiece(s, b - 0.04, b + 0.08, 0, 2.5, C.trim, T + 0.06);
      const [dx, dz] = s.axis === 'z' ? [d.pos, s.c] : [s.c, d.pos];
      if (d.locked) {
        wallPiece(s, a, b, 0, 2.5, C.darkWood, 0.12);
        wallPiece(s, d.pos - 0.25, d.pos + 0.25, 1.9, 0.08, mat(0xff3b30, { emissive: 0xff3b30, ei: 1.5 }), 0.2);
        if (s.axis === 'z') colliders.push({ x0: a, x1: b, z0: s.c - T / 2, z1: s.c + T / 2 }); else colliders.push({ x0: s.c - T / 2, x1: s.c + T / 2, z0: a, z1: b });
        interactables.push({ x: dx, z: dz, r: 2.6, kind: 'locked', label: `Akses terhad — ${d.room.name}` });
      }
      // Papan tanda bilik di atas pintu.
      const sign = textSprite(d.room.name, { size: 40, scale: 0.75 });
      sign.position.set(dx, 2.95, dz); root.add(sign);
    }
  }

  // ---------- Bumbung & lampu siling ----------
  const bx0 = Math.min(...indoor.map((r) => r.x0)); const bx1 = Math.max(...indoor.map((r) => r.x1));
  const bz0 = Math.min(...indoor.map((r) => r.z0)); const bz1 = Math.max(...indoor.map((r) => r.z1));
  const roof = new THREE.Group();
  const slab = box(bx1 - bx0 + 1.2, 0.35, bz1 - bz0 + 1.2, mat(0xe6e0d4), (bx0 + bx1) / 2, WALL_H, (bz0 + bz1) / 2, { cast: true, parent: roof });
  slab.receiveShadow = false;
  box(bx1 - bx0 + 1.6, 0.18, bz1 - bz0 + 1.6, C.trim, (bx0 + bx1) / 2, WALL_H + 0.35, (bz0 + bz1) / 2, { parent: roof });
  const light = mat(0xfff6dd, { emissive: 0xfff1cc, ei: 1.2 });
  for (const r of indoor) {
    const nx = Math.max(1, Math.round((r.x1 - r.x0) / 7)); const nz = Math.max(1, Math.round((r.z1 - r.z0) / 7));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
      box(1.6, 0.04, 0.5, light, r.x0 + ((i + 0.5) * (r.x1 - r.x0)) / nx, WALL_H - 0.05, r.z0 + ((j + 0.5) * (r.z1 - r.z0)) / nz, { parent: roof });
  }
  root.add(roof);

  // ---------- Perabot ----------
  const chair = (x: number, z: number, ry: number, m: THREE.Material = C.black) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    box(0.5, 0.08, 0.5, m, 0, 0.44, 0, { parent: g }); box(0.5, 0.55, 0.07, m, 0, 0.52, 0.24, { parent: g }); box(0.08, 0.44, 0.08, C.steel, 0, 0, 0, { parent: g });
  };
  const desk = (x: number, z: number, ry: number, w = 1.7) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    box(w, 0.06, 0.8, C.white, 0, 0.72, 0, { parent: g }); box(0.06, 0.72, 0.7, C.steel, -w / 2 + 0.08, 0, 0, { parent: g }); box(0.06, 0.72, 0.7, C.steel, w / 2 - 0.08, 0, 0, { parent: g });
    box(0.62, 0.38, 0.04, C.black, 0, 0.92, -0.18, { parent: g }); box(0.56, 0.32, 0.01, mat(0x2a6fb0, { emissive: 0x1d4f86, ei: 0.9 }), 0, 0.95, -0.155, { parent: g });
    box(0.1, 0.14, 0.1, C.black, 0, 0.78, -0.2, { parent: g });
    solid(x, z, ry % Math.PI === 0 ? w : 0.8, ry % Math.PI === 0 ? 0.8 : w);
  };
  const plant = (x: number, z: number, s = 1) => { cyl(0.26 * s, 0.2 * s, 0.5 * s, C.pot, x, 0, z); sphere(0.5 * s, C.leaf, x, 1.0 * s, z); sphere(0.36 * s, C.leaf, x + 0.15, 1.45 * s, z - 0.1); solid(x, z, 0.5, 0.5); };
  const sofa = (x: number, z: number, ry: number, w = 2.2, m: THREE.Material = C.fabric) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    box(w, 0.42, 0.9, m, 0, 0, 0, { parent: g }); box(w, 0.5, 0.22, m, 0, 0.42, 0.34, { parent: g });
    box(0.2, 0.62, 0.9, m, -w / 2 + 0.1, 0, 0, { parent: g }); box(0.2, 0.62, 0.9, m, w / 2 - 0.1, 0, 0, { parent: g });
    const rot = Math.abs(Math.sin(ry)) > 0.5; solid(x, z, rot ? 0.9 : w, rot ? w : 0.9);
  };
  const table = (x: number, z: number, w: number, d: number, m: THREE.Material = C.wood, h = 0.74) => { box(w, 0.07, d, m, x, h - 0.07, z); box(w * 0.6, h - 0.07, d * 0.4, C.steel, x, 0, z); solid(x, z, w, d); };
  // TV dipasang pada dinding; `face` ialah arah skrin menghadap.
  const tv = (x: number, z: number, face: number, channel: string, room: string, w = 2.6) => {
    const g = new THREE.Group(); g.position.set(x, 1.95, z); g.rotation.y = face; root.add(g);
    box(w + 0.12, w * 0.5625 + 0.12, 0.08, C.black, 0, -(w * 0.5625 + 0.12) / 2, 0, { parent: g });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    screen.position.z = 0.045; g.add(screen);
    const fx = x + Math.sin(face) * 2.2; const fz = z + Math.cos(face) * 2.2;
    const spec = { screen, x, z, channel, room };
    tvs.push(spec);
    interactables.push({ x: fx, z: fz, r: 3, kind: 'tv', label: 'TV', ref: spec });
  };

  for (const r of indoor) {
    if (r.type === 'koridor') continue;
    const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2;
    const w = r.x1 - r.x0; const depth = r.z1 - r.z0;
    const fd = r.doors.find((d) => d.side === 'n' || d.side === 's');
    const sg = fd?.side === 'n' ? -1 : 1; // arah hadapan (sisi pintu)
    const frontZ = sg > 0 ? r.z1 : r.z0;
    const P = (u: number, v: number): [number, number] => [cx + u, frontZ - sg * v];
    const faceFront = sg > 0 ? 0 : Math.PI; const faceBack = sg > 0 ? Math.PI : 0;
    const backTv = (channel: string, size = 2.6) => { const [x, z] = P(0, depth - 0.22); tv(x, z, faceFront, channel, r.name, size); };
    const deskGrid = (firstV = 6.2) => {
      const cols = Math.max(1, Math.floor((w - 3) / 3.4));
      const open: Box = { x0: r.x0 + 1.5, x1: r.x1 - 1.5, z0: Math.min(P(0, 1.6)[1], P(0, 3.6)[1]), z1: Math.max(P(0, 1.6)[1], P(0, 3.6)[1]) };
      for (let v = firstV; v <= depth - 2.2; v += 3.4) {
        for (let i = 0; i < cols; i++) {
          const u = (i - (cols - 1) / 2) * 3.4;
          const [dx, dz] = P(u, v); desk(dx, dz, faceFront === 0 ? Math.PI : 0);
          const [sx, sz] = P(u, v - 0.85); chair(sx, sz, faceFront);
          seats.push({ roomId: r.id, x: sx, z: sz, rot: faceBack, open, route: [P(u, v - 1.6), P(u + 1.7, v - 1.6), P(u + 1.7, 3.2)] });
        }
      }
    };
    switch (r.type) {
      case 'lobi': {
        const [rx, rz] = [cx, cz - 2];
        box(5, 1.1, 1, C.darkWood, rx, 0, rz); box(5.2, 0.06, 1.2, C.gold, rx, 1.1, rz); solid(rx, rz, 5, 1);
        const logo = textSprite('GENIUS DIGITAL', { size: 64, scale: 2.2, sub: 'Pejabat Maya · Kuala Lumpur' }); logo.position.set(cx, 2.6, r.z0 + 0.5); root.add(logo);
        interactables.push({ x: rx, z: rz + 1.6, r: 2.4, kind: 'page', label: 'Kaunter penyambut tetamu — buka Dashboard', ref: 'dashboard' });
        sofa(r.x0 + 2.2, cz + 2, Math.PI / 2); sofa(r.x1 - 2.2, cz + 2, -Math.PI / 2); table(r.x0 + 4, cz + 2, 0.9, 1.4, C.darkWood, 0.42);
        plant(r.x0 + 1, r.z1 - 1, 1.3); plant(r.x1 - 1, r.z1 - 1, 1.3); plant(r.x0 + 1, r.z0 + 1.2); plant(r.x1 - 1, r.z0 + 1.2);
        tv(r.x1 - 0.2, cz + 2, -Math.PI / 2, 'lobi', r.name, 3);
        break;
      }
      case 'kafe': {
        const [kx, kz] = P(-w / 2 + 4.5, depth - 1.4);
        box(7, 1.05, 0.9, C.wood, kx, 0, kz); box(7.2, 0.06, 1.1, C.white, kx, 1.05, kz); solid(kx, kz, 7, 0.9);
        box(0.5, 0.6, 0.45, C.steel, kx - 2, 1.11, kz); box(0.5, 0.4, 0.4, C.black, kx + 1.5, 1.11, kz);
        interactables.push({ x: kx, z: kz - sg * -1.6, r: 2.2, kind: 'info', label: 'Kaunter kafe', ref: 'Kafe GENIUS DIGITAL — kopi, teh tarik dan kuih. (Hiasan dunia maya; tiada pesanan sebenar.)' });
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const [tx, tz] = P(-w / 2 + 3.5 + i * 4.6, 3.2 + j * 4.2);
          cyl(0.6, 0.6, 0.05, C.white, tx, 0.72, tz); cyl(0.07, 0.25, 0.72, C.steel, tx, 0, tz); solid(tx, tz, 1, 1);
          chair(tx - 0.95, tz, -Math.PI / 2, C.wood); chair(tx + 0.95, tz, Math.PI / 2, C.wood);
        }
        const [tx, tz] = P(w / 2 - 0.2, depth / 2); tv(tx, tz, -Math.PI / 2, 'kafe', r.name, 2.4);
        plant(r.x0 + 1, frontZ - sg * 1); break;
      }
      case 'rehat': {
        sofa(...P(0, depth - 4.2), faceBack, 3); sofa(...P(-3.4, depth - 2.4), Math.PI / 2 * sg, 2.2, mat(0x7a4b3a, { rough: 0.9 })); sofa(...P(3.4, depth - 2.4), -Math.PI / 2 * sg, 2.2, mat(0x7a4b3a, { rough: 0.9 }));
        table(...P(0, depth - 2.4), 1.6, 0.9, C.darkWood, 0.42); backTv('rehat');
        table(...P(-2.5, 4), 1.1, 1.1, C.white); chair(...P(-2.5, 4.9), faceBack); chair(...P(-2.5, 3.1), faceFront);
        plant(...P(w / 2 - 1, 1.2)); plant(...P(-w / 2 + 1, depth - 1), 1.2); break;
      }
      case 'latihan': {
        backTv('latihan', 3.4);
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const [x, z] = P((i - 1) * 4, 4 + j * 3); table(x, z, 2.6, 0.7, C.white); chair(x - 0.6, z + sg * 0.8, faceBack); chair(x + 0.6, z + sg * 0.8, faceBack); }
        break;
      }
      case 'mesyuarat': {
        const [x, z] = P(0, depth / 2 + 0.5); table(x, z, 2, 8, C.darkWood);
        for (let i = 0; i < 5; i++) { chair(x - 1.5, z - 3.2 + i * 1.6, Math.PI / 2); chair(x + 1.5, z - 3.2 + i * 1.6, -Math.PI / 2); }
        backTv('mesyuarat', 3.4);
        interactables.push({ x, z: frontZ - sg * 2, r: 2.5, kind: 'page', label: 'Papan tugasan — buka Tugasan', ref: 'tugasan' });
        plant(...P(w / 2 - 1, 1.2)); break;
      }
      case 'operasi': {
        deskGrid(5.5);
        const [x, z] = P(0, depth / 2);
        tv(r.x0 + 0.2, z, Math.PI / 2, 'operasi', r.name, 4.2); tv(r.x1 - 0.2, z, -Math.PI / 2, 'operasi', r.name, 4.2);
        interactables.push({ x, z: frontZ - sg * 2.5, r: 2.5, kind: 'page', label: 'Konsol operasi — buka Log Audit', ref: 'audit' });
        break;
      }
      case 'studio': {
        deskGrid(6.2); backTv('jabatan');
        const [x, z] = P(w / 2 - 3, 3);
        box(3.5, 2.8, 0.1, mat(0x2fa36b, { rough: 0.9 }), x, 0, z + sg * -1.2); cyl(0.03, 0.03, 1.4, C.black, x, 0, z + sg * 1.4); box(0.3, 0.2, 0.25, C.black, x, 1.4, z + sg * 1.4);
        cyl(0.03, 0.03, 2, C.steel, x - 1.6, 0, z + sg * 0.8); box(0.5, 0.5, 0.1, mat(0xffffff, { emissive: 0xfff3d0, ei: 1.4 }), x - 1.6, 1.9, z + sg * 0.8);
        break;
      }
      case 'makmal': {
        deskGrid(6.2); backTv('jabatan');
        for (const u of [-w / 2 + 1, w / 2 - 1]) { const [x, z] = P(u, depth / 2); box(0.9, 0.9, 6, C.white, x, 0, z); box(1, 0.05, 6.1, C.steel, x, 0.9, z); solid(x, z, 0.9, 6); for (let k = -2; k <= 2; k++) cyl(0.07, 0.09, 0.3, mat([0x4fb0c6, 0xc6884f, 0x7ac64f][(k + 3) % 3], { opacity: 0.7 }), x, 0.95, z + k * 1.1, false, 10); }
        break;
      }
      case 'jabatan': deskGrid(6.2); backTv('jabatan'); plant(...P(w / 2 - 1, 1.2)); break;
      case 'pejabat_ceo': {
        const [x, z] = P(1.5, depth - 4);
        box(3, 0.08, 1.3, C.darkWood, x, 0.72, z); box(2.8, 0.72, 0.08, C.darkWood, x, 0, z + sg * 0.5); box(0.08, 0.72, 1.2, C.darkWood, x - 1.4, 0, z); box(0.08, 0.72, 1.2, C.darkWood, x + 1.4, 0, z); solid(x, z, 3, 1.3);
        box(3.1, 0.02, 1.4, C.gold, x, 0.8, z);
        chair(x, z - sg * 1.1, faceFront, mat(0x2a1a10, { rough: 0.5 })); chair(x - 0.8, z + sg * 1.4, faceBack); chair(x + 0.8, z + sg * 1.4, faceBack);
        box(5, 2.6, 0.4, C.darkWood, ...[P(1.5, depth - 0.4)[0], 0, P(1.5, depth - 0.4)[1]] as [number, number, number]);
        const [kx, kz] = P(-w / 2 + 1.2, 3.5);
        box(0.7, 1.15, 0.5, C.black, kx, 0, kz); box(0.6, 0.45, 0.05, mat(0xd9b76a, { emissive: 0xc9a45c, ei: 0.9 }), kx + 0.28, 1.2, kz, { ry: Math.PI / 2 }); solid(kx, kz, 0.7, 0.5);
        interactables.push({ x: kx + 1, z: kz, r: 2.2, kind: 'page', label: 'Kiosk kelulusan — buka Kelulusan', ref: 'kelulusan' });
        sofa(...P(-w / 2 + 3.5, depth - 2), faceFront, 2.6, mat(0x5a3a26, { rough: 0.6 })); table(...P(-w / 2 + 3.5, depth - 3.8), 1.4, 0.7, C.darkWood, 0.42);
        tv(r.x1 - 0.2, cz + 1.5, -Math.PI / 2, 'ceo', r.name, 2.8); plant(...P(w / 2 - 1, 1.2), 1.3);
        break;
      }
      case 'suite_rehat': {
        plane(4.5, 6, mat(0xd8cbb4, { rough: 1 }), cx, 0.03, cz + 1);
        sofa(cx, cz + 3.8, Math.PI, 3, mat(0xe9dfcc, { rough: 0.9 })); sofa(cx - 2.6, cz + 1.4, Math.PI / 2, 2, mat(0xe9dfcc, { rough: 0.9 }));
        table(cx, cz + 1.6, 1.4, 0.8, C.darkWood, 0.42); tv(cx, r.z0 + 0.2, 0, 'suite', r.name, 2.8);
        table(cx + 1.2, r.z0 + 4.2, 1.2, 1.2, C.wood); chair(cx + 1.2, r.z0 + 5.2, Math.PI, C.wood); chair(cx + 1.2, r.z0 + 3.2, 0, C.wood);
        plant(r.x0 + 0.9, r.z1 - 0.9, 1.2); plant(r.x1 - 0.9, r.z1 - 0.9, 1.2);
        break;
      }
      case 'bilik_tidur': {
        // Ruang peribadi: perabot ringkas dan sopan sahaja.
        plane(5.5, 5.5, mat(0xcbb9a0, { rough: 1 }), cx, 0.03, cz - 1);
        box(2.4, 0.45, 2.3, mat(0xf3eee6, { rough: 0.95 }), r.x0 + 1.5, 0.25, cz - 1); box(2.5, 0.25, 2.4, C.darkWood, r.x0 + 1.5, 0, cz - 1);
        box(0.15, 1.3, 2.5, C.darkWood, r.x0 + 0.25, 0, cz - 1); box(0.5, 0.14, 0.7, C.white, r.x0 + 0.75, 0.7, cz - 1.55); box(0.5, 0.14, 0.7, C.white, r.x0 + 0.75, 0.7, cz - 0.45);
        box(1.6, 0.08, 2.32, mat(0x8a6f8f, { rough: 0.95 }), r.x0 + 1.9, 0.7, cz - 1); solid(r.x0 + 1.5, cz - 1, 2.5, 2.4);
        for (const dz of [-2.6, 0.6]) { box(0.5, 0.5, 0.5, C.darkWood, r.x0 + 0.5, 0, cz - 1 + dz); cyl(0.12, 0.16, 0.3, mat(0xfff0cf, { emissive: 0xffe2a8, ei: 1.2 }), r.x0 + 0.5, 0.55, cz - 1 + dz); }
        box(5, 2.4, 0.6, C.darkWood, cx, 0, r.z0 + 0.45); solid(cx, r.z0 + 0.45, 5, 0.6);
        box(1.4, 0.75, 0.5, C.wood, cx + 1, 0, r.z1 - 0.5); box(0.9, 0.9, 0.03, mat(0xcfe3ea, { rough: 0.05, metal: 0.6 }), cx + 1, 0.95, r.z1 - 0.3); solid(cx + 1, r.z1 - 0.5, 1.4, 0.5);
        plant(r.x1 - 0.9, r.z1 - 0.9);
        break;
      }
      case 'pejabat_pa': {
        const [x, z] = P(0, depth - 4.5);
        desk(x, z, faceFront === 0 ? Math.PI : 0, 2.2); chair(x, z - sg * 0.9, faceFront);
        seats.push({ roomId: r.id, x, z: z - sg * 0.9, rot: faceBack, open: { x0: r.x0 + 1.5, x1: r.x1 - 1.5, z0: Math.min(P(0, 1.6)[1], P(0, 3.6)[1]), z1: Math.max(P(0, 1.6)[1], P(0, 3.6)[1]) }, route: [[x + 1.9, z - sg * 0.9], [x + 1.9, z + sg * 1.8], P(1.9, 3)] });
        chair(x - 0.7, z + sg * 1.5, faceBack); chair(x + 0.7, z + sg * 1.5, faceBack);
        box(3.6, 1.9, 0.45, C.wood, ...[P(0, depth - 0.4)[0], 0, P(0, depth - 0.4)[1]] as [number, number, number]);
        sofa(...P(-w / 2 + 1, 5), Math.PI / 2, 2, mat(0x8a6f8f, { rough: 0.9 })); plant(...P(w / 2 - 1, 1.2), 1.2);
        break;
      }
      case 'tandas': {
        box(0.12, 2.2, depth - 3, C.white, cx, 0, cz - 1); solid(cx, cz - 1, 0.12, depth - 3);
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { box(1.4, 2, 0.06, C.cream, cx + side * 2.4, 0, r.z0 + 1.6 + i * 1.5); box(0.5, 0.42, 0.6, C.white, cx + side * 3.2, 0, r.z0 + 0.9 + i * 1.5); }
        for (const side of [-1, 1]) { box(2.2, 0.12, 0.5, C.white, cx + side * 2, 0.8, r.z1 - 3.2); box(2.2, 0.8, 0.03, mat(0xcfe3ea, { rough: 0.05, metal: 0.6 }), cx + side * 2, 1.2, r.z1 - 3.42); }
        break;
      }
      case 'surau': {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) plane(1.1, 0.7, mat(j % 2 ? 0x8a2f3a : 0x2f4a8a, { rough: 1 }), r.x0 + 1.4 + i * 1.6, 0.03, r.z0 + 2.5 + j * 2.6);
        box(1.4, 1.5, 0.35, C.wood, r.x1 - 1, 0, r.z1 - 0.6); solid(r.x1 - 1, r.z1 - 0.6, 1.4, 0.35);
        interactables.push({ x: cx, z: r.z1 - 2, r: 2, kind: 'info', label: 'Surau', ref: 'Surau — ruang solat untuk staf dan pelawat.' });
        break;
      }
      case 'utiliti': {
        const led = mat(0x35e06f, { emissive: 0x35e06f, ei: 2 });
        for (let i = 0; i < 4; i++) { const x = r.x0 + 1.5 + i * 1.5; box(0.8, 2.1, 1, C.black, x, 0, r.z0 + 1.2); solid(x, r.z0 + 1.2, 0.8, 1); for (let k = 0; k < 6; k++) box(0.5, 0.03, 0.02, led, x, 0.4 + k * 0.28, r.z0 + 1.71); }
        box(2, 1.8, 0.5, C.steel, r.x1 - 1.4, 0, r.z0 + 5); solid(r.x1 - 1.4, r.z0 + 5, 2, 0.5);
        break;
      }
    }
  }

  // ---------- Laluan kecemasan ----------
  const exitMat = mat(0x16a34a, { emissive: 0x16a34a, ei: 1.6 });
  for (const k of corridors.filter((r) => r.x1 - r.x0 > 20)) {
    const cz = (k.z0 + k.z1) / 2;
    for (const [x, out] of [[k.x0, -1], [k.x1, 1]] as [number, number][]) {
      box(0.1, 0.35, 1.1, exitMat, x - out * 0.4, 2.75, cz);
      const s = textSprite('KELUAR ⟶', { size: 38, color: '#eafff0', bg: 'rgba(22,163,74,0.92)', scale: 0.7 }); s.position.set(x - out * 1.2, 2.6, cz); root.add(s);
      box(0.3, 2.5, 0.3, C.trim, x, 0, k.z0 + 0.15); box(0.3, 2.5, 0.3, C.trim, x, 0, k.z1 - 0.15);
      plane(4, 2.4, mat(0xcfc8ba, { rough: 0.9 }), x + out * 2, 0.03, cz, true);
      for (let i = 1; i <= 6; i++) plane(0.6, 0.18, exitMat, x - out * i * 5, 0.035, cz + (k.z1 - k.z0) / 2 - 0.35);
    }
  }

  buildOutdoor({ root, box, cyl, sphere, plane, solid, colliders, interactables, tick, q, bx0, bx1, bz0, bz1, rooms });
  return { root, roof, colliders, seats, interactables, tvs, tick };
}

// ---------- Kawasan luar ----------
function buildOutdoor(c: {
  root: THREE.Group; q: Quality; colliders: Box[]; interactables: Interactable[]; tick: ((t: number, dt: number) => void)[]; rooms: Room[];
  bx0: number; bx1: number; bz0: number; bz1: number;
  box: (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o?: { cast?: boolean; recv?: boolean; ry?: number; parent?: THREE.Object3D }) => THREE.Mesh;
  cyl: (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, cast?: boolean, seg?: number) => THREE.Mesh;
  sphere: (r: number, m: THREE.Material, x: number, y: number, z: number, cast?: boolean) => THREE.Mesh;
  plane: (w: number, d: number, m: THREE.Material, x: number, y: number, z: number, recv?: boolean) => THREE.Mesh;
  solid: (x: number, z: number, w: number, d: number) => void;
}) {
  const { root, box, cyl, sphere, plane, solid, q } = c;
  const grass = mat(0x4f8a4a, { rough: 1 }); const road = mat(0x2b2f36, { rough: 0.95 }); const path = mat(0xd6cdbb, { rough: 0.95 });
  const line = mat(0xf4f1e8, { rough: 0.8 }); const sand = mat(0xe8d6a8, { rough: 1 }); const trunk = mat(0x6b4a2f, { rough: 0.9 });
  const leaf = [mat(0x2f7d46, { rough: 0.9 }), mat(0x3d8f4f, { rough: 0.9 }), mat(0x256b3a, { rough: 0.9 })];

  plane(700, 700, grass, 0, -0.02, 0, true);
  plane(c.bx1 - c.bx0 + 6, c.bz1 - c.bz0 + 6, path, (c.bx0 + c.bx1) / 2, 0, (c.bz0 + c.bz1) / 2, true); // apron bangunan

  // Jalan utama, jalan masuk (timur) dan keluar (barat), gelung drop-off.
  plane(360, 9, road, 0, 0.01, 58, true);
  for (let x = -170; x < 170; x += 8) plane(3.5, 0.2, line, x, 0.02, 58);
  plane(7, 16, road, 30, 0.01, 46, true); plane(7, 16, road, -30, 0.01, 46, true); plane(67, 7, road, 0, 0.01, 38, true);
  plane(40, 7, road, 53, 0.01, 38, true); // ke parkir
  const arrow = (x: number, z: number, t: string) => { const s = textSprite(t, { size: 40, scale: 0.9, bg: 'rgba(15,60,120,0.9)', color: '#fff' }); s.position.set(x, 2.6, z); root.add(s); cyl(0.06, 0.06, 2.2, C.steel, x, 0, z); };
  arrow(35, 52, 'MASUK'); arrow(-35, 52, 'KELUAR'); arrow(42, 34, 'PARKIR ⟶');
  // Kanopi drop-off.
  plane(30, 9, path, 0, 0.012, 30, true);
  box(26, 0.3, 10, mat(0xf1ece2), 0, 4.2, 31, { cast: true }); box(26.4, 0.12, 10.4, C.trim, 0, 4.5, 31);
  for (const x of [-12, 12]) for (const z of [27, 35]) { cyl(0.28, 0.28, 4.2, C.trim, x, 0, z, true); solid(x, z, 0.6, 0.6); }
  const dsign = textSprite('GENIUS DIGITAL', { size: 60, scale: 2.4, sub: 'Drop-off · Pintu Masuk Utama' }); dsign.position.set(0, 5.6, 35.5); root.add(dsign);

  // Parkir.
  plane(40, 42, road, 68, 0.01, 17, true);
  const carColors = [0xb8bcc4, 0x1d2b4a, 0x7a1f1f, 0xf2f2f2, 0x24272c, 0x2f5d50];
  const car = (x: number, z: number, ry: number, color: number, parent: THREE.Object3D = root) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    const body = mat(color, { rough: 0.3, metal: 0.6 });
    box(1.85, 0.6, 4.4, body, 0, 0.35, 0, { parent: g, cast: true }); box(1.65, 0.55, 2.3, mat(0x1a222c, { rough: 0.1, metal: 0.5 }), 0, 0.95, -0.2, { parent: g, cast: true });
    box(1.7, 0.06, 2.1, body, 0, 1.5, -0.2, { parent: g });
    for (const sx of [-0.9, 0.9]) for (const sz of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14), C.black); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.33, sz); g.add(w); }
    box(1.5, 0.12, 0.05, mat(0xfff6d0, { emissive: 0xfff0b0, ei: 1 }), 0, 0.62, 2.2, { parent: g }); box(1.5, 0.12, 0.05, mat(0xd01f1f, { emissive: 0xa01010, ei: 1 }), 0, 0.62, -2.2, { parent: g });
    return g;
  };
  let ci = 0;
  for (const row of [2, 14, 26]) for (let i = 0; i < 9; i++) {
    const x = 52 + i * 4; plane(0.15, 5.2, line, x - 2, 0.02, row);
    for (const [dz, ry] of [[0, 0]] as [number, number][]) if ((i * 7 + row) % 5 !== 0) { car(x, row + dz, ry, carColors[ci++ % carColors.length]); solid(x, row, 2, 4.6); }
  }
  // Kenderaan bergerak di jalan utama.
  const movers = [car(-170, 55.8, Math.PI / 2, 0xc9a45c), car(60, 60.2, -Math.PI / 2, 0x3a6ea5), car(-40, 55.8, Math.PI / 2, 0xeeeeee)];
  const speeds = [11, -9, 13];
  c.tick.push((_t, dt) => movers.forEach((m, i) => { m.position.x += speeds[i] * dt; if (m.position.x > 175) m.position.x = -175; if (m.position.x < -175) m.position.x = 175; }));

  // Pokok.
  const tree = (x: number, z: number, s = 1) => { cyl(0.18 * s, 0.26 * s, 2.4 * s, trunk, x, 0, z, true, 8); sphere(1.5 * s, leaf[Math.abs(Math.round(x + z)) % 3], x, 3.4 * s, z, true); sphere(1.1 * s, leaf[Math.abs(Math.round(x * 2 + z)) % 3], x + 0.7 * s, 4.3 * s, z + 0.3 * s, true); solid(x, z, 0.6, 0.6); };
  const palm = (x: number, z: number, s = 1) => {
    cyl(0.14 * s, 0.24 * s, 6 * s, trunk, x, 0, z, true, 8); solid(x, z, 0.5, 0.5);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(unit, leaf[i % 3]); f.scale.set(0.5 * s, 0.06, 3 * s); f.position.set(x, 6 * s, z); f.rotation.set(0.5, (i / 7) * Math.PI * 2, 0, 'YXZ'); f.translateZ(1.3 * s); f.castShadow = q.shadows; root.add(f); }
  };
  const step = q.detail >= 1 ? 1 : 2;
  for (let x = -160; x <= 160; x += 14 * step) { tree(x, 66, 1.1); if (Math.abs(x) > 40) tree(x, 50, 0.9); }
  for (let z = -20; z <= 44; z += 10 * step) { tree(-44.5, z); tree(44.5, z, 0.9); tree(92, z, 1.1); tree(-92, z, 1.2); }

  // Taman landskap + titik berkumpul.
  plane(3, 46, path, -68, 0.012, 19, true); plane(40, 3, path, -68, 0.012, 19, true); plane(8, 3, path, -44, 0.012, 8, true);
  cyl(3.2, 3.4, 0.5, mat(0xd8d2c4), -68, 0, 19); cyl(2.8, 2.8, 0.1, mat(0x5fb3d9, { rough: 0.1, opacity: 0.85 }), -68, 0.45, 19); cyl(0.3, 0.5, 1.6, mat(0xd8d2c4), -68, 0.5, 19);
  c.colliders.push({ x0: -71.4, x1: -64.6, z0: 15.6, z1: 22.4 });
  const bench = (x: number, z: number, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); box(1.8, 0.08, 0.5, C.wood, 0, 0.45, 0, { parent: g }); box(1.8, 0.5, 0.06, C.wood, 0, 0.5, -0.24, { parent: g }); box(0.08, 0.45, 0.45, C.steel, -0.8, 0, 0, { parent: g }); box(0.08, 0.45, 0.45, C.steel, 0.8, 0, 0, { parent: g }); };
  bench(-62, 24, -0.8); bench(-74, 24, 0.8); bench(-62, 14, Math.PI + 0.8); bench(-74, 14, Math.PI - 0.8);
  for (const [x, z] of [[-80, 34], [-56, 36], [-82, 4], [-54, 2], [-76, -2], [-60, 40]] as [number, number][]) tree(x, z, 1.2);
  for (let i = 0; i < 10 * q.detail + 4; i++) sphere(0.7, mat([0xd94f7a, 0xe0a030, 0xb85cd6][i % 3], { rough: 0.9 }), -84 + (i * 37) % 34, 0.4, 28 + ((i * 53) % 14));
  plane(8, 8, mat(0x16a34a, { rough: 0.9 }), -56, 0.013, 36); const as = textSprite('TITIK BERKUMPUL', { size: 40, bg: 'rgba(22,163,74,0.95)', color: '#fff', sub: 'Kecemasan' }); as.position.set(-56, 3, 36); root.add(as); cyl(0.07, 0.07, 2.4, C.steel, -56, 0, 36);
  c.interactables.push({ x: -56, z: 36, r: 3, kind: 'info', label: 'Titik berkumpul kecemasan', ref: 'Titik berkumpul kecemasan. Ikut papan tanda KELUAR hijau dari kedua-dua koridor.' });

  // Laluan pejalan kaki mengelilingi bangunan ke laguna.
  plane(3, 70, path, -45, 0.012, -8, true); plane(3, 70, path, 45, 0.012, -8, true); plane(150, 4, path, 0, 0.012, -31, true);

  // Laguna & pantai buatan.
  plane(150, 18, sand, 0, 0.011, -42, true);
  const water = plane(260, 120, mat(0x2f9fc4, { rough: 0.08, metal: 0.3, opacity: 0.9 }), 0, 0.04, -110);
  c.tick.push((t) => { water.position.y = 0.05 + Math.sin(t * 0.8) * 0.02; });
  box(3.2, 0.3, 20, C.wood, 0, 0.05, -60, { cast: true }); for (let z = -51; z >= -70; z -= 4.5) for (const x of [-1.5, 1.5]) cyl(0.12, 0.12, 1.3, C.darkWood, x, -0.3, z);
  cyl(3.4, 3.4, 0.25, C.wood, 0, 0.1, -72, false, 8); for (let i = 0; i < 6; i++) cyl(0.12, 0.12, 2.6, C.white, Math.cos((i / 6) * 6.283) * 3, 0.3, -72 + Math.sin((i / 6) * 6.283) * 3);
  { const m = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 8), mat(0x8a5a3a, { rough: 0.9 })); m.position.set(0, 3.7, -72); m.castShadow = q.shadows; root.add(m); }
  // Sempadan air (boleh berjalan di atas jeti dan gazebo sahaja).
  c.colliders.push({ x0: -200, x1: -1.7, z0: -200, z1: -50.5 }, { x0: 1.7, x1: 200, z0: -200, z1: -50.5 }, { x0: -200, x1: 200, z0: -200, z1: -75.2 }, { x0: -200, x1: -76, z0: -60, z1: -34 }, { x0: 76, x1: 200, z0: -60, z1: -34 });
  for (let x = -66; x <= 66; x += 12 * step) if (Math.abs(x) > 5) palm(x + (x % 24 ? 2 : -2), -36 - (Math.abs(x) % 5), 0.9 + (Math.abs(x) % 3) * 0.1);
  for (const x of [-30, -18, 16, 28, 40]) {
    const g = new THREE.Group(); g.position.set(x, 0, -44); root.add(g);
    box(0.7, 0.12, 1.9, C.white, 0, 0.3, 0, { parent: g }); box(0.7, 0.5, 0.1, C.white, 0, 0.35, 0.9, { parent: g });
    cyl(0.04, 0.04, 2.3, C.steel, x + 0.9, 0, -44); const u = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 10), mat([0xe0723c, 0x2bb3b1, 0xd9a520][Math.abs(x) % 3], { rough: 0.9 })); u.position.set(x + 0.9, 2.4, -44); u.castShadow = q.shadows; root.add(u);
  }
  const ls = textSprite('Laguna GENIUS', { size: 48, scale: 1.2, sub: 'Kawasan rekreasi tepi air' }); ls.position.set(0, 3.4, -33); root.add(ls);
  c.interactables.push({ x: 0, z: -72, r: 3.5, kind: 'info', label: 'Gazebo laguna', ref: 'Gazebo tepi air — tempat rehat dengan pemandangan latar Kuala Lumpur.' });

  // Latar metropolitan Kuala Lumpur (siluet generik, bukan replika tepat bangunan sebenar).
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g2 = cv.getContext('2d')!;
  g2.fillStyle = '#26334a'; g2.fillRect(0, 0, 64, 256);
  for (let y = 4; y < 256; y += 8) for (let x = 4; x < 64; x += 8) { g2.fillStyle = (x * 7 + y * 13) % 5 < 2 ? '#ffe9a8' : '#3b4d6b'; g2.fillRect(x, y, 4, 5); }
  const wt = new THREE.CanvasTexture(cv); wt.colorSpace = THREE.SRGBColorSpace; wt.magFilter = THREE.NearestFilter;
  const towerMat = new THREE.MeshStandardMaterial({ map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.4 });
  const n = q.detail >= 1 ? 70 : 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.13; const rad = 320 + ((i * 37) % 140); const h = 40 + ((i * 53) % 110); const w = 16 + ((i * 29) % 18);
    const m = new THREE.Mesh(unit, towerMat); m.scale.set(w, h, w); m.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad); m.rotation.y = a; root.add(m);
  }
  const spire = (x: number, z: number, h: number, r: number) => {
    const steelM = mat(0xb9c4d2, { rough: 0.25, metal: 0.85, emissive: 0x33435c, ei: 0.5 });
    cyl(r * 0.8, r, h * 0.55, steelM, x, 0, z, false, 12); cyl(r * 0.55, r * 0.8, h * 0.25, steelM, x, h * 0.55, z, false, 12); cyl(r * 0.2, r * 0.55, h * 0.12, steelM, x, h * 0.8, z, false, 12); cyl(0.4, r * 0.2, h * 0.14, steelM, x, h * 0.92, z, false, 8);
  };
  spire(-60, -430, 230, 13); spire(-22, -430, 230, 13); box(26, 4, 5, mat(0xb9c4d2, { metal: 0.8, rough: 0.3 }), -41, 95, -430);
  cyl(3.5, 6, 170, mat(0xd9d4c8), 120, 0, -400, false, 12); cyl(11, 7, 14, mat(0xcfd6e4, { metal: 0.5, rough: 0.3, emissive: 0x4f6f9f, ei: 0.5 }), 120, 170, -400, false, 16); cyl(0.6, 2, 50, C.steel, 120, 184, -400, false, 8);
  spire(250, -340, 300, 16);
}
