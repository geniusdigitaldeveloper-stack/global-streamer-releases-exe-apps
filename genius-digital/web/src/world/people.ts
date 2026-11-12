// Watak manusia dewasa.
//
// PENTING: model di bawah ialah PLACEHOLDER prosedur (bukan fotorealistik). Untuk menggantikannya dengan
// aset manusia berlesen berkualiti tinggi, daftarkan fail GLB dalam /assets/avatars/manifest.json —
// lihat docs/ASET-3D.md. Kunci tanpa entri manifest kekal menggunakan placeholder ini.
import * as THREE from 'three';
import { mat, textSprite, type Seat } from './build';

interface Look { female: boolean; tudung?: number; hair: number; skin: number; top: number; bottom: number; accent: number; height: number }
const LOOKS: Record<string, Look> = {
  ceo: { female: false, hair: 0x15120f, skin: 0xc68e63, top: 0x14161c, bottom: 0x14161c, accent: 0xc9a45c, height: 1.76 },
  lelaki_a: { female: false, hair: 0x1a1512, skin: 0xc99670, top: 0x1f2e4d, bottom: 0x20242c, accent: 0x9c2f2f, height: 1.74 },
  lelaki_b: { female: false, hair: 0x0f0d0c, skin: 0x9a6a48, top: 0x34383f, bottom: 0x2a2d33, accent: 0x2f5d9c, height: 1.78 },
  lelaki_c: { female: false, hair: 0x2a221c, skin: 0xe0b48f, top: 0x5a6068, bottom: 0x2f3238, accent: 0x2f7d5a, height: 1.72 },
  wanita_a: { female: true, hair: 0x1d1512, skin: 0xe2b792, top: 0x7a2636, bottom: 0x22252b, accent: 0xf2efe8, height: 1.63 },
  wanita_b: { female: true, hair: 0x120f0e, skin: 0xf0cfae, top: 0x1f6f72, bottom: 0x1f2228, accent: 0xf2efe8, height: 1.61 },
  wanita_tudung_a: { female: true, tudung: 0xc98d9a, hair: 0, skin: 0xd9a57c, top: 0x1f2e4d, bottom: 0x1c2740, accent: 0xf2e6d8, height: 1.62 },
  wanita_tudung_b: { female: true, tudung: 0xe9dfc8, hair: 0, skin: 0xcf9a72, top: 0x1f6b4f, bottom: 0x17432f, accent: 0xf2efe8, height: 1.6 },
  wanita_tudung_c: { female: true, tudung: 0x7f93a8, hair: 0, skin: 0xe0b18c, top: 0x5a2f55, bottom: 0x3a2038, accent: 0xf2efe8, height: 1.64 },
};
export const AVATAR_KEYS = Object.keys(LOOKS).filter((k) => k !== 'ceo');

export interface Person {
  group: THREE.Group;
  pose(kind: 'sit' | 'stand'): void;
  walk(phase: number, amount: number): void;
  idle(t: number): void;
}

const capsule = (r: number, len: number, m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);

export function buildPerson(avatar: string, shadows: boolean): Person {
  const L = LOOKS[avatar] ?? LOOKS.lelaki_a;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const skin = mat(L.skin, { rough: 0.7 }); const top = mat(L.top, { rough: 0.85 }); const bottom = mat(L.bottom, { rough: 0.9 });
  const shoe = mat(0x14110f, { rough: 0.5 });
  const hip = 0.9;
  const add = (m: THREE.Mesh, x: number, y: number, z: number, parent: THREE.Object3D = body) => { m.position.set(x, y, z); m.castShadow = shadows; parent.add(m); return m; };

  // Kaki (pivot pinggul + lutut) supaya boleh duduk dan berjalan.
  const legs = [-1, 1].map((s) => {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.095, hip, 0); body.add(thigh);
    add(capsule(0.075, 0.3, bottom), 0, -0.22, 0, thigh);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); thigh.add(knee);
    add(capsule(0.062, 0.3, bottom), 0, -0.2, 0, knee);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), shoe); add(foot, 0, -0.43, 0.05, knee);
    return { thigh, knee };
  });
  // Badan.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(L.female ? 0.16 : 0.19, L.female ? 0.155 : 0.165, 0.56, 14), top);
  torso.scale.z = 0.62; add(torso, 0, hip + 0.3, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(L.female ? 0.165 : 0.195, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), top), 0, hip + 0.57, 0).scale.set(1, 0.35, 0.62);
  if (L.female) { const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.42, 14), top); tunic.scale.z = 0.7; add(tunic, 0, hip - 0.12, 0); }
  else { add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.02), mat(0xf4f1ea, { rough: 0.8 })), 0, hip + 0.42, 0.116); add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.02), mat(L.accent, { rough: 0.6 })), 0, hip + 0.4, 0.124); }
  // Lengan.
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * (L.female ? 0.2 : 0.235), hip + 0.52, 0); body.add(sh);
    add(capsule(0.05, 0.24, top), 0, -0.16, 0, sh);
    const elbow = new THREE.Group(); elbow.position.set(0, -0.32, 0); sh.add(elbow);
    add(capsule(0.043, 0.2, top), 0, -0.13, 0, elbow); add(new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), skin), 0, -0.29, 0, elbow);
    return { sh, elbow };
  });
  // Leher & kepala.
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), skin), 0, hip + 0.63, 0);
  const head = new THREE.Group(); head.position.set(0, hip + 0.78, 0); body.add(head);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skin), 0, 0, 0, head).scale.set(0.92, 1.12, 1);
  const eye = mat(0x1b1410, { rough: 0.3 });
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eye), s * 0.036, 0.012, 0.096, head);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.02), skin), 0, -0.012, 0.104, head);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), mat(0x9c5a4f, { rough: 0.6 })), 0, -0.052, 0.094, head);
  if (L.tudung != null) {
    const tm = mat(L.tudung, { rough: 0.95 });
    add(new THREE.Mesh(new THREE.SphereGeometry(0.128, 18, 14), tm), 0, 0.012, -0.028, head).scale.set(0.98, 1.12, 1);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), tm), s * 0.086, -0.03, 0.03, head).scale.set(0.5, 1.6, 0.9);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), tm), 0, -0.118, 0.045, head).scale.set(1.1, 0.5, 0.8);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.235, 0.36, 16), tm); drape.scale.z = 0.72; add(drape, 0, hip + 0.52, 0.012);
  } else if (L.female) {
    const hm = mat(L.hair, { rough: 0.8 });
    add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), hm), 0, 0.022, -0.022, head).scale.set(1, 1.1, 1);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.24, 12), hm), 0, -0.13, -0.05, head).scale.z = 0.6;
  } else {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(L.hair, { rough: 0.85 })), 0, 0.02, -0.012, head).scale.set(0.96, 1.1, 1.04);
  }
  g.scale.setScalar(L.height / 1.79);

  let seated = false;
  return {
    group: g,
    pose(kind) {
      seated = kind === 'sit';
      body.position.y = seated ? -0.42 : 0; body.position.z = 0;
      for (const l of legs) { l.thigh.rotation.x = seated ? -Math.PI / 2 : 0; l.knee.rotation.x = seated ? Math.PI / 2 : 0; }
      for (const a of arms) { a.sh.rotation.x = seated ? -0.55 : 0; a.elbow.rotation.x = seated ? -0.9 : -0.08; a.sh.rotation.z = 0; }
    },
    walk(phase, amount) {
      if (seated) return;
      const s = Math.sin(phase) * amount;
      legs[0].thigh.rotation.x = s * 0.6; legs[1].thigh.rotation.x = -s * 0.6;
      legs[0].knee.rotation.x = Math.max(0, -s) * 0.9; legs[1].knee.rotation.x = Math.max(0, s) * 0.9;
      arms[0].sh.rotation.x = -s * 0.5; arms[1].sh.rotation.x = s * 0.5;
      arms[0].elbow.rotation.x = -0.15 - Math.max(0, -s) * 0.4; arms[1].elbow.rotation.x = -0.15 - Math.max(0, s) * 0.4;
      body.position.y = Math.abs(Math.cos(phase)) * 0.025 * amount;
    },
    idle(t) {
      head.rotation.y = Math.sin(t * 0.4) * 0.25; head.rotation.x = Math.sin(t * 0.7) * 0.04;
      if (seated) for (let i = 0; i < 2; i++) arms[i].elbow.rotation.x = -0.9 + Math.sin(t * 6 + i * 2) * 0.05;
      else body.rotation.z = Math.sin(t * 0.6) * 0.012;
    },
  };
}

// ---- Titik import aset GLB (pilihan) ----
let manifest: Promise<Record<string, { url: string; height?: number }>> | null = null;
export async function applyAvatarOverride(person: Person, avatar: string) {
  manifest ??= fetch('/assets/avatars/manifest.json').then((r) => r.json()).then((j) => j.avatars ?? {}).catch(() => ({}));
  const entry = (await manifest)[avatar];
  if (!entry?.url) return;
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(entry.url);
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    gltf.scene.scale.setScalar((entry.height ?? 1.68) / (size.y || 1));
    person.group.clear(); person.group.scale.setScalar(1); person.group.add(gltf.scene);
    person.pose = () => {}; person.walk = () => {}; person.idle = () => {}; // animasi GLB: lihat docs/ASET-3D.md
  } catch (e) { console.warn(`Avatar GLB "${avatar}" gagal dimuatkan; placeholder dikekalkan.`, e); }
}

// ---- Agent di dalam dunia ----
export interface WorldAgent {
  id: number; name: string; kind: string; avatar: string; role_title: string; department: string | null; room_id: number | null;
  status: string; description: string; is_demo: number; color: string | null;
  activity: { state: string; task?: string; simulation?: boolean };
}
const STATE_LABEL: Record<string, string> = { sedia: 'Sedia', berjalan: 'Sedang bekerja', menunggu_kelulusan: 'Menunggu kelulusan', dijeda: 'Dijeda', tindakan_manual: 'Menunggu tindakan manual' };
export const activityText = (a: WorldAgent['activity']) => `${STATE_LABEL[a.state] ?? a.state}${a.simulation ? ' (SIMULASI)' : ''}`;

const angleLerp = (a: number, b: number, k: number) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;

export class AgentActor {
  person: Person; tag: THREE.Sprite; x: number; z: number; rot: number;
  private path: [number, number][] = []; private mode: 'sit' | 'out' | 'linger' | 'back' = 'sit';
  private timer: number; private phase = 0; private speed = 0;
  constructor(public data: WorldAgent, private seat: Seat, scene: THREE.Object3D, shadows: boolean) {
    this.person = buildPerson(data.avatar, shadows);
    void applyAvatarOverride(this.person, data.avatar);
    this.x = seat.x; this.z = seat.z; this.rot = seat.rot;
    this.person.pose('sit');
    this.tag = this.makeTag();
    scene.add(this.person.group, this.tag);
    this.timer = 6 + ((data.id * 7.3) % 30);
    this.sync();
  }
  private makeTag() {
    const busy = this.data.activity.state !== 'sedia';
    const t = textSprite(this.data.name, { size: 40, scale: 0.55, sub: `${this.data.role_title} · ${activityText(this.data.activity)}`, color: busy ? '#ffd98a' : '#e8eefc' });
    return t;
  }
  setData(d: WorldAgent, scene: THREE.Object3D) {
    const changed = d.activity.state !== this.data.activity.state || d.name !== this.data.name || d.role_title !== this.data.role_title;
    this.data = d;
    if (changed) { scene.remove(this.tag); this.tag.material.map?.dispose(); this.tag.material.dispose(); this.tag = this.makeTag(); scene.add(this.tag); }
  }
  private sync() {
    this.person.group.position.set(this.x, 0, this.z); this.person.group.rotation.y = this.rot;
    this.tag.position.set(this.x, this.mode === 'sit' ? 1.75 : 2.1, this.z);
  }
  update(t: number, dt: number) {
    this.timer -= dt;
    if (this.mode === 'sit' && this.timer <= 0) {
      const o = this.seat.open; const r = (n: number) => (Math.sin(this.data.id * 12.9898 + t * n) * 43758.5453) % 1;
      const tx = o.x0 + Math.abs(r(1.3)) * (o.x1 - o.x0); const tz = o.z0 + Math.abs(r(2.1)) * (o.z1 - o.z0);
      this.path = [...this.seat.route, [tx, tz]]; this.mode = 'out'; this.person.pose('stand');
    } else if (this.mode === 'linger' && this.timer <= 0) {
      this.path = [...this.seat.route].reverse().concat([[this.seat.x, this.seat.z]]); this.mode = 'back';
    }
    const moving = this.mode === 'out' || this.mode === 'back';
    if (moving && this.path.length) {
      const [tx, tz] = this.path[0]; const dx = tx - this.x; const dz = tz - this.z; const d = Math.hypot(dx, dz);
      this.speed += (1.25 - this.speed) * Math.min(1, dt * 4);
      const stepLen = this.speed * dt;
      if (d <= stepLen) { this.x = tx; this.z = tz; this.path.shift(); }
      else { this.x += (dx / d) * stepLen; this.z += (dz / d) * stepLen; this.rot = angleLerp(this.rot, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
      this.phase += stepLen * 4.4; this.person.walk(this.phase, Math.min(1, this.speed / 1.25));
      if (!this.path.length) {
        this.speed = 0; this.person.walk(0, 0);
        if (this.mode === 'out') { this.mode = 'linger'; this.timer = 5 + Math.abs(Math.sin(this.data.id + t)) * 10; }
        else { this.mode = 'sit'; this.rot = this.seat.rot; this.person.pose('sit'); this.timer = 25 + Math.abs(Math.sin(this.data.id * 3 + t)) * 50; }
      }
    } else this.person.idle(t + this.data.id);
    this.sync();
  }
  dispose(scene: THREE.Object3D) { scene.remove(this.person.group, this.tag); }
}
