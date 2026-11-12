// Paparan pejabat 3D + HUD.
import { useEffect, useRef, useState } from 'react';
import { api, type Session } from './api';
import { Badge, States, useApi } from './ui';
import { World, QUALITY, type QualityKey, type CameraMode, type Prompt, type WorldData } from './world/engine';
import type { Room } from './world/build';
import { activityText, type WorldAgent } from './world/people';

const CAMERA_LABEL: Record<CameraMode, string> = { ketiga: 'Orang ketiga', pertama: 'Orang pertama', atas: 'Pandangan atas' };
const isTouch = () => matchMedia('(pointer: coarse)').matches;
const MAP = { x0: -96, x1: 96, z0: -80, z1: 66 };
const ROOM_COLOR: Record<string, string> = { koridor: '#cfc8ba', lobi: '#e8dcc0', pantai: '#5fb3d9', taman: '#5c9a55', parkir: '#4a4f58', dropoff: '#b9b2a2' };

export default function WorldView({ session, go }: { session: Session; go: (page: string) => void }) {
  const { data, error, loading, reload } = useApi<WorldData & { org: any }>('/world');
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [quality, setQuality] = useState<QualityKey>(() => (localStorage.getItem('gd_quality') as QualityKey) || (isTouch() ? 'sederhana' : 'tinggi'));
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [hud, setHud] = useState<{ room: Room | null; mode: CameraMode; fps: number; locked: boolean; x: number; z: number; yaw: number }>({ room: null, mode: 'ketiga', fps: 0, locked: false, x: 0, z: 0, yaw: 0 });
  const [agent, setAgent] = useState<WorldAgent | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [panel, setPanel] = useState<'map' | 'settings' | 'help' | null>(() => (localStorage.getItem('gd_help_seen') ? null : 'help'));
  const [glError, setGlError] = useState<string | null>(null);
  const [res, setRes] = useState('');

  useEffect(() => {
    if (!data || !host.current) return;
    let w: World;
    try {
      w = new World(host.current, data, quality, {
        onPrompt: setPrompt,
        onState: setHud,
        onInteract: (it) => {
          if (it.kind === 'agent') setAgent(it.ref as WorldAgent);
          else if (it.kind === 'page') go(it.ref as string);
          else if (it.kind === 'info') setInfo(it.ref as string);
        },
      }, { avatar: session.role === 'ceo' ? 'ceo' : session.role === 'pa' ? 'wanita_tudung_a' : 'lelaki_c', name: session.name });
    } catch (e: any) { setGlError(e?.message || 'WebGL tidak tersedia pada peranti ini.'); return; }
    world.current = w; setRes(w.resolution());
    (window as any).__gdWorld = w; // untuk ujian automatik
    return () => { w.dispose(); world.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data), quality]);

  // Segarkan aktiviti agent secara berkala tanpa membina semula dunia.
  useEffect(() => {
    const id = setInterval(async () => { try { const d = await api<WorldData>('/world'); world.current?.setAgents(d.agents, d.demo_mode); } catch { /* abaikan */ } }, 8000);
    return () => clearInterval(id);
  }, []);

  // Peta mini.
  useEffect(() => {
    const cv = mapRef.current; if (!cv || !data) return;
    const g = cv.getContext('2d')!; const W = cv.width; const H = cv.height;
    const sx = (x: number) => ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * W; const sz = (z: number) => ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * H;
    g.clearRect(0, 0, W, H); g.fillStyle = '#3f6f45'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2f36'; g.fillRect(0, sz(54), W, sz(62) - sz(54));
    const order = [...data.rooms].sort((a, b) => b.outdoor - a.outdoor);
    for (const r of order) {
      g.fillStyle = !r.can_enter ? '#6b2a2a' : ROOM_COLOR[r.type] ?? (r.outdoor ? '#6f8f6a' : '#8fa3bf');
      g.fillRect(sx(r.x0), sz(r.z0), sx(r.x1) - sx(r.x0), sz(r.z1) - sz(r.z0));
      if (!r.outdoor && r.walled) { g.strokeStyle = '#0b1220'; g.lineWidth = 1; g.strokeRect(sx(r.x0), sz(r.z0), sx(r.x1) - sx(r.x0), sz(r.z1) - sz(r.z0)); }
    }
    g.fillStyle = '#16a34a'; for (const z of [8, -10]) for (const x of [-40, 40]) g.fillRect(sx(x) - 2, sz(z) - 3, 4, 6); // pintu kecemasan
    for (const a of world.current?.agentPositions() ?? []) { g.fillStyle = a.color; g.beginPath(); g.arc(sx(a.x), sz(a.z), 2.2, 0, 6.283); g.fill(); }
    g.save(); g.translate(sx(hud.x), sz(hud.z)); g.rotate(-hud.yaw); g.fillStyle = '#ffd98a'; g.strokeStyle = '#0b1220';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  }, [hud.x, hud.z, hud.yaw, data, panel]);

  const changeQuality = (q: QualityKey) => { localStorage.setItem('gd_quality', q); setQuality(q); };
  const cycleCamera = () => { const m: CameraMode = hud.mode === 'ketiga' ? 'pertama' : hud.mode === 'pertama' ? 'atas' : 'ketiga'; world.current?.setCameraMode(m); };
  const closeHelp = () => { localStorage.setItem('gd_help_seen', '1'); setPanel(null); };

  if (glError) return <div className="page"><div className="state state-error"><strong>Dunia 3D tidak dapat dimulakan:</strong> {glError} Halaman pengurusan lain masih boleh digunakan.</div></div>;
  return (
    <div className="world">
      <States loading={loading} error={error} onRetry={() => void reload()}>
        <div ref={host} className="world-canvas" />
        <div className="hud hud-top-left">
          <div className="hud-card">
            <div className="hud-room">{hud.room?.name ?? 'Kampus GENIUS DIGITAL'}</div>
            <div className="hud-sub">{hud.room?.description ?? 'Kawasan luar'}</div>
          </div>
          {data?.demo_mode && <Badge tone="demo">MOD DEMO · aktiviti bertanda SIMULASI bukan kerja AI sebenar</Badge>}
        </div>
        <div className="hud hud-top-right">
          <button className="btn" onClick={cycleCamera} title="Tukar kamera (V)">🎥 {CAMERA_LABEL[hud.mode]}</button>
          <button className={`btn ${panel === 'map' ? 'btn-primary' : ''}`} onClick={() => setPanel(panel === 'map' ? null : 'map')}>🗺 Lokasi</button>
          <button className={`btn ${panel === 'settings' ? 'btn-primary' : ''}`} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}>⚙ Grafik</button>
          <button className="btn" onClick={() => setPanel('help')}>?</button>
        </div>

        <div className="hud hud-map"><canvas ref={mapRef} width={230} height={175} onClick={() => setPanel('map')} title="Peta kampus" /></div>

        {prompt && (
          <button className={`hud-prompt ${prompt.actionable ? '' : 'hud-prompt-locked'}`} onClick={() => world.current?.interact()} disabled={!prompt.actionable}>
            {prompt.actionable ? <kbd>E</kbd> : '🔒'} {prompt.label}
          </button>
        )}
        {!hud.locked && hud.mode !== 'atas' && !isTouch() && !panel && !agent && !info && <div className="hud-hint">Klik pada dunia untuk kawalan tetikus · Esc untuk lepaskan</div>}

        {panel === 'map' && data && (
          <aside className="hud-panel">
            <header><h3>Lokasi</h3><button className="icon-btn" onClick={() => setPanel(null)}>✕</button></header>
            <p className="muted">Pilih lokasi untuk berpindah terus. Ruang berkunci mengikut peranan anda ({session.role_name}).</p>
            {[['Dalam bangunan', 0], ['Kawasan luar', 1]].map(([title, outdoor]) => (
              <div key={title as string}>
                <h4>{title}</h4>
                <div className="loc-list">
                  {data.rooms.filter((r) => r.outdoor === outdoor && r.type !== 'koridor').map((r) => (
                    <button key={r.id} className="loc" disabled={!r.can_enter} onClick={() => { world.current?.teleport(r.key); setPanel(null); }}>
                      <span>{r.can_enter ? '' : '🔒 '}{r.name}</span>{r.is_private ? <Badge tone="bad">Peribadi</Badge> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
        )}
        {panel === 'settings' && (
          <aside className="hud-panel">
            <header><h3>Tetapan grafik</h3><button className="icon-btn" onClick={() => setPanel(null)}>✕</button></header>
            <div className="seg">
              {(Object.keys(QUALITY) as QualityKey[]).map((q) => <button key={q} className={quality === q ? 'on' : ''} onClick={() => changeQuality(q)}>{QUALITY[q].label}</button>)}
            </div>
            <p className="muted">Resolusi render semasa: <strong>{res}</strong> · {hud.fps} FPS. “Ultra” merender pada resolusi natif paparan (4K pada monitor 4K). Guna “Ringan” untuk peranti perlahan.</p>
            <h4>Kamera</h4>
            <div className="seg">{(Object.keys(CAMERA_LABEL) as CameraMode[]).map((m) => <button key={m} className={hud.mode === m ? 'on' : ''} onClick={() => world.current?.setCameraMode(m)}>{CAMERA_LABEL[m]}</button>)}</div>
            <h4>Status aset</h4>
            <p className="muted">Watak manusia dan perabot ialah <strong>placeholder prosedur</strong> — belum fotorealistik. Kandungan TV ialah animasi janaan. Gantikan dengan aset berlesen melalui <code>/assets/avatars</code> dan <code>/assets/tv</code> (lihat docs/ASET-3D.md).</p>
          </aside>
        )}
        {panel === 'help' && (
          <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && closeHelp()}>
            <div className="modal"><header><h3>Selamat datang ke GENIUS DIGITAL</h3><button className="icon-btn" onClick={closeHelp}>✕</button></header>
              <div className="modal-body help">
                <div><h4>Komputer</h4><ul><li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / anak panah — berjalan</li><li><kbd>Shift</kbd> — berlari</li><li>Klik dunia — kawalan tetikus (lihat sekeliling), <kbd>Esc</kbd> lepaskan</li><li>Roda tetikus — zum</li><li><kbd>V</kbd> — tukar kamera</li><li><kbd>E</kbd> — berinteraksi (staf, TV, kiosk)</li></ul></div>
                <div><h4>Telefon / tablet</h4><ul><li>Sentuh separuh kiri skrin — joystick berjalan (tolak penuh untuk berlari)</li><li>Seret separuh kanan — lihat sekeliling</li><li>Ketik butang tindakan di bawah untuk berinteraksi</li></ul></div>
                <p className="muted">Dekati TV dan tekan <kbd>E</kbd> untuk buka/tutup bunyi. Watak ialah placeholder, bukan aset fotorealistik.</p>
              </div>
              <footer><button className="btn btn-primary" onClick={closeHelp}>Mula meneroka</button></footer>
            </div>
          </div>
        )}
        {agent && (
          <aside className="hud-panel">
            <header><h3>{agent.name}</h3><button className="icon-btn" onClick={() => setAgent(null)}>✕</button></header>
            <p><strong>{agent.role_title}</strong>{agent.department ? ` · ${agent.department}` : ''}</p>
            <p className="row-gap"><Badge tone={agent.kind === 'agent' ? 'info' : 'neutral'}>{agent.kind === 'agent' ? 'AI Agent' : 'Staf'}</Badge>{agent.is_demo ? <Badge tone="demo">DEMO</Badge> : null}</p>
            <p>{agent.description}</p>
            <div className="hud-card"><div className="hud-sub">Status semasa</div><div>{activityText(agent.activity)}</div>{agent.activity.task && <div className="muted">“{agent.activity.task}”</div>}</div>
            {session.permissions.includes('urus_staf') && <button className="btn btn-primary" onClick={() => go('roster')}>Urus profil</button>}
            {session.permissions.includes('urus_tugasan') && <button className="btn" onClick={() => go('tugasan')}>Lihat tugasan</button>}
          </aside>
        )}
        {info && <aside className="hud-panel"><header><h3>Maklumat</h3><button className="icon-btn" onClick={() => setInfo(null)}>✕</button></header><p>{info}</p></aside>}
      </States>
    </div>
  );
}
