// TV dalam dunia: skrin bergerak + bunyi.
// Lalai: animasi janaan (placeholder) dengan muzik ambien janaan WebAudio.
// Jika /assets/tv/manifest.json memetakan saluran kepada fail video, video itu dimainkan pada skrin dengan audionya.
import * as THREE from 'three';
import type { TvSpec } from './build';

export interface TvInfo { agents: number; working: number; waiting: number; demo: boolean }

const TITLES: Record<string, string> = {
  lobi: 'GENIUS DIGITAL TV', operasi: 'PUSAT OPERASI · STATUS LANGSUNG', mesyuarat: 'PAPAN MESYUARAT', kafe: 'BERITA KAMPUS', rehat: 'SALURAN SANTAI',
  latihan: 'AKADEMI GENIUS', ceo: 'RINGKASAN EKSEKUTIF', suite: 'SALURAN PERIBADI', jabatan: 'PRESTASI JABATAN',
};
const TICKER = 'Selamat datang ke GENIUS DIGITAL  •  Kandungan TV ini ialah animasi janaan (placeholder)  •  Ganti dengan video sendiri melalui /assets/tv/manifest.json  •  ';

class Tv {
  on = false; texture: THREE.Texture; video: HTMLVideoElement | null = null;
  private cv = document.createElement('canvas'); private g = this.cv.getContext('2d')!; private acc = 0;
  private gain: GainNode | null = null; private seed: number;
  constructor(public spec: TvSpec, index: number) {
    this.cv.width = 640; this.cv.height = 360; this.seed = index * 1.7;
    this.texture = new THREE.CanvasTexture(this.cv); this.texture.colorSpace = THREE.SRGBColorSpace;
    (spec.screen.material as THREE.MeshBasicMaterial).map = this.texture;
    this.draw(0, { agents: 0, working: 0, waiting: 0, demo: true });
  }
  useVideo(url: string) {
    const v = document.createElement('video');
    v.src = url; v.loop = true; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.addEventListener('canplay', () => {
      this.video = v; this.texture.dispose();
      this.texture = new THREE.VideoTexture(v); this.texture.colorSpace = THREE.SRGBColorSpace;
      const m = this.spec.screen.material as THREE.MeshBasicMaterial; m.map = this.texture; m.needsUpdate = true;
      void v.play().catch(() => {});
    }, { once: true });
    v.addEventListener('error', () => console.warn(`Video TV "${url}" gagal dimuatkan; animasi janaan dikekalkan.`));
  }
  draw(t: number, info: TvInfo) {
    const { g } = this; const W = 640; const H = 360; const s = this.seed; const ch = this.spec.channel;
    const grad = g.createLinearGradient(0, 0, W, H);
    const hue = (t * 8 + s * 60) % 360;
    grad.addColorStop(0, `hsl(${hue},55%,16%)`); grad.addColorStop(1, `hsl(${(hue + 70) % 360},60%,26%)`);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { // bulatan bergerak
      g.fillStyle = `hsla(${(hue + i * 40) % 360},80%,65%,0.18)`;
      g.beginPath(); g.arc(W / 2 + Math.cos(t * 0.5 + i + s) * 240, H / 2 + Math.sin(t * 0.7 + i * 1.7 + s) * 110, 40 + i * 12, 0, 6.283); g.fill();
    }
    g.fillStyle = 'rgba(8,12,22,0.55)'; g.fillRect(0, 0, W, 54);
    g.fillStyle = '#f4e3b5'; g.font = '700 26px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(TITLES[ch] ?? TITLES.lobi, 18, 28);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '600 22px system-ui, sans-serif';
    g.fillText(new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), W - 18, 28);
    if (ch === 'operasi' || ch === 'ceo' || ch === 'mesyuarat') {
      const cards: [string, number, string][] = [['Staf & agent', info.agents, '#7fc4ff'], ['Sedang bekerja', info.working, '#8ef0a8'], ['Menunggu kelulusan', info.waiting, '#ffd27f']];
      cards.forEach(([label, n, col], i) => {
        const x = 24 + i * 202; g.fillStyle = 'rgba(8,12,22,0.6)'; g.beginPath(); g.roundRect(x, 78, 188, 118, 12); g.fill();
        g.textAlign = 'left'; g.fillStyle = col; g.font = '700 58px system-ui, sans-serif'; g.fillText(String(n), x + 16, 126);
        g.fillStyle = '#dfe6f4'; g.font = '500 18px system-ui, sans-serif'; g.fillText(label, x + 16, 174);
      });
      g.strokeStyle = '#8ef0a8'; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x <= 592; x += 8) { const y = 262 + Math.sin(x * 0.03 + t * 2 + s) * 22 + Math.sin(x * 0.09 - t * 3) * 9; if (x) g.lineTo(24 + x, y); else g.moveTo(24, y); }
      g.stroke();
      if (info.demo) { g.fillStyle = '#ffd27f'; g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('MOD DEMO · graf hiasan, kiraan daripada data aplikasi', 24, 214); }
    } else {
      for (let i = 0; i < 9; i++) { // bar bergerak
        const h = 40 + (Math.sin(t * 1.6 + i * 0.9 + s) * 0.5 + 0.5) * 150;
        g.fillStyle = `hsla(${(hue + 150 + i * 14) % 360},75%,62%,0.9)`; g.beginPath(); g.roundRect(60 + i * 60, 300 - h, 38, h, 6); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.textAlign = 'center'; g.font = '700 34px system-ui, sans-serif';
      const lines = ['Bekerja pintar bersama AI', 'Pejabat maya · Kuala Lumpur', 'Staf + agent, satu pasukan']; g.fillText(lines[Math.floor(t / 5 + s) % 3], W / 2, 96);
    }
    g.fillStyle = 'rgba(8,12,22,0.75)'; g.fillRect(0, H - 40, W, 40);
    g.fillStyle = '#fff'; g.font = '500 18px system-ui, sans-serif'; g.textAlign = 'left';
    const tw = g.measureText(TICKER).width; const off = (t * 70) % tw;
    g.fillText(TICKER, -off, H - 20); g.fillText(TICKER, tw - off, H - 20);
    this.texture.needsUpdate = true;
  }
  update(t: number, dt: number, info: TvInfo, near: boolean) {
    if (this.video) return;
    this.acc += dt;
    if (this.acc < (near ? 1 / 30 : 1 / 4)) return; // TV jauh dikemas kini perlahan untuk jimat prestasi
    this.acc = 0; this.draw(t, info);
  }
  // Muzik ambien janaan (pad kord + arpeggio lembut).
  startAudio(ctx: AudioContext) {
    if (this.video || this.gain) return;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination); this.gain = out;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1400; filter.connect(out);
    const root = [220, 196, 246.94, 174.61][Math.floor(this.seed) % 4];
    for (const [ratio, type] of [[1, 'sine'], [1.25, 'sine'], [1.5, 'triangle'], [0.5, 'sine']] as [number, OscillatorType][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = root * ratio; const g = ctx.createGain(); g.gain.value = 0.11;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13 + ratio * 0.07; const lg = ctx.createGain(); lg.gain.value = 0.07; lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(filter); o.start();
    }
    const arp = ctx.createOscillator(); arp.type = 'triangle'; const ag = ctx.createGain(); ag.gain.value = 0; arp.connect(ag).connect(filter); arp.start();
    const notes = [2, 2.5, 3, 3.75, 3, 2.5]; let i = 0;
    const tickNote = () => {
      if (!this.gain) return;
      const now = ctx.currentTime; arp.frequency.setValueAtTime(root * notes[i++ % notes.length], now);
      ag.gain.cancelScheduledValues(now); ag.gain.setValueAtTime(0.0001, now); ag.gain.linearRampToValueAtTime(0.09, now + 0.03); ag.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      setTimeout(tickNote, 460);
    };
    tickNote();
  }
  setVolume(v: number, ctx: AudioContext | null) {
    if (this.video) { this.video.muted = v <= 0.001; this.video.volume = Math.min(1, v); return; }
    if (this.gain && ctx) this.gain.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.15);
  }
}

export class TvSystem {
  tvs: Tv[]; private ctx: AudioContext | null = null;
  constructor(specs: TvSpec[]) {
    this.tvs = specs.map((s, i) => new Tv(s, i));
    fetch('/assets/tv/manifest.json').then((r) => r.json()).then((j) => {
      for (const tv of this.tvs) { const url = j.channels?.[tv.spec.channel]; if (typeof url === 'string' && url) tv.useVideo(url); }
    }).catch(() => {});
  }
  find(spec: TvSpec) { return this.tvs.find((t) => t.spec === spec)!; }
  // Mesti dipanggil daripada gerak isyarat pengguna (kekunci/klik/sentuh) supaya audio dibenarkan pelayar.
  toggle(spec: TvSpec) {
    const tv = this.find(spec); tv.on = !tv.on;
    if (tv.on) {
      this.ctx ??= new AudioContext(); void this.ctx.resume(); tv.startAudio(this.ctx);
      if (tv.video) void tv.video.play().catch(() => {});
    }
    return tv.on;
  }
  update(t: number, dt: number, px: number, pz: number, info: TvInfo) {
    for (const tv of this.tvs) {
      const d = Math.hypot(tv.spec.x - px, tv.spec.z - pz);
      tv.update(t, dt, info, d < 30);
      tv.setVolume(tv.on ? Math.max(0, 1 - d / 22) ** 1.5 : 0, this.ctx);
    }
  }
  dispose() { for (const tv of this.tvs) { tv.video?.pause(); tv.texture.dispose(); } void this.ctx?.close(); }
}
