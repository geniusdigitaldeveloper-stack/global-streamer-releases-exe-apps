// Komponen UI dikongsi: keadaan loading/empty/error, modal, toast, medan borang.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { t } from './i18n';

export function useApi<T = any>(path: string | null, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const alive = useRef(true);
  const reload = useCallback(async (quiet = false) => {
    if (!path) return;
    if (!quiet) setLoading(true);
    try { const d = await api<T>(path); if (alive.current) { setData(d); setError(null); } }
    catch (e: any) { if (alive.current && !quiet) setError(e.message); }
    finally { if (alive.current) setLoading(false); }
  }, [path]);
  useEffect(() => { alive.current = true; void reload(); return () => { alive.current = false; }; }, [reload]);
  useEffect(() => { if (!pollMs) return; const id = setInterval(() => void reload(true), pollMs); return () => clearInterval(id); }, [pollMs, reload]);
  return { data, error, loading, reload };
}

export function States({ loading, error, empty, onRetry, emptyText, children }: { loading: boolean; error: string | null; empty?: boolean; onRetry?: () => void; emptyText?: string; children: ReactNode }) {
  if (loading) return <div className="state"><div className="spinner" />{t('Memuatkan…')}</div>;
  if (error) return <div className="state state-error" role="alert"><strong>Ralat:</strong> {error}{onRetry && <button className="btn" onClick={onRetry}>{t('Cuba semula')}</button>}</div>;
  if (empty) return <div className="state">{emptyText ?? t('Tiada rekod.')}</div>;
  return <>{children}</>;
}

type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 7000 : 3500);
  }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts" aria-live="polite">{items.map((i) => <div key={i.id} className={`toast toast-${i.kind}`}>{i.text}</div>)}</div></ToastCtx.Provider>;
}
// Jalankan tindakan dengan toast berjaya/gagal.
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    try { const r = await fn(); if (ok) toast('ok', ok); return r ?? true; }
    catch (e: any) { toast('err', e.message || 'Tindakan gagal.'); return null; }
  }, [toast]);
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Tutup">✕</button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <label className={`field ${full ? 'field-full' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export const Badge = ({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) => <span className={`badge badge-${tone}`}>{children}</span>;
export const DemoBadge = ({ show }: { show: unknown }) => (show ? <Badge tone="demo">DEMO</Badge> : null);
export const SimBadge = ({ show }: { show: unknown }) => (show ? <Badge tone="demo">SIMULASI</Badge> : null);

export const STATUS_LABEL: Record<string, string> = {
  baharu: 'Baharu', diagihkan: 'Diagihkan', berjalan: 'Berjalan', dijeda: 'Dijeda', menunggu_kelulusan: 'Menunggu kelulusan', ditahan: 'Ditahan',
  tindakan_manual: 'Tindakan manual', selesai: 'Selesai', ditolak: 'Ditolak', ditutup: 'Ditutup',
  menunggu: 'Menunggu', maklumat_diminta: 'Maklumat diminta', diluluskan: 'Diluluskan', diluluskan_disunting: 'Diluluskan (disunting)', dibatalkan: 'Dibatalkan',
  aktif: 'Aktif', tidak_aktif: 'Tidak aktif', belum_dikonfigurasi: 'Belum dikonfigurasi', belum_diuji: 'Belum diuji', ralat: 'Ralat sambungan',
  dinyahaktifkan: 'Dinyahaktifkan', tidak_disokong: 'Tidak disokong', berjaya: 'Berjaya', dibenarkan: 'Dibenarkan', gagal: 'Gagal',
  tersedia: 'Tersedia', belum_dilaksanakan: 'Belum dilaksanakan', manual: 'Manual',
};
const TONES: Record<string, string> = {
  berjalan: 'ok', selesai: 'ok', aktif: 'ok', diluluskan: 'ok', diluluskan_disunting: 'ok', berjaya: 'ok', dibenarkan: 'ok', tersedia: 'ok',
  menunggu_kelulusan: 'warn', dijeda: 'warn', menunggu: 'warn', maklumat_diminta: 'warn', tindakan_manual: 'warn', belum_diuji: 'warn', manual: 'warn',
  ditahan: 'bad', ditolak: 'bad', ralat: 'bad', gagal: 'bad', tidak_aktif: 'neutral', diagihkan: 'info', baharu: 'info',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={TONES[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>;
export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const RISK_TONE: Record<string, string> = { rendah: 'ok', sederhana: 'warn', tinggi: 'bad' };

export function Confirm({ text, onYes, onNo, danger }: { text: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return <Modal title="Sahkan tindakan" onClose={onNo} footer={<><button className="btn" onClick={onNo}>{t('Batal')}</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onYes}>Ya, teruskan</button></>}><p>{text}</p></Modal>;
}
