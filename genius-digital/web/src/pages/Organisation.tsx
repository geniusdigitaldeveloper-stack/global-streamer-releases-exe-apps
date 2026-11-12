import { useState } from 'react';
import { del, post, put, type Session } from '../api';
import { Badge, Confirm, Field, Modal, States, useAction, useApi } from '../ui';

export default function Organisation(_: { session: Session; go: (p: string) => void }) {
  const depts = useApi<any[]>('/departments');
  const roles = useApi<any>('/roles');
  const rooms = useApi<any[]>('/rooms');
  const act = useAction();
  const [tab, setTab] = useState('jabatan');
  const [dept, setDept] = useState<any | null>(null);
  const [role, setRole] = useState<any | null>(null);
  const [remove, setRemove] = useState<{ kind: string; item: any } | null>(null);

  const saveDept = async () => { if (await act(() => (dept.id ? put(`/departments/${dept.id}`, dept) : post('/departments', dept)), 'Jabatan disimpan.')) { setDept(null); void depts.reload(true); } };
  const saveRole = async () => { if (await act(() => (role.id ? put(`/roles/${role.id}`, role) : post('/roles', role)), 'Peranan disimpan.')) { setRole(null); void roles.reload(true); } };
  const toggleAccess = async (room: any, roleId: number) => {
    const ids = room.role_ids.includes(roleId) ? room.role_ids.filter((x: number) => x !== roleId) : [...room.role_ids, roleId];
    if (await act(() => put(`/rooms/${room.id}/access`, { role_ids: ids }), `Akses ${room.name} dikemas kini.`)) void rooms.reload(true);
  };
  const doRemove = async () => {
    const { kind, item } = remove!;
    if (await act(() => del(`/${kind}/${item.id}`), 'Dipadam.')) { void depts.reload(true); void roles.reload(true); void rooms.reload(true); }
    setRemove(null);
  };
  const indoorRooms = rooms.data?.filter((r) => r.type !== 'koridor') ?? [];

  return (
    <div className="page">
      <h1>Organisasi</h1>
      <div className="toolbar"><div className="seg">{[['jabatan', 'Jabatan'], ['peranan', 'Peranan & kebenaran'], ['ruang', 'Akses ruang']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'jabatan' && <button className="btn btn-primary" onClick={() => setDept({ name: '', description: '', room_id: '', color: '#c9a45c', active: true })}>+ Tambah jabatan</button>}
        {tab === 'peranan' && <button className="btn btn-primary" onClick={() => setRole({ name: '', description: '', permissions: [] })}>+ Tambah peranan</button>}
      </div>

      {tab === 'jabatan' && <States loading={depts.loading} error={depts.error} onRetry={() => void depts.reload()} empty={depts.data?.length === 0}>
        <div className="table-wrap"><table><thead><tr><th>Jabatan</th><th>Ruang pejabat</th><th>Ahli</th><th>Status</th><th /></tr></thead><tbody>
          {depts.data?.map((d) => <tr key={d.id}><td><span className="dot" style={{ background: d.color }} /><b>{d.name}</b><div className="muted small">{d.description}</div></td><td>{d.room_name ?? '—'}</td><td>{d.members}</td><td>{d.active ? <Badge tone="ok">Aktif</Badge> : <Badge>Tidak aktif</Badge>}</td>
            <td className="row-gap"><button className="btn btn-small" onClick={() => setDept({ ...d, room_id: d.room_id ?? '' })}>Edit</button><button className="btn btn-small btn-danger" onClick={() => setRemove({ kind: 'departments', item: d })}>Padam</button></td></tr>)}
        </tbody></table></div>
      </States>}

      {tab === 'peranan' && <States loading={roles.loading} error={roles.error} onRetry={() => void roles.reload()}>
        <div className="cards">{roles.data?.roles.map((r: any) => (
          <article key={r.id} className="card"><header><h3>{r.name}</h3>{r.is_system ? <Badge>sistem</Badge> : null}</header><p className="muted">{r.description}</p>
            <div className="chips">{r.permissions.length ? r.permissions.map((p: string) => <span key={p}>{roles.data.permissions.find((x: any) => x.key === p)?.label ?? p}</span>) : <span className="muted">Tiada kebenaran pengurusan</span>}</div>
            <footer>{r.key !== 'ceo' ? <button className="btn btn-small" onClick={() => setRole({ ...r })}>Edit</button> : <span className="muted small">Sentiasa semua kebenaran</span>}{!r.is_system && <button className="btn btn-small btn-danger" onClick={() => setRemove({ kind: 'roles', item: r })}>Padam</button>}</footer>
          </article>))}</div>
      </States>}

      {tab === 'ruang' && <States loading={rooms.loading || roles.loading} error={rooms.error} onRetry={() => void rooms.reload()}>
        <p className="muted">Tandakan peranan yang boleh memasuki setiap ruang dalam dunia 3D. CEO sentiasa mempunyai akses. Ruang peribadi hanya boleh diberi kepada CEO dan PA.</p>
        <div className="table-wrap"><table className="matrix"><thead><tr><th>Ruang</th>{roles.data?.roles.map((r: any) => <th key={r.id}>{r.name}</th>)}</tr></thead><tbody>
          {indoorRooms.map((room) => <tr key={room.id}><td>{room.name} {room.is_private ? <Badge tone="bad">Peribadi</Badge> : null}{room.outdoor ? <Badge>luar</Badge> : null}</td>
            {roles.data?.roles.map((r: any) => { const locked = r.key === 'ceo' || (room.is_private && !['ceo', 'pa'].includes(r.key)); return <td key={r.id}><input type="checkbox" checked={room.role_ids.includes(r.id)} disabled={locked} title={locked ? 'Tidak boleh diubah' : ''} onChange={() => void toggleAccess(room, r.id)} /></td>; })}</tr>)}
        </tbody></table></div>
      </States>}

      {dept && <Modal title={dept.id ? 'Edit jabatan' : 'Tambah jabatan'} onClose={() => setDept(null)} footer={<><button className="btn" onClick={() => setDept(null)}>Batal</button><button className="btn btn-primary" onClick={saveDept}>Simpan</button></>}>
        <Field label="Nama *"><input value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} autoFocus /></Field>
        <Field label="Penerangan"><textarea rows={2} value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} /></Field>
        <Field label="Ruang pejabat" hint="Ahli jabatan duduk di ruang ini dalam dunia 3D."><select value={dept.room_id} onChange={(e) => setDept({ ...dept, room_id: e.target.value })}><option value="">— tiada —</option>{rooms.data?.filter((r) => !r.outdoor && r.walled).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Warna"><input type="color" value={dept.color} onChange={(e) => setDept({ ...dept, color: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={Boolean(dept.active)} onChange={(e) => setDept({ ...dept, active: e.target.checked })} /> Aktif</label>
      </Modal>}
      {role && <Modal title={role.id ? `Edit peranan — ${role.name}` : 'Tambah peranan'} onClose={() => setRole(null)} footer={<><button className="btn" onClick={() => setRole(null)}>Batal</button><button className="btn btn-primary" onClick={saveRole}>Simpan</button></>}>
        <Field label="Nama *"><input value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} autoFocus /></Field>
        <Field label="Penerangan"><input value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} /></Field>
        <div className="field"><span>Kebenaran</span><div className="checks">{roles.data?.permissions.map((p: any) => <label key={p.key}><input type="checkbox" checked={role.permissions.includes(p.key)} onChange={() => setRole({ ...role, permissions: role.permissions.includes(p.key) ? role.permissions.filter((x: string) => x !== p.key) : [...role.permissions, p.key] })} /> {p.label}</label>)}</div></div>
      </Modal>}
      {remove && <Confirm danger text={`Padam "${remove.item.name}"? Tindakan ini tidak boleh dibatalkan.`} onNo={() => setRemove(null)} onYes={() => void doRemove()} />}
    </div>
  );
}
