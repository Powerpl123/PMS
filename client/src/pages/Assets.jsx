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
  const debounceRef = useRef(null);

  const load = useCallback((q, type, pg) => {
    setLoading(true);
    api.assets.search({ query: q, typeFilter: type, page: pg, perPage: PER_PAGE })
      .then(r => { setItems(r.data); setTotal(r.total); setLoading(false); })
      .catch(() => { setItems([]); setTotal(0); setLoading(false); });
  }, []);

  // Initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load('', '', 1); }, []);

  // Debounce search — wait 400ms after user stops typing
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
  function openEdit(item) { setForm({ kksCode: item.kksCode || '', name: item.name, serialNumber: item.serialNumber || '', category: item.category || '', location: item.location || '', assetType: item.assetType || '', modelType: item.modelType || '', status: item.status, usefulLifeYears: item.usefulLifeYears || '', notes: item.notes || '' }); setModal(item); }

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
      <div className="page-header">
        <div><h1>🏗️ Plant Assets</h1><div className="subtitle">Turbines, generators, boilers & equipment — {total} total</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Register Asset</button>
      </div>

      <div className="card" style={{marginBottom:'1rem',display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search KKS, name, location, serial, model…" style={{flex:'1',minWidth:'200px'}} />
        <select value={typeFilter} onChange={e => handleTypeFilter(e.target.value)} style={{width:'160px'}}>
          <option value="">All Types</option>
          {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{color:'var(--text-muted)',fontSize:'0.9em'}}>{total} results</span>
      </div>

      <div className="card">
        {loading ? <div className="loading">Loading...</div> :
        items.length === 0 ? <div className="empty">No assets found.</div> :
        <>
        <table>
          <thead><tr><th>KKS Code</th><th>Name</th><th>Asset Type</th><th>Model Type</th><th>Category</th><th>Location</th><th>Serial Number</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td><code style={{fontSize:'0.85em',background:'var(--bg-secondary)',padding:'2px 6px',borderRadius:'4px'}}>{a.kksCode || '—'}</code></td>
                <td><strong>{a.name}</strong></td>
                <td>{a.assetType || '—'}</td>
                <td>{a.modelType || '—'}</td>
                <td>{a.category || '—'}</td>
                <td>{a.location}</td>
                <td>{a.serialNumber || '—'}</td>
                <td><span className={`badge ${statusBadge[a.status]}`}>{a.status}</span></td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.75rem 0',marginTop:'0.5rem',borderTop:'1px solid var(--border)'}}>
          <span style={{fontSize:'0.9em',color:'var(--text-muted)'}}>Page {page} of {totalPages}</span>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}>← Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>Next →</button>
          </div>
        </div>
        </>}
      </div>
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
            </div>
            <div className="form-row">
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
