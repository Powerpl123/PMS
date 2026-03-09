import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = { name: '', contactName: '', email: '', phone: '', address: '', rating: '', performanceNotes: '' };

export default function Vendors() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get('/vendors?limit=100').then(r => { setItems(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({ name: item.name, contactName: item.contactName || '', email: item.email || '', phone: item.phone || '', address: item.address || '', rating: item.rating || '', performanceNotes: item.performanceNotes || '' });
    setModal(item);
  }

  async function save() {
    if (modal === 'new') await api.post('/vendors', form);
    else await api.put(`/vendors/${modal._id}`, form);
    setModal(null); load();
  }

  async function remove(id) { if (!confirm('Delete?')) return; await api.del(`/vendors/${id}`); load(); }
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function renderStars(rating) {
    return '★'.repeat(Math.round(rating || 0)) + '☆'.repeat(5 - Math.round(rating || 0));
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>🤝 Suppliers</h1><div className="subtitle">Vendor management & performance</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Supplier</button>
      </div>
      <div className="card">
        {loading ? <div className="loading">Loading...</div> :
        items.length === 0 ? <div className="empty">No vendors yet.</div> :
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Rating</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(v => (
              <tr key={v._id}>
                <td><strong>{v.name}</strong></td>
                <td>{v.contactName || '—'}</td>
                <td>{v.email || '—'}</td>
                <td>{v.phone || '—'}</td>
                <td style={{ color: '#f59e0b' }}>{renderStars(v.rating)}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>Edit</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(v._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Vendor' : 'Edit Vendor'}</h2>
            <div className="form-group"><label>Company Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label>Contact Name</label><input value={form.contactName} onChange={e => set('contactName', e.target.value)} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div className="form-group"><label>Rating (0-5)</label><input type="number" min="0" max="5" step="0.5" value={form.rating} onChange={e => set('rating', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Address</label><input value={form.address} onChange={e => set('address', e.target.value)} /></div>
            <div className="form-group"><label>Performance Notes</label><textarea value={form.performanceNotes} onChange={e => set('performanceNotes', e.target.value)} /></div>
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
