import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const roles = ['admin', 'manager', 'technician', 'operator', 'viewer'];
const roleBadge = { admin: 'badge-red', manager: 'badge-yellow', technician: 'badge-blue', operator: 'badge-green', viewer: 'badge-gray' };

const emptyUser = { fullName: '', email: '', password: '', role: 'technician', department: '', phone: '', active: true };

export default function Users() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | user object
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    try {
      const res = await api.profiles.list();
      setUsers(res.data);
    } catch (err) {
      showToast('Failed to load users: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

  function openNew() {
    setForm(emptyUser);
    setModal('new');
  }

  function openEdit(u) {
    setForm({
      fullName: u.fullName || '',
      email: u.email || '',
      password: '',
      role: u.role || 'technician',
      department: u.department || '',
      phone: u.phone || '',
      active: u.active ?? true,
    });
    setModal(u);
  }

  async function saveUser() {
    if (!form.fullName || !form.email) {
      showToast('Name and email are required', 'error');
      return;
    }
    if (modal === 'new' && (!form.password || form.password.length < 6)) {
      showToast('Password is required (min 6 characters)', 'error');
      return;
    }
    setSaving(true);
    try {
      if (modal === 'new') {
        const existing = await api.profiles.getByEmail(form.email);
        if (existing) {
          showToast('A user with this email already exists', 'error');
          setSaving(false);
          return;
        }
        // Create auth account + profile
        await api.profiles.createWithAuth({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          department: form.department,
          phone: form.phone,
          active: form.active,
        });
        showToast('User added successfully');
      } else {
        const updates = { fullName: form.fullName, role: form.role, department: form.department, phone: form.phone, active: form.active };
        await api.profiles.update(modal.id, updates);
        // If password was changed, update it
        if (form.password && form.password.length >= 6) {
          await api.profiles.updatePassword(form.password);
          showToast('User and password updated successfully');
        } else {
          showToast('User updated successfully');
        }
      }
      setModal(null);
      await load();
    } catch (err) {
      showToast('Failed to save user: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u) {
    if (u.id === authUser?.id) {
      showToast('Cannot delete your own account', 'error');
      return;
    }
    if (!confirm(`Delete user "${u.fullName}"?`)) return;
    try {
      await api.profiles.remove(u.id);
      showToast('User deleted');
      load();
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
  });

  return (
    <div className="page">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>👥 User Management</h1>
          <div className="subtitle">
            Manage system users and their roles &nbsp;·&nbsp; {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add User</button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{
            position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none',
          }}>🔍</span>
          <input
            placeholder="Search by name, email, role or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '.75rem 2.5rem .75rem 2.8rem',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '.92rem',
              fontFamily: 'inherit',
              background: 'var(--bg)',
              color: 'var(--text)',
              transition: 'border-color .2s, box-shadow .2s',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,.12)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                background: 'var(--border)', border: 'none', borderRadius: '50%',
                width: '22px', height: '22px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.7rem', color: 'var(--text-muted)', lineHeight: 1,
              }}
              title="Clear search"
            >✕</button>
          )}
        </div>
        {search && (
          <div style={{ marginTop: '.5rem', fontSize: '.8rem', color: 'var(--text-muted)', paddingLeft: '.25rem' }}>
            Found <strong style={{ color: 'var(--primary)' }}>{filtered.length}</strong> user{filtered.length !== 1 ? 's' : ''} matching "<em>{search}</em>"
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading users...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No users found</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.fullName}</strong></td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${roleBadge[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                    <td>{u.department || '—'}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New/Edit User Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? '➕ Add New User' : '✏️ Edit User'}</h2>

            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="John Smith" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.com" disabled={modal !== 'new'} />
              </div>
            </div>

            <div className="form-group">
              <label>{modal === 'new' ? 'Password *' : 'New Password (leave blank to keep current)'}</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={modal === 'new' ? 'Min 6 characters' : 'Leave blank to keep current password'}
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}>
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Mechanical, Electrical" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+966 5xx xxx xxx" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Saving...' : modal === 'new' ? 'Add User' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
