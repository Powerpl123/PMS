import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = { name: '', sku: '', description: '', unitCost: '', quantityInStock: '', reorderPoint: '', location: '', unit: 'pcs' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get('/inventory?limit=100').then(r => { setItems(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({ name: item.name, sku: item.sku, description: item.description || '', unitCost: item.unitCost || '', quantityInStock: item.quantityInStock || '', reorderPoint: item.reorderPoint || '', location: item.location || '', unit: item.unit || 'pcs' });
    setModal(item);
  }

  async function save() {
    if (modal === 'new') await api.post('/inventory', form);
    else await api.put(`/inventory/${modal._id}`, form);
    setModal(null); load();
  }

  async function remove(id) { if (!confirm('Delete?')) return; await api.del(`/inventory/${id}`); load(); }
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div><h1>📦 Spare Parts</h1><div className="subtitle">Inventory & reorder management</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Part</button>
      </div>
      <div className="card">
        {loading ? <div className="loading">Loading...</div> :
        items.length === 0 ? <div className="empty">No inventory items yet.</div> :
        <table>
          <thead><tr><th>Name</th><th>SKU</th><th>In Stock</th><th>Reorder Point</th><th>Unit Cost</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i._id}>
                <td><strong>{i.name}</strong></td>
                <td><code>{i.sku}</code></td>
                <td>{i.quantityInStock} {i.unit}</td>
                <td>{i.reorderPoint}</td>
                <td>${Number(i.unitCost || 0).toLocaleString()}</td>
                <td>{i.needsReorder ? <span className="badge badge-red">Low Stock</span> : <span className="badge badge-green">OK</span>}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(i)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(i._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Inventory Item' : 'Edit Item'}</h2>
            <div className="form-row">
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label>SKU *</label><input value={form.sku} onChange={e => set('sku', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Quantity In Stock</label><input type="number" value={form.quantityInStock} onChange={e => set('quantityInStock', e.target.value)} /></div>
              <div className="form-group"><label>Reorder Point</label><input type="number" value={form.reorderPoint} onChange={e => set('reorderPoint', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Unit Cost</label><input type="number" value={form.unitCost} onChange={e => set('unitCost', e.target.value)} /></div>
              <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => set('unit', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} /></div>
            <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} /></div>
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
