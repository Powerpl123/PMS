import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';

const ROLES = ['admin', 'manager', 'engineer', 'technician', 'viewer'];
const DEPARTMENTS = ['Operations', 'Maintenance', 'Electrical', 'Instrumentation', 'Safety', 'Management', 'IT', 'Other'];

const roleBadge = { admin: 'badge-red', manager: 'badge-orange', engineer: 'badge-blue', technician: 'badge-yellow', viewer: 'badge-gray' };
const empty = { name: '', email: '', password: '', role: 'viewer', department: '', phone: '' };

export default function UserManagement() {
  const { authFetch, user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | user obj
  const [form, setForm] = useState(empty);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const load = () => authFetch('/api/auth/users?limit=100')
    .then(r => { setUsers(r.data); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(u) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '', phone: u.phone || '' });
    setModal(u);
  }

  async function save() {
    try {
      if (modal === 'new') {
        if (!form.password) return alert('Password is required for new users');
        await authFetch('/api/auth/users', { method: 'POST', body: JSON.stringify(form) });
      } else {
        const { password, email, ...update } = form;
        await authFetch(`/api/auth/users/${modal._id}`, { method: 'PUT', body: JSON.stringify(update) });
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (id === currentUser._id) return alert('Cannot delete your own account');
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await authFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
    load();
  }

  async function toggleActive(u) {
    if (u._id === currentUser._id) return alert('Cannot deactivate your own account');
    await authFetch(`/api/auth/users/${u._id}`, { method: 'PUT', body: JSON.stringify({ isActive: !u.isActive }) });
    load();
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) return alert('Password must be at least 6 characters');
    try {
      await authFetch(`/api/auth/users/${resetModal._id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: newPassword }) });
      setResetModal(null);
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err) { alert(err.message); }
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function fmtDate(d) { return d ? new Date(d).toLocaleString() : 'Never'; }

  return (
    <div>
      <div className="page-header">
        <div><h1>👥 User Management</h1><div className="subtitle">Manage system users, roles & access</div></div>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}>+ Add User</button>}
      </div>

      <div className="card">
        {loading ? <div className="loading">Loading users...</div> :
        users.length === 0 ? <div className="empty">No users found.</div> :
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th>{isAdmin && <th>Actions</th>}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                <td>
                  <strong>{u.name}</strong>
                  {u._id === currentUser._id && <span className="badge badge-blue" style={{ marginLeft: '.5rem', fontSize: '.6rem' }}>YOU</span>}
                </td>
                <td>{u.email}</td>
                <td><span className={`badge ${roleBadge[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                <td>{u.department || '—'}</td>
                <td>
                  {isAdmin ? (
                    <button
                      className={`btn btn-sm ${u.isActive ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={() => toggleActive(u)}
                      title={u.isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {u.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  ) : (
                    <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                  )}
                </td>
                <td style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{fmtDate(u.lastLogin)}</td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>{' '}
                    <button className="btn btn-secondary btn-sm" onClick={() => { setResetModal(u); setNewPassword(''); }}>🔑</button>{' '}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(u._id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? '👤 Add New User' : '✏️ Edit User'}</h2>
            <div className="form-row">
              <div className="form-group"><label>Full Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={modal !== 'new'} /></div>
            </div>
            {modal === 'new' && (
              <div className="form-group"><label>Password *</label><input type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder="Min 6 characters" /></div>
            )}
            <div className="form-row">
              <div className="form-group"><label>Role *</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Department</label>
                <select value={form.department} onChange={e => set('department', e.target.value)}>
                  <option value="">Select...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{modal === 'new' ? 'Create User' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>🔑 Reset Password</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '.9rem' }}>
              Set a new password for <strong>{resetModal.name}</strong>
            </p>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} placeholder="Min 6 characters" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResetModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
