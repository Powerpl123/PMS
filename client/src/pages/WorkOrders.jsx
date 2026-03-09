import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = { title: '', description: '', assetId: '', assignedTo: '', priority: 'medium', status: 'open', dueDate: '', laborHours: '', estimatedCost: '' };
const priorityBadge = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-yellow', critical: 'badge-red' };
const statusBadge = { open: 'badge-blue', 'in-progress': 'badge-yellow', completed: 'badge-green', cancelled: 'badge-gray' };

export default function WorkOrders() {
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => Promise.all([
    api.get('/work-orders?limit=100'),
    api.get('/assets?limit=100'),
  ]).then(([wo, a]) => { setItems(wo.data); setAssets(a.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({ title: item.title, description: item.description || '', assetId: item.assetId?._id || item.assetId || '', assignedTo: item.assignedTo || '', priority: item.priority, status: item.status, dueDate: item.dueDate ? item.dueDate.slice(0,10) : '', laborHours: item.laborHours || '', estimatedCost: item.estimatedCost || '' });
    setModal(item);
  }

  async function save() {
    const body = { ...form };
    if (body.dueDate) body.dueDate = new Date(body.dueDate).toISOString();
    if (modal === 'new') await api.post('/work-orders', body);
    else await api.put(`/work-orders/${modal._id}`, body);
    setModal(null); load();
  }

  async function remove(id) { if (!confirm('Delete?')) return; await api.del(`/work-orders/${id}`); load(); }
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div><h1>🔧 Work Orders</h1><div className="subtitle">Maintenance scheduling & tracking</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Work Order</button>
      </div>
      <div className="card">
        {loading ? <div className="loading">Loading...</div> :
        items.length === 0 ? <div className="empty">No work orders yet.</div> :
        <table>
          <thead><tr><th>Title</th><th>Asset</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(w => (
              <tr key={w._id}>
                <td><strong>{w.title}</strong></td>
                <td>{w.assetId?.name || '—'}</td>
                <td>{w.assignedTo || '—'}</td>
                <td><span className={`badge ${priorityBadge[w.priority]}`}>{w.priority}</span></td>
                <td><span className={`badge ${statusBadge[w.status]}`}>{w.status}</span></td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(w._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Work Order' : 'Edit Work Order'}</h2>
            <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div className="form-group"><label>Asset *</label>
              <select value={form.assetId} onChange={e => set('assetId', e.target.value)}>
                <option value="">Select asset...</option>
                {assets.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Assigned To</label><input value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} /></div>
              <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="open">Open</option><option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
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
