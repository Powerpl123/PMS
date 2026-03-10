import { useEffect, useState } from 'react';
import { api } from '../api';

const categories = ['Turbine', 'Generator', 'Boiler', 'Transformer', 'Cooling System', 'Pump', 'Compressor', 'Heat Exchanger', 'Valve', 'Electrical Panel', 'Control System', 'Other'];
const locations = ['Unit 1 – Boiler Room', 'Unit 1 – Turbine Hall', 'Unit 2 – Boiler Room', 'Unit 2 – Turbine Hall', 'Switchyard', 'Cooling Tower', 'Water Treatment', 'Control Room', 'Coal Handling', 'Ash Handling', 'Fuel Storage', 'Other'];
const empty = { name: '', serialNumber: '', category: 'Turbine', location: 'Unit 1 – Turbine Hall', status: 'active', purchaseCost: '', usefulLifeYears: '', notes: '' };
const statusBadge = { active: 'badge-green', maintenance: 'badge-yellow', retired: 'badge-gray', inactive: 'badge-red' };

export default function Assets() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | item obj
  const [form, setForm] = useState(empty);

  const load = () => api.assets.list(100).then(r => { setItems(r.data); setLoading(false); }).catch(() => { setItems([]); setLoading(false); });

  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) { setForm({ name: item.name, serialNumber: item.serialNumber || '', category: item.category, location: item.location, status: item.status, purchaseCost: item.purchaseCost || '', usefulLifeYears: item.usefulLifeYears || '', notes: item.notes || '' }); setModal(item); }

  async function save() {
    if (modal === 'new') await api.assets.create(form);
    else await api.assets.update(modal.id, form);
    setModal(null); load();
  }

  async function remove(id) {
    if (!confirm('Delete this asset?')) return;
    await api.assets.remove(id); load();
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div><h1>🏗️ Plant Assets</h1><div className="subtitle">Turbines, generators, boilers & equipment</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Register Asset</button>
      </div>
      <div className="card">
        {loading ? <div className="loading">Loading...</div> :
        items.length === 0 ? <div className="empty">No assets yet. Create your first one!</div> :
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Location</th><th>Status</th><th>Cost</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong><br/><small style={{color:'var(--text-muted)'}}>{a.serialNumber}</small></td>
                <td>{a.category}</td>
                <td>{a.location}</td>
                <td><span className={`badge ${statusBadge[a.status]}`}>{a.status}</span></td>
                <td>${Number(a.purchaseCost || 0).toLocaleString()}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Asset' : 'Edit Asset'}</h2>
            <div className="form-row">
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label>Serial Number</label><input value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Location *</label>
                <select value={form.location} onChange={e => set('location', e.target.value)}>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option><option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option><option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group"><label>Purchase Cost</label><input type="number" value={form.purchaseCost} onChange={e => set('purchaseCost', e.target.value)} /></div>
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
