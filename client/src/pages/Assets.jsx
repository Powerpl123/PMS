import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';

const categories = ['Turbine', 'Generator', 'Boiler', 'Transformer', 'Cooling System', 'Pump', 'Compressor', 'Heat Exchanger', 'Valve', 'Electrical Panel', 'Control System', 'Other'];
const assetTypes = ['PRODUCTION', 'TOOL'];
const empty = { kksCode: '', name: '', serialNumber: '', category: '', location: '', assetType: '', modelType: '', status: 'active', usefulLifeYears: '', notes: '' };
const statusBadge = { active: 'badge-green', maintenance: 'badge-yellow', retired: 'badge-gray', inactive: 'badge-red' };
const PER_PAGE = 50;

export default function Assets() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [viewItem, setViewItem] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback((q, type, pg) => {
    setLoading(true);
    api.assets.search({ query: q, typeFilter: type, page: pg, perPage: PER_PAGE })
      .then(r => { setItems(r.data); setTotal(r.total); setLoading(false); })
      .catch(() => { setItems([]); setTotal(0); setLoading(false); });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load('', '', 1); }, []);

  function handleSearch(val) {
    setSearch(val); setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val, typeFilter, 1), 400);
  }
  function handleTypeFilter(val) { setTypeFilter(val); setPage(1); load(search, val, 1); }
  function handlePage(pg) { setPage(pg); load(search, typeFilter, pg); }
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({
      kksCode: item.kksCode || '', name: item.name, serialNumber: item.serialNumber || '',
      category: item.category || '', location: item.location || '', assetType: item.assetType || '',
      modelType: item.modelType || '', status: item.status, usefulLifeYears: item.usefulLifeYears || '',
      notes: item.notes || '',
    });
    setModal(item);
  }

  async function save() {
    if (modal === 'new') await api.assets.create(form);
    else await api.assets.update(modal.id, form);
    setModal(null); load(search, typeFilter, page);
  }
  async function remove(id) {
    if (!confirm('Delete this asset?')) return;
    await api.assets.remove(id); load(search, typeFilter, page);
  }
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const cols = [
    { key: 'kks',    label: 'KKS CODE',  w: '13%' },
    { key: 'name',   label: 'NAME',       w: '18%' },
    { key: 'type',   label: 'TYPE',       w: '9%' },
    { key: 'model',  label: 'MODEL',      w: '14%' },
    { key: 'cat',    label: 'CATEGORY',   w: '9%' },
    { key: 'loc',    label: 'LOCATION',   w: '13%' },
    { key: 'serial', label: 'SERIAL #',   w: '12%' },
    { key: 'status', label: 'STATUS',     w: '7%' },
    { key: 'act',    label: '',            w: '5%' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>Plant Assets</h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{total.toLocaleString()} registered assets</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Register</button>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search KKS, name, location, serial, model..."
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem' }} />
        <select value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}
          style={{ width: '100px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>
          <option value="">All Types</option>
          {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{total.toLocaleString()}</span>
      </div>

      {/* Table */}
      {loading ? <div className="loading">Loading...</div> :
       items.length === 0 ? <div className="empty">No assets found.</div> : (
        <>
          <div style={{ flex: 1, overflow: 'auto', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', borderSpacing: 0 }}>
              <colgroup>
                {cols.map(c => <col key={c.key} style={{ width: c.w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c.key} style={{
                      padding: '0.5rem 0.35rem', fontSize: '0.6rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.5px', color: '#FFD700',
                      background: '#142a42', borderBottom: '2px solid #2E86C1',
                      borderRight: '1px solid #1e3d5a', whiteSpace: 'nowrap', textAlign: 'left',
                      position: 'sticky', top: 0, zIndex: 2,
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((a, i) => {
                  const bg = i % 2 === 0 ? '#111d2b' : '#0e1722';
                  return (
                    <tr key={a.id} className="asset-row" onClick={() => setViewItem(a)}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, background: bg }}>
                        <code style={{
                          fontSize: '0.65rem', background: '#0a1628', padding: '0.15rem 0.3rem',
                          borderRadius: '3px', color: '#FFD700', border: '1px solid #1e3d5a',
                          fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all',
                          whiteSpace: 'normal', lineHeight: 1.2, display: 'inline-block',
                        }}>{a.kksCode || '—'}</code>
                      </td>
                      <td style={{ ...td, background: bg, fontWeight: 600, color: '#e2e8f0' }}>{a.name}</td>
                      <td style={{ ...td, background: bg }}>
                        {a.assetType ? (() => {
                          const c = a.assetType === 'PRODUCTION' ? '#22d3ee' : '#a78bfa';
                          return <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '3px', background: c+'15', color: c, border: `1px solid ${c}30`, textTransform: 'uppercase' }}>{a.assetType}</span>;
                        })() : '—'}
                      </td>
                      <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.7rem' }}>{a.modelType || '—'}</td>
                      <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.7rem' }}>{a.category || '—'}</td>
                      <td style={{ ...td, background: bg, color: '#b0bec5', fontSize: '0.7rem' }}>{a.location || '—'}</td>
                      <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.7rem', fontFamily: 'monospace' }}>{a.serialNumber || '—'}</td>
                      <td style={{ ...td, background: bg }}>
                        {(() => {
                          const sc = { active: '#22c55e', maintenance: '#f59e0b', retired: '#6b7280', inactive: '#ef4444' };
                          const c = sc[a.status] || '#6b7280';
                          return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.63rem', fontWeight: 600, color: c, textTransform: 'capitalize' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}80` }} />{a.status}
                          </span>;
                        })()}
                      </td>
                      <td style={{ ...td, background: bg, textAlign: 'center', padding: '0.3rem 0.15rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <button onClick={() => openEdit(a)} title="Edit" style={aBtn}>&#9998;</button>
                          <button onClick={() => remove(a.id)} title="Delete" style={{ ...aBtn, color: '#f87171', borderColor: '#f8717130' }}>&#128465;</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Page <strong style={{ color: 'var(--accent)' }}>{page}</strong>/{totalPages}
              <span style={{ opacity: 0.5, marginLeft: '0.4rem' }}>({((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,total)} of {total.toLocaleString()})</span>
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button className="btn btn-secondary btn-sm" disabled={page<=1} onClick={() => handlePage(page-1)}>Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={page>=totalPages} onClick={() => handlePage(page+1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {/* Hover style */}
      <style>{`.asset-row:hover td { background: #1a2d42 !important; }`}</style>

      {/* Detail View */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Asset Details</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setViewItem(null)}>Close</button>
              </div>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <DRow label="KKS Code" value={viewItem.kksCode} mono />
              <DRow label="Name" value={viewItem.name} bold />
              <DRow label="Asset Type" value={viewItem.assetType} badge="badge-blue" />
              <DRow label="Status" value={viewItem.status} badge={statusBadge[viewItem.status]} />
              <DRow label="Model Type" value={viewItem.modelType} />
              <DRow label="Category" value={viewItem.category} />
              <DRow label="Location" value={viewItem.location} />
              <DRow label="Serial Number" value={viewItem.serialNumber} mono />
              <DRow label="Useful Life" value={viewItem.usefulLifeYears ? `${viewItem.usefulLifeYears} years` : null} />
              <DRow label="Notes" value={viewItem.notes} full />
            </div>
          </div>
        </div>
      )}

      {/* Edit/New Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Asset' : 'Edit Asset'}</h2>
            <div className="form-row">
              <div className="form-group"><label>KKS Code</label><input value={form.kksCode} onChange={e => set('kksCode', e.target.value)} placeholder="e.g. 1MAA10AT001" /></div>
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Serial Number</label><input value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} /></div>
              <div className="form-group"><label>Model Type</label><input value={form.modelType} onChange={e => set('modelType', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Asset Type</label>
                <select value={form.assetType} onChange={e => set('assetType', e.target.value)}>
                  <option value="">— Select —</option>
                  {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">— Select —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Location *</label><input value={form.location} onChange={e => set('location', e.target.value)} /></div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option><option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option><option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const td = {
  padding: '0.45rem 0.35rem',
  fontSize: '0.75rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  borderRight: '1px solid #1a2f45',
  borderBottom: '1px solid #162538',
  color: '#8899aa',
};

const aBtn = {
  width: '22px', height: '22px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #2a4060', borderRadius: '3px',
  background: 'transparent', color: '#5DADE2',
  cursor: 'pointer', fontSize: '0.7rem', padding: 0,
};

function DRow({ label, value, mono, bold, badge, full }) {
  const display = value || '—';
  return (
    <div style={{ padding: '0.5rem 0.4rem', borderBottom: '1px solid var(--border)', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{label}</div>
      {badge && value ? (
        <span className={`badge ${badge}`} style={{ fontSize: '0.72rem' }}>{display}</span>
      ) : (
        <div style={{
          fontSize: '0.85rem', color: value ? 'var(--text)' : 'var(--text-light)',
          fontFamily: mono ? 'monospace' : 'inherit', fontWeight: bold ? 700 : 400,
          whiteSpace: full ? 'pre-wrap' : 'normal',
        }}>{display}</div>
      )}
    </div>
  );
}
