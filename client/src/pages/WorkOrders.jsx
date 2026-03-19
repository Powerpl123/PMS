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
    api.workOrders.list(100).catch(() => ({ data: [] })),
    api.assets.listAll().catch(() => ({ data: [] })),
  ]).then(([wo, a]) => { setItems(wo.data); setAssets(a.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({
      title: item.title, description: item.description || '',
      assetId: item.assetId?.id || item.assetId || '', assignedTo: item.assignedTo || '',
      priority: item.priority, status: item.status,
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
      laborHours: item.laborHours || '', estimatedCost: item.estimatedCost || '',
    });
    setModal(item);
  }

  async function save() {
    const body = { ...form };
    if (body.dueDate) body.dueDate = new Date(body.dueDate).toISOString();
    if (modal === 'new') await api.workOrders.create(body);
    else await api.workOrders.update(modal.id, body);
    setModal(null); load();
  }

  async function remove(id) { if (!confirm('Delete?')) return; await api.workOrders.remove(id); load(); }
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Stats
  const openCount = items.filter(w => w.status === 'open').length;
  const inProgressCount = items.filter(w => w.status === 'in-progress').length;
  const completedCount = items.filter(w => w.status === 'completed').length;
  const criticalCount = items.filter(w => w.priority === 'critical').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Work Orders</h1>
          <div className="subtitle">Maintenance scheduling & tracking</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Work Order</button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <MiniStat label="Open" value={openCount} color="#00D9FF" />
        <MiniStat label="In Progress" value={inProgressCount} color="#FFB81C" />
        <MiniStat label="Completed" value={completedCount} color="#00FF00" />
        <MiniStat label="Critical" value={criticalCount} color="#FF5500" />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? <div className="loading" style={{ padding: '3rem' }}>Loading...</div> :
        items.length === 0 ? <div className="empty" style={{ padding: '3rem' }}>No work orders yet.</div> :
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Asset</th>
                <th>KKS Code</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 700 }}>{w.title}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{w.assetId?.name || '—'}</td>
                  <td>
                    {w.assetId?.kksCode ? (
                      <code style={{ fontSize: '0.78rem', background: 'var(--bg)', padding: '0.25rem 0.5rem', borderRadius: '3px', color: '#FFD54F', border: '1px solid var(--border)' }}>
                        {w.assetId.kksCode}
                      </code>
                    ) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{w.assignedTo || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {w.dueDate ? new Date(w.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td><span className={`badge ${priorityBadge[w.priority]}`}>{w.priority}</span></td>
                  <td><span className={`badge ${statusBadge[w.status]}`}>{w.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(w.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Work Order' : 'Edit Work Order'}</h2>
            <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div className="form-group"><label>Asset *</label>
              <select value={form.assetId} onChange={e => set('assetId', e.target.value)}>
                <option value="">Select asset...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.kksCode ? `${a.kksCode} — ${a.name}` : a.name}</option>)}
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

function MiniStat({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1rem', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
    </div>
  );
}
