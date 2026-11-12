import { useState } from 'react';
import { post, type Session } from '../api';
import { Badge, DemoBadge, Field, Modal, RISK_TONE, States, StatusBadge, fmtTime, useAction, useApi } from '../ui';

export default function Approvals({ onChange }: { session: Session; go: (p: string) => void; onChange: () => void }) {
  const [tab, setTab] = useState<'menunggu' | 'semua'>('menunggu');
  const list = useApi<any[]>(`/approvals${tab === 'semua' ? '?status=semua' : ''}`, 6000);
  const act = useAction();
  const [dlg, setDlg] = useState<{ a: any; decision: string } | null>(null);
  const [note, setNote] = useState('');
  const [proposal, setProposal] = useState('');
  const open = (a: any, decision: string) => { setDlg({ a, decision }); setNote(''); setProposal(a.proposal); };
  const decide = async (a: any, decision: string) => {
    if (decision === 'beri_maklumat') {
      if (await act(() => post(`/approvals/${a.id}/info`, { info: note }), 'Maklumat ditambah; kelulusan kembali menunggu keputusan.')) { setDlg(null); void list.reload(true); }
      return;
    }
    const r: any = await act(() => post(`/approvals/${a.id}/decide`, { decision, note, proposal }), { lulus: 'Diluluskan dan direkod.', sunting: 'Diluluskan dengan suntingan.', tolak: 'Ditolak dan direkod.', minta_maklumat: 'Permintaan maklumat dihantar.' }[decision]);
    if (r) { setDlg(null); void list.reload(true); onChange(); }
  };
  const TITLE: Record<string, string> = { sunting: 'Sunting & luluskan', tolak: 'Tolak cadangan', minta_maklumat: 'Minta maklumat lanjut', lulus: 'Luluskan', beri_maklumat: 'Beri maklumat tambahan' };
  return (
    <div className="page">
      <h1>Queue Kelulusan</h1>
      <p className="muted">Tindakan agent yang memerlukan keputusan anda. Setiap keputusan direkod dalam log audit.</p>
      <div className="toolbar"><div className="seg"><button className={tab === 'menunggu' ? 'on' : ''} onClick={() => setTab('menunggu')}>Menunggu keputusan</button><button className={tab === 'semua' ? 'on' : ''} onClick={() => setTab('semua')}>Sejarah</button></div></div>
      <States loading={list.loading && !list.data} error={list.error} onRetry={() => void list.reload()} empty={list.data?.length === 0} emptyText={tab === 'menunggu' ? 'Tiada tindakan menunggu kelulusan. 🎉' : 'Tiada sejarah kelulusan.'}>
        <div className="approvals">
          {list.data?.map((a) => {
            const pending = ['menunggu', 'maklumat_diminta'].includes(a.status);
            return (
              <article key={a.id} className="card approval">
                <header><div><h3>{a.task_title}</h3><div className="muted">{a.agent_name ?? 'Agent dipadam'} · {a.department ?? '—'} · {fmtTime(a.created_at)}</div></div>
                  <div className="row-gap"><Badge tone={RISK_TONE[a.risk]}>Risiko {a.risk}</Badge><StatusBadge status={a.status} /><DemoBadge show={a.is_demo} /></div></header>
                <div className="approval-grid">
                  <div><h4>Cadangan</h4><p>{a.proposal}</p><Badge>{a.action_label}</Badge></div>
                  <div><h4>Konteks</h4><p className="pre">{a.context || '—'}</p></div>
                  <div><h4>Bukti</h4><p className="pre">{a.evidence || <span className="reason">Tiada bukti dilampirkan.</span>}</p></div>
                  <div><h4>Sebab kelulusan diperlukan</h4><ul>{a.reasons.map((r: any) => <li key={r.code}>{r.text}</li>)}</ul></div>
                </div>
                {a.decision_note && <div className="notice notice-info"><b>Nota{a.decided_by ? ` (${a.decided_by})` : ''}:</b> {a.decision_note}</div>}
                {pending && <footer>
                  <button className="btn btn-primary" onClick={() => open(a, 'lulus')}>✓ Lulus</button>
                  <button className="btn" onClick={() => open(a, 'sunting')}>✎ Sunting</button>
                  <button className="btn btn-danger" onClick={() => open(a, 'tolak')}>✕ Tolak</button>
                  <button className="btn" onClick={() => open(a, 'minta_maklumat')}>? Minta maklumat</button>
                  {a.status === 'maklumat_diminta' && <button className="btn" onClick={() => open(a, 'beri_maklumat')}>＋ Beri maklumat</button>}
                </footer>}
              </article>
            );
          })}
        </div>
      </States>
      {dlg && (
        <Modal title={`${TITLE[dlg.decision]} — ${dlg.a.task_title}`} onClose={() => setDlg(null)} footer={<><button className="btn" onClick={() => setDlg(null)}>Batal</button><button className={`btn ${dlg.decision === 'tolak' ? 'btn-danger' : 'btn-primary'}`} onClick={() => void decide(dlg.a, dlg.decision)}>Sahkan</button></>}>
          {dlg.decision === 'lulus' && <p>Luluskan cadangan ini? Jika tiada connector pelaksanaan aktif, tindakan akan menunggu pelaksanaan manual.</p>}
          {dlg.decision === 'sunting' && <Field label="Cadangan (disunting)"><textarea rows={4} value={proposal} onChange={(e) => setProposal(e.target.value)} /></Field>}
          <Field label={dlg.decision === 'tolak' ? 'Sebab penolakan *' : dlg.decision === 'beri_maklumat' ? 'Maklumat tambahan *' : dlg.decision === 'minta_maklumat' ? 'Maklumat yang diperlukan *' : 'Nota (pilihan)'}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
    </div>
  );
}
