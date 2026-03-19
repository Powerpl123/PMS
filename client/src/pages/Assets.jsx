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
    setSearch(val);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val, typeFilter, 1), 400);
  }

  function handleTypeFilter(val) {
    setTypeFilter(val);
    setPage(1);
    load(search, val, 1);
  }

  function handlePage(pg) {
    setPage(pg);
    load(search, typeFilter, pg);
  }

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
    setModal(null);
    load(search, typeFilter, page);
  }

  async function remove(id) {
    if (!confirm('Delete this asset?')) return;
    await api.assets.remove(id);
    load(search, typeFilter, page);
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      {/* Compact header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Plant Assets</h1>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{total.toLocaleString()} registered assets</span>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Register Asset</button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <input
          value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search KKS, name, location, serial, model..."
          style={{ flex: 1, minWidth: '200px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}
        />
        <select value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}
          style={{ width: '120px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
          <option value="">All Types</option>
          {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{total.toLocaleString()} results</span>
      </div>

      {/* Table */}
      {loading ? <div className="loading">Loading assets...</div> :
       items.length === 0 ? <div className="empty">No assets found.</div> : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}>KKS Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Serial #</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setViewItem(a)}>
                  <td style={tdStyle}>
                    <code style={kksStyle}>{a.kksCode || '—'}</code>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{a.name}</td>
                  <td style={tdStyle}>
                    {a.assetType ? <span className="badge badge-blue" style={compactBadge}>{a.assetType}</span> : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.73rem' }}>{a.modelType || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.73rem' }}>{a.category || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.73rem' }}>{a.location || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.73rem' }}>{a.serialNumber || '—'}</td>
                  <td style={tdStyle}><span className={`badge ${statusBadge[a.status]}`} style={compactBadge}>{a.status}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      <button onClick={() => openEdit(a)} title="Edit" style={iconBtn}>&#9998;</button>
                      <button onClick={() => remove(a.id)} title="Delete" style={iconBtnDanger}>&#128465;</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Page <strong style={{ color: 'var(--primary)' }}>{page}</strong> of {totalPages}
            <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>
              ({((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()})
            </span>
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}>Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Asset Details</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setViewItem(null)}>Close</button>
              </div>
            </h2>
            <div style={detailGrid}>
              <DetailRow label="KKS Code" value={viewItem.kksCode} mono />
              <DetailRow label="Name" value={viewItem.name} bold />
              <DetailRow label="Asset Type" value={viewItem.assetType} badge="badge-blue" />
              <DetailRow label="Status" value={viewItem.status} badge={statusBadge[viewItem.status]} />
              <DetailRow label="Model Type" value={viewItem.modelType} />
              <DetailRow label="Category" value={viewItem.category} />
              <DetailRow label="Location" value={viewItem.location} />
              <DetailRow label="Serial Number" value={viewItem.serialNumber} mono />
              <DetailRow label="Useful Life" value={viewItem.usefulLifeYears ? `${viewItem.usefulLifeYears} years` : null} />
              <DetailRow label="Notes" value={viewItem.notes} full />
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
              <div className="form-group"><label>Location *</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Location" />
              </div>
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

const thStyle = {
  padding: '0.6rem 0.4rem',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: '#FFD700',
  background: 'linear-gradient(90deg, #1A5276, #2E86C1)',
  borderBottom: '2px solid #FFD700',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.6rem 0.5rem',
  fontSize: '0.8rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  background: 'var(--card)',
};

const kksStyle = {
  fontSize: '0.68rem',
  background: 'var(--bg)',
  padding: '0.2rem 0.35rem',
  borderRadius: '3px',
  color: 'var(--accent)',
  border: '1px solid var(--border)',
  fontWeight: 600,
  fontFamily: 'monospace',
  display: 'inline-block',
  wordBreak: 'break-all',
  whiteSpace: 'normal',
  lineHeight: 1.3,
};

const compactBadge = {
  fontSize: '0.65rem',
  padding: '0.2rem 0.4rem',
};

const iconBtn = {
  width: '28px',
  height: '28px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: 0,
  transition: 'all 0.2s ease',
};

const iconBtnDanger = {
  ...iconBtn,
  color: 'var(--danger)',
  borderColor: 'rgba(220,53,69,0.3)',
  background: 'rgba(220,53,69,0.08)',
};

const detailGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0',
};

const detailLabelStyle = {
  fontSize: '0.68rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-muted)',
  marginBottom: '0.2rem',
};

const detailValueStyle = {
  fontSize: '0.9rem',
  color: 'var(--text)',
};

function DetailRow({ label, value, mono, bold, badge, full }) {
  const display = value || '—';
  return (
    <div style={{ padding: '0.65rem 0.5rem', borderBottom: '1px solid var(--border)', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={detailLabelStyle}>{label}</div>
      {badge && value ? (
        <span className={`badge ${badge}`} style={{ fontSize: '0.75rem' }}>{display}</span>
      ) : (
        <div style={{
          ...detailValueStyle,
          fontFamily: mono ? 'monospace' : 'inherit',
          fontWeight: bold ? 700 : 400,
          color: value ? 'var(--text)' : 'var(--text-light)',
          whiteSpace: full ? 'pre-wrap' : 'normal',
        }}>{display}</div>
      )}
    </div>
  );
}
