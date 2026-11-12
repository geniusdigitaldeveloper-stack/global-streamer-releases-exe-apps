import { useCallback, useEffect, useState } from 'react';
import { api, post, type Session } from './api';
import { t, getLang, setLang, LANGUAGES } from './i18n';
import { Badge, Field, States, useApi } from './ui';
import WorldView from './WorldView';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Tasks from './pages/Tasks';
import Approvals from './pages/Approvals';
import Organisation from './pages/Organisation';
import Policies from './pages/Policies';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Audit from './pages/Audit';

const NAV: { key: string; label: string; icon: string; perm?: string }[] = [
  { key: 'pejabat', label: 'Pejabat 3D', icon: '🏢' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊', perm: 'lihat_dashboard' },
  { key: 'roster', label: 'Staf & Agent', icon: '👥' },
  { key: 'tugasan', label: 'Tugasan', icon: '✅' },
  { key: 'kelulusan', label: 'Kelulusan', icon: '🛡', perm: 'lulus_tindakan' },
  { key: 'organisasi', label: 'Organisasi', icon: '🏛', perm: 'urus_organisasi' },
  { key: 'polisi', label: 'Polisi & Workflow', icon: '⚖', perm: 'urus_polisi' },
  { key: 'integrasi', label: 'Integrasi', icon: '🔌', perm: 'urus_integrasi' },
  { key: 'tetapan', label: 'Tetapan', icon: '⚙', perm: 'urus_tetapan' },
  { key: 'audit', label: 'Log Audit', icon: '📜', perm: 'lihat_audit' },
];

function Login({ onDone }: { onDone: (s: Session) => void }) {
  const { data, error, loading, reload } = useApi<{ secured: boolean; roles: any[] }>('/auth/options');
  const [role, setRole] = useState('ceo');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = data?.roles.find((r) => r.key === role);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { onDone((await post('/auth/login', { role, pin })).session); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-big">GENIUS <span>DIGITAL</span></div>
        <p className="muted">Pejabat maya 3D untuk mengurus staf dan AI agent</p>
        <States loading={loading} error={error} onRetry={() => void reload()}>
          <Field label="Masuk sebagai">
            <select value={role} onChange={(e) => { setRole(e.target.value); setErr(null); }}>
              {data?.roles.map((r) => <option key={r.key} value={r.key} disabled={!r.available}>{r.name}{r.available ? '' : ' (belum dikonfigurasi)'}</option>)}
            </select>
          </Field>
          {chosen && <p className="muted">{chosen.description}</p>}
          {chosen?.needs_pin && <Field label="PIN"><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" autoFocus /></Field>}
          {!data?.secured && <div className="notice notice-warn">Mod demo setempat: PIN belum ditetapkan (<code>GD_CEO_PIN</code>), jadi log masuk terbuka. Tetapkan PIN sebelum berkongsi akses.</div>}
          {err && <div className="notice notice-bad" role="alert">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sedang masuk…' : t('Log masuk')}</button>
        </States>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [bootError, setBootError] = useState<string | null>(null);
  const [page, setPage] = useState(() => location.hash.replace('#/', '') || 'pejabat');
  const [, setLangTick] = useState(0);
  const [menu, setMenu] = useState(false);
  const pending = useApi<any[]>(session?.permissions.includes('lulus_tindakan') ? '/approvals' : null, 10000);

  const boot = useCallback(() => { setBootError(null); api('/auth/me').then((r) => setSession(r.session)).catch((e) => setBootError(e.message)); }, []);
  useEffect(boot, [boot]);
  useEffect(() => { const h = () => setPage(location.hash.replace('#/', '') || 'pejabat'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const go = useCallback((p: string) => { location.hash = `#/${p}`; setMenu(false); }, []);

  if (bootError) return <div className="login"><div className="login-card"><div className="brand-big">GENIUS <span>DIGITAL</span></div><div className="notice notice-bad">{bootError}</div><button className="btn btn-primary" onClick={boot}>{t('Cuba semula')}</button></div></div>;
  if (session === undefined) return <div className="login"><div className="state"><div className="spinner" />{t('Memuatkan…')}</div></div>;
  if (!session) return <Login onDone={setSession} />;

  const nav = NAV.filter((n) => !n.perm || session.permissions.includes(n.perm));
  const current = nav.find((n) => n.key === page) ? page : 'pejabat';
  const logout = async () => { await post('/auth/logout'); setSession(null); };
  const props = { session, go };
  return (
    <div className={`app ${current === 'pejabat' ? 'app-world' : ''}`}>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
        <div className="brand" onClick={() => go('pejabat')}>GENIUS <span>DIGITAL</span></div>
        <nav className={menu ? 'open' : ''}>
          {nav.map((n) => (
            <a key={n.key} className={current === n.key ? 'on' : ''} onClick={() => go(n.key)}>
              <span className="nav-icon">{n.icon}</span>{t(n.label)}
              {n.key === 'kelulusan' && pending.data?.length ? <span className="count">{pending.data.length}</span> : null}
            </a>
          ))}
        </nav>
        <div className="user">
          <select className="lang" value={getLang()} onChange={(e) => { setLang(e.target.value); setLangTick((x) => x + 1); }} aria-label="Bahasa">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
          </select>
          <Badge tone="gold">{session.role_name}</Badge>
          <button className="btn btn-small" onClick={logout}>{t('Log keluar')}</button>
        </div>
      </header>
      <main>
        {current === 'pejabat' && <WorldView {...props} />}
        {current === 'dashboard' && <Dashboard {...props} />}
        {current === 'roster' && <Roster {...props} />}
        {current === 'tugasan' && <Tasks {...props} />}
        {current === 'kelulusan' && <Approvals {...props} onChange={() => void pending.reload(true)} />}
        {current === 'organisasi' && <Organisation {...props} />}
        {current === 'polisi' && <Policies {...props} />}
        {current === 'integrasi' && <Integrations {...props} />}
        {current === 'tetapan' && <Settings {...props} />}
        {current === 'audit' && <Audit {...props} />}
      </main>
    </div>
  );
}
