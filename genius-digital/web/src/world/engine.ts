// Enjin dunia 3D: renderer, kawalan (papan kekunci + tetikus + sentuhan), kamera, perlanggaran, gelung.
import * as THREE from 'three';
import { buildWorld, type Room, type Box, type Interactable, type Seat, type WorldBuild, type TvSpec } from './build';
import { AgentActor, buildPerson, type Person, type WorldAgent } from './people';
import { TvSystem } from './tv';

export type QualityKey = 'ringan' | 'sederhana' | 'tinggi' | 'ultra';
export type CameraMode = 'ketiga' | 'pertama' | 'atas';
// "ultra" merender pada resolusi natif paparan (4K pada monitor 4K; sehingga 3× pada skrin telefon berketumpatan tinggi).
export const QUALITY: Record<QualityKey, { label: string; maxDpr: number; shadows: boolean; shadowMap: number; aa: boolean; detail: number }> = {
  ringan: { label: 'Ringan', maxDpr: 1, shadows: false, shadowMap: 0, aa: false, detail: 0 },
  sederhana: { label: 'Sederhana', maxDpr: 1.5, shadows: false, shadowMap: 0, aa: true, detail: 1 },
  tinggi: { label: 'Tinggi', maxDpr: 2, shadows: true, shadowMap: 2048, aa: true, detail: 1 },
  ultra: { label: 'Ultra (4K natif)', maxDpr: 3, shadows: true, shadowMap: 4096, aa: true, detail: 1 },
};

export interface WorldData { rooms: Room[]; agents: WorldAgent[]; demo_mode: boolean }
export interface Prompt { label: string; kind: Interactable['kind']; actionable: boolean }
export interface WorldEvents {
  onPrompt(p: Prompt | null): void;
  onInteract(it: Interactable): void;
  onState(s: { x: number; z: number; yaw: number; room: Room | null; mode: CameraMode; fps: number; locked: boolean }): void;
}

const R = 0.35; // jejari pemain
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

export class World {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  private build: WorldBuild; private tv: TvSystem; private actors = new Map<number, AgentActor>();
  private player: Person; private px = 0; private pz = 31; private vx = 0; private vz = 0; private facing = Math.PI; private walkPhase = 0;
  private yaw = 0; private pitch = 0.18; private tYaw = 0; private tPitch = 0.18; private dist = 5.5; private topH = 55;
  private keys = new Set<string>(); private joy = { x: 0, y: 0 }; private mode: CameraMode = 'ketiga';
  private raf = 0; private last = performance.now(); private t = 0; private stateAcc = 0; private frames = 0; private fpsAcc = 0; private fps = 60;
  private nearest: Interactable | null = null; private lastPrompt = ''; private disposed = false;
  private cleanup: (() => void)[] = []; private camPos = new THREE.Vector3(0, 3, 40);
  private rooms: Room[]; private seatsFree: Map<number, Seat[]> = new Map(); private info = { agents: 0, working: 0, waiting: 0, demo: true };
  private joyEl: HTMLDivElement; private knobEl: HTMLDivElement;

  constructor(private el: HTMLElement, data: WorldData, quality: QualityKey, private ev: WorldEvents, private self: { avatar: string; name: string }) {
    const q = QUALITY[quality];
    this.rooms = data.rooms;
    this.renderer = new THREE.WebGLRenderer({ antialias: q.aa, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxDpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

    this.scene.background = new THREE.Color(0x9fc8ea);
    this.scene.fog = new THREE.Fog(0xb9d6ee, 180, 820);
    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b7a5a, 1.15), new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(90, 130, 70);
    if (q.shadows) {
      sun.castShadow = true; sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      const c = sun.shadow.camera; c.left = -130; c.right = 130; c.top = 130; c.bottom = -130; c.near = 10; c.far = 420; sun.shadow.bias = -0.0004;
    }
    this.scene.add(sun);

    this.build = buildWorld(data.rooms, { shadows: q.shadows, detail: q.detail });
    this.scene.add(this.build.root);
    this.tv = new TvSystem(this.build.tvs);
    for (const s of this.build.seats) { const l = this.seatsFree.get(s.roomId) ?? []; l.push(s); this.seatsFree.set(s.roomId, l); }
    this.setAgents(data.agents, data.demo_mode);

    this.player = buildPerson(self.avatar, q.shadows); this.player.pose('stand'); this.scene.add(this.player.group);

    // Joystick sentuhan (dicipta di sini supaya enjin berdikari daripada React).
    this.joyEl = document.createElement('div'); this.knobEl = document.createElement('div');
    Object.assign(this.joyEl.style, { position: 'absolute', width: '120px', height: '120px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.45)', background: 'rgba(11,18,32,.25)', display: 'none', pointerEvents: 'none', zIndex: '3' });
    Object.assign(this.knobEl.style, { position: 'absolute', left: '35px', top: '35px', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(244,227,181,.85)' });
    this.joyEl.appendChild(this.knobEl); el.appendChild(this.joyEl);

    this.bindInput();
    const ro = new ResizeObserver(() => this.resize()); ro.observe(el); this.cleanup.push(() => ro.disconnect());
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- Data ----------
  setAgents(agents: WorldAgent[], demo: boolean) {
    const active = agents.filter((a) => a.status === 'aktif' && a.room_id != null);
    this.info = { agents: active.length, working: active.filter((a) => a.activity.state === 'berjalan').length, waiting: active.filter((a) => a.activity.state === 'menunggu_kelulusan').length, demo };
    const keep = new Set(active.map((a) => a.id));
    for (const [id, actor] of this.actors) if (!keep.has(id)) { actor.dispose(this.scene); this.actors.delete(id); }
    for (const a of active) {
      const ex = this.actors.get(a.id);
      if (ex) { ex.setData(a, this.scene); continue; }
      const seat = this.seatsFree.get(a.room_id!)?.shift();
      if (!seat) continue; // tiada tempat duduk kosong di bilik jabatan
      this.actors.set(a.id, new AgentActor(a, seat, this.scene, this.renderer.shadowMap.enabled));
    }
  }

  // ---------- Kawalan ----------
  private bindInput() {
    const dom = this.renderer.domElement;
    const on = <K extends keyof WindowEventMap>(target: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts); this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase(); this.keys.add(k);
      if (k === 'e') this.interact();
      if (k === 'v') this.setCameraMode(this.mode === 'ketiga' ? 'pertama' : this.mode === 'pertama' ? 'atas' : 'ketiga');
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());

    // Tetikus: klik untuk kunci penunjuk (pandangan licin tanpa had); jika tidak dikunci, seret untuk melihat.
    let dragging = false; let lookId = -1; let joyId = -1; let jx = 0; let jy = 0; let lx = 0; let ly = 0;
    const look = (dx: number, dy: number, sens: number) => {
      this.tYaw -= dx * sens; this.tPitch = Math.min(1.25, Math.max(-1.1, this.tPitch + dy * sens));
    };
    on(dom, 'pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        if (this.mode !== 'atas' && document.pointerLockElement !== dom) void dom.requestPointerLock?.();
        dragging = true; lx = e.clientX; ly = e.clientY;
        return;
      }
      const rect = dom.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.45 && joyId < 0) {
        joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
        Object.assign(this.joyEl.style, { display: 'block', left: `${jx - rect.left - 60}px`, top: `${jy - rect.top - 60}px` });
      } else if (lookId < 0) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
      dom.setPointerCapture(e.pointerId);
    });
    on(dom, 'pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement === dom) look(e.movementX, e.movementY, 0.0022);
        else if (dragging) { look(e.clientX - lx, e.clientY - ly, 0.004); lx = e.clientX; ly = e.clientY; }
        return;
      }
      if (e.pointerId === joyId) {
        let dx = e.clientX - jx; let dy = e.clientY - jy; const d = Math.hypot(dx, dy); const max = 50;
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        this.joy.x = dx / max; this.joy.y = dy / max;
        this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (e.pointerId === lookId) { look(e.clientX - lx, e.clientY - ly, 0.006); lx = e.clientX; ly = e.clientY; }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') { dragging = false; return; }
      if (e.pointerId === joyId) { joyId = -1; this.joy.x = this.joy.y = 0; this.joyEl.style.display = 'none'; this.knobEl.style.transform = ''; }
      if (e.pointerId === lookId) lookId = -1;
    };
    on(dom, 'pointerup', up); on(dom, 'pointercancel', up);
    on(dom, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (this.mode === 'atas') this.topH = Math.min(140, Math.max(18, this.topH + e.deltaY * 0.05));
      else this.dist = Math.min(11, Math.max(2.2, this.dist + e.deltaY * 0.005));
    }, { passive: false });
    on(dom, 'contextmenu', (e: Event) => e.preventDefault());
  }

  setCameraMode(m: CameraMode) {
    this.mode = m;
    if (m === 'atas' && document.pointerLockElement) document.exitPointerLock();
  }
  teleport(key: string) {
    const r = this.rooms.find((x) => x.key === key);
    if (!r) return;
    const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2;
    let x = cx; let z = cz;
    const d = r.doors[0];
    if (r.walled && d) { // betul-betul di dalam pintu
      if (d.side === 'n') { x = d.pos; z = r.z0 + 1.6; } else if (d.side === 's') { x = d.pos; z = r.z1 - 1.6; }
      else if (d.side === 'e') { x = r.x1 - 1.6; z = d.pos; } else { x = r.x0 + 1.6; z = d.pos; }
    }
    if (r.key === 'pantai') { x = 0; z = -40; }
    this.px = x; this.pz = z; this.vx = this.vz = 0;
    this.tYaw = this.yaw = Math.atan2(x - cx, z - cz); this.facing = this.yaw + Math.PI;
    this.resolve();
  }
  interact() {
    const it = this.nearest;
    if (!it || it.kind === 'locked') return;
    if (it.kind === 'tv') { this.tv.toggle(it.ref as TvSpec); this.lastPrompt = ''; return; }
    if (document.pointerLockElement) document.exitPointerLock();
    this.ev.onInteract(it);
  }

  // ---------- Fizik ringkas ----------
  private resolve() {
    for (let pass = 0; pass < 3; pass++) {
      for (const b of this.build.colliders) {
        const cx = Math.max(b.x0, Math.min(this.px, b.x1)); const cz = Math.max(b.z0, Math.min(this.pz, b.z1));
        const dx = this.px - cx; const dz = this.pz - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); this.px = cx + (dx / d) * R; this.pz = cz + (dz / d) * R; }
        else { // pusat di dalam kotak: tolak ke tepi terdekat
          const l = this.px - b.x0; const r = b.x1 - this.px; const n = this.pz - b.z0; const s = b.z1 - this.pz; const m = Math.min(l, r, n, s);
          if (m === l) this.px = b.x0 - R; else if (m === r) this.px = b.x1 + R; else if (m === n) this.pz = b.z0 - R; else this.pz = b.z1 + R;
        }
      }
    }
    this.px = Math.max(-150, Math.min(150, this.px)); this.pz = Math.max(-76, Math.min(64, this.pz));
  }
  private blocked(x: number, z: number, pad: number, list: Box[]) {
    for (const b of list) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
    return false;
  }
  private roomAt(x: number, z: number) {
    return this.rooms.find((r) => !r.outdoor && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) ?? this.rooms.find((r) => r.outdoor && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) ?? null;
  }

  // ---------- Gelung ----------
  private loop = (nowMs: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (nowMs - this.last) / 1000); this.last = nowMs; this.t += dt;

    // Input → halaju sasaran (relatif kepada kamera), dilicinkan.
    const k = this.keys;
    let ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + this.joy.x;
    let iz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + this.joy.y;
    const mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; }
    const speed = k.has('shift') || Math.hypot(this.joy.x, this.joy.y) > 0.92 ? 8.5 : 4.2;
    const yawRef = this.mode === 'atas' ? 0 : this.yaw;
    const sin = Math.sin(yawRef); const cos = Math.cos(yawRef);
    // Hadapan kamera ialah (-sin, -cos); kanan ialah (cos, -sin).
    const tx = (ix * cos + iz * sin) * speed; const tz = (-ix * sin + iz * cos) * speed;
    const a = damp(mag > 0.01 ? 12 : 16, dt);
    this.vx += (tx - this.vx) * a; this.vz += (tz - this.vz) * a;
    this.px += this.vx * dt; this.pz += this.vz * dt;
    this.resolve();
    const v = Math.hypot(this.vx, this.vz);
    if (v > 0.3) { const target = Math.atan2(this.vx, this.vz); this.facing += (((target - this.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * damp(14, dt); }
    this.walkPhase += v * dt * 2.6; this.player.walk(this.walkPhase, Math.min(1, v / 4.2));
    if (v <= 0.3) this.player.idle(this.t);
    this.player.group.position.set(this.px, 0, this.pz); this.player.group.rotation.y = this.mode === 'pertama' ? this.yaw + Math.PI : this.facing;
    this.player.group.visible = this.mode !== 'pertama';

    // Kamera (yaw/pitch dilicinkan supaya gerakan tetikus dan sentuhan terasa lembut).
    const la = damp(22, dt);
    this.yaw += (this.tYaw - this.yaw) * la; this.pitch += (this.tPitch - this.pitch) * la;
    const inside = this.blocked(this.px, this.pz, 0, [{ x0: -40.5, x1: 40.5, z0: -25.5, z1: 25.5 }]);
    if (this.mode === 'pertama') {
      this.camera.position.set(this.px, 1.62, this.pz);
      this.camera.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    } else if (this.mode === 'atas') {
      this.camPos.lerp(new THREE.Vector3(this.px, this.topH, this.pz + this.topH * 0.35), damp(8, dt));
      this.camera.position.copy(this.camPos); this.camera.lookAt(this.camPos.x, 0, this.camPos.z - this.topH * 0.35);
    } else {
      const head = new THREE.Vector3(this.px, 1.55, this.pz);
      const cp = Math.cos(this.pitch); const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      let d = this.dist;
      for (let s = 0.4; s <= this.dist; s += 0.25) { // elak kamera menembusi dinding/siling
        const x = head.x + dir.x * s; const z = head.z + dir.z * s; const y = head.y + dir.y * s;
        if (this.blocked(x, z, 0.25, this.build.colliders) || y < 0.3 || (inside && y > 3.15)) { d = Math.max(0.5, s - 0.3); break; }
      }
      const want = head.clone().addScaledVector(dir, d);
      this.camPos.lerp(want, damp(18, dt)); this.camera.position.copy(this.camPos); this.camera.lookAt(head);
    }
    this.build.roof.visible = this.mode !== 'atas' && (inside || this.camera.position.y < 3.4);

    // Dunia hidup.
    for (const f of this.build.tick) f(this.t, dt);
    for (const actor of this.actors.values()) actor.update(this.t, dt);
    this.tv.update(this.t, dt, this.px, this.pz, this.info);

    // Interaksi terdekat.
    let best: Interactable | null = null; let bd = Infinity;
    const consider = (it: Interactable) => { const d = Math.hypot(it.x - this.px, it.z - this.pz); if (d < it.r && d < bd) { best = it; bd = d; } };
    for (const it of this.build.interactables) consider(it);
    for (const actor of this.actors.values()) consider({ x: actor.x, z: actor.z, r: 2.4, kind: 'agent', label: `${actor.data.name} — ${actor.data.role_title}`, ref: actor.data });
    this.nearest = best as Interactable | null;
    const cur = this.nearest;
    const label = !cur ? '' : cur.kind === 'tv' ? `TV — ${this.tv.find(cur.ref as TvSpec).on ? 'tutup bunyi' : 'buka bunyi'}` : cur.label;
    if (label !== this.lastPrompt) { this.lastPrompt = label; this.ev.onPrompt(cur ? { label, kind: cur.kind, actionable: cur.kind !== 'locked' } : null); }

    this.renderer.render(this.scene, this.camera);

    this.frames++; this.fpsAcc += dt; this.stateAcc += dt;
    if (this.fpsAcc >= 1) { this.fps = Math.round(this.frames / this.fpsAcc); this.frames = 0; this.fpsAcc = 0; }
    if (this.stateAcc >= 0.1) {
      this.stateAcc = 0;
      this.ev.onState({ x: this.px, z: this.pz, yaw: this.mode === 'atas' ? this.facing + Math.PI : this.yaw, room: this.roomAt(this.px, this.pz), mode: this.mode, fps: this.fps, locked: document.pointerLockElement === this.renderer.domElement });
    }
  };

  agentPositions() { return [...this.actors.values()].map((a) => ({ x: a.x, z: a.z, color: a.data.color ?? '#c9a45c' })); }
  resolution() { const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()); return `${s.x}×${s.y}`; }
  private resize() {
    const w = this.el.clientWidth || 1; const h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    for (const f of this.cleanup) f();
    this.tv.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry && m.geometry !== undefined && !(m.geometry as THREE.BufferGeometry).userData.shared) m.geometry.dispose?.(); });
    this.renderer.dispose(); this.renderer.domElement.remove(); this.joyEl.remove();
  }
}
