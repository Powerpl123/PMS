import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const roles = ['admin', 'manager', 'technician', 'operator', 'viewer'];
const roleColor = { admin: '#ef4444', manager: '#f59e0b', technician: '#3b82f6', operator: '#22c55e', viewer: '#6b7280' };
const roleLabel = { admin: 'Admin', manager: 'Manager', technician: 'Technician', operator: 'Operator', viewer: 'Viewer' };
const emptyUser = { fullName: '', email: '', password: '', role: 'technician', department: '', phone: '', active: true };

export default function Users() {
  const { user: authUser, profile: authProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewItem, setViewItem] = useState(null);

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
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function openNew() { setForm(emptyUser); setModal('new'); }
  function openEdit(u) {
    setForm({
      fullName: u.fullName || '', email: u.email || '', password: '',
      role: u.role || 'technician', department: u.department || '',
      phone: u.phone || '', active: u.active ?? true,
    });
    setModal(u);
  }

  async function toggleUserStatus(u) {
    try {
      await api.profiles.update(u.id, { active: !u.active });
      showToast(`User ${!u.active ? 'activated' : 'deactivated'}`);
      load();
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  }

  async function saveUser() {
    if (!form.fullName || !form.email) { showToast('Name and email required', 'error'); return; }
    if (modal === 'new' && (!form.password || form.password.length < 6)) { showToast('Password required (min 6 chars)', 'error'); return; }
    setSaving(true);
    try {
      if (modal === 'new') {
        const existing = await api.profiles.getByEmail(form.email);
        if (existing) { showToast('Email already exists', 'error'); setSaving(false); return; }
        await api.profiles.createWithAuth({
          fullName: form.fullName, email: form.email, password: form.password,
          role: form.role, department: form.department, phone: form.phone, active: form.active,
        });
        showToast('User created');
      } else {
        await api.profiles.update(modal.id, { fullName: form.fullName, role: form.role, department: form.department, phone: form.phone, active: form.active });
        if (form.password && form.password.length >= 6) {
          await api.profiles.updatePassword(form.password);
          showToast('User & password updated');
        } else { showToast('User updated'); }
      }
      setModal(null); await load();
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteUser(u) {
    if (u.id === authUser?.id) { showToast('Cannot delete own account', 'error'); return; }
    if (!confirm(`Delete "${u.fullName}"?`)) return;
    try { await api.profiles.remove(u.id); showToast('User deleted'); load(); }
    catch (err) { showToast('Failed: ' + err.message, 'error'); }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || (filterStatus === 'active' ? u.active : !u.active);
    return matchSearch && matchRole && matchStatus;
  });

  const totalActive = users.filter(u => u.active).length;
  const totalApprovers = users.filter(u => ['admin', 'manager'].includes(u.role)).length;
  const isAdmin = authProfile?.role?.toLowerCase() === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>User Management</h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {users.length} users &middot; {totalActive} active &middot; {totalApprovers} approvers
          </span>
        </div>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={openNew}>+ Add User</button>}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
        {roles.map(r => {
          const count = users.filter(u => u.role === r).length;
          const c = roleColor[r];
          return (
            <div key={r} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.6rem', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: '6px',
              borderLeft: `3px solid ${c}`,
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{roleLabel[r]}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, department..."
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem' }} />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ width: '100px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ width: '90px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{filtered.length}</span>
      </div>

      {/* Table */}
      {loading ? <div className="loading">Loading...</div> :
       filtered.length === 0 ? <div className="empty">No users found.</div> : (
        <div style={{ flex: 1, overflow: 'auto', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: isAdmin ? '20%' : '22%' }} />
              <col style={{ width: isAdmin ? '22%' : '25%' }} />
              <col style={{ width: isAdmin ? '10%' : '12%' }} />
              <col style={{ width: isAdmin ? '13%' : '15%' }} />
              <col style={{ width: isAdmin ? '12%' : '14%' }} />
              <col style={{ width: isAdmin ? '8%' : '12%' }} />
              {isAdmin && <col style={{ width: '15%' }} />}
            </colgroup>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Department', 'Phone', 'Status', ...(isAdmin ? ['Actions'] : [])].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const bg = i % 2 === 0 ? '#111d2b' : '#0e1722';
                const c = roleColor[u.role] || '#6b7280';
                return (
                  <tr key={u.id} className="usr-row" style={{ cursor: 'pointer', opacity: u.active ? 1 : 0.55 }}
                    onClick={() => setViewItem(u)}>
                    <td style={{ ...td, background: bg, fontWeight: 600, color: '#e2e8f0' }}>{u.fullName}</td>
                    <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.72rem' }}>{u.email}</td>
                    <td style={{ ...td, background: bg }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, padding: '0.12rem 0.35rem', borderRadius: '3px',
                        background: c + '18', color: c, border: `1px solid ${c}30`, textTransform: 'uppercase',
                      }}>{roleLabel[u.role]}</span>
                    </td>
                    <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.72rem' }}>{u.department || '—'}</td>
                    <td style={{ ...td, background: bg, color: '#8899aa', fontSize: '0.72rem' }}>{u.phone || '—'}</td>
                    <td style={{ ...td, background: bg }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                        fontSize: '0.63rem', fontWeight: 600, color: u.active ? '#22c55e' : '#ef4444',
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.active ? '#22c55e' : '#ef4444', boxShadow: `0 0 5px ${u.active ? '#22c55e' : '#ef4444'}80` }} />
                        {u.active ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    {isAdmin && (
                    <td style={{ ...td, background: bg, textAlign: 'center', padding: '0.3rem 0.15rem' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                        <button onClick={() => openEdit(u)} title="Edit" style={aBtn}>&#9998;</button>
                        <button onClick={() => toggleUserStatus(u)} title={u.active ? 'Lock' : 'Unlock'}
                          style={{ ...aBtn, color: u.active ? '#f59e0b' : '#22c55e', borderColor: u.active ? '#f59e0b30' : '#22c55e30' }}>
                          {u.active ? '🔒' : '🔓'}
                        </button>
                        <button onClick={() => deleteUser(u)} title="Delete"
                          style={{ ...aBtn, color: '#f87171', borderColor: '#f8717130' }}>&#128465;</button>
                      </div>
                    </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`.usr-row:hover td { background: #1a2d42 !important; }`}</style>

      {/* Detail View */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>User Details</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</button>}
                <button className="btn btn-secondary btn-sm" onClick={() => setViewItem(null)}>Close</button>
              </div>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <DRow label="Full Name" value={viewItem.fullName} bold />
              <DRow label="Email" value={viewItem.email} />
              <DRow label="Role" value={roleLabel[viewItem.role]} badgeColor={roleColor[viewItem.role]} />
              <DRow label="Status" value={viewItem.active ? 'Active' : 'Inactive'} badgeColor={viewItem.active ? '#22c55e' : '#ef4444'} />
              <DRow label="Department" value={viewItem.department} />
              <DRow label="Phone" value={viewItem.phone} />
              <DRow label="Approval Rights" value={['admin', 'manager'].includes(viewItem.role) ? 'Can approve requests' : 'No approval rights'} full />
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h2>{modal === 'new' ? 'Add New User' : 'Edit User'}</h2>
            <div className="form-row">
              <div className="form-group"><label>Full Name *</label><input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="John Smith" /></div>
              <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@company.com" disabled={modal !== 'new'} style={{ opacity: modal !== 'new' ? 0.5 : 1 }} /></div>
            </div>
            <div className="form-group">
              <label>{modal === 'new' ? 'Password *' : 'New Password (optional)'}</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={modal === 'new' ? 'Min 6 characters' : 'Leave blank to keep current'} autoComplete="new-password" />
            </div>
            <div className="form-row">
              <div className="form-group"><label>Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}>
                  {roles.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                </select>
                <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--bg)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {form.role === 'admin' && 'Full system access & user management.'}
                  {form.role === 'manager' && 'Can approve requests & manage assignments.'}
                  {form.role === 'technician' && 'Can view & update assigned work.'}
                  {form.role === 'operator' && 'Can view work requests & orders.'}
                  {form.role === 'viewer' && 'Read-only access.'}
                </div>
              </div>
              <div className="form-group"><label>Department</label><input value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Electrical" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+966 5xx xxx xxx" /></div>
              <div className="form-group"><label>Status</label>
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

      {/* Toast */}
      {toast && (
        <div onClick={() => setToast(null)} style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', padding: '0.65rem 1rem',
          borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, zIndex: 200, cursor: 'pointer',
          background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: toast.type === 'error' ? '#ef4444' : '#22c55e',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          backdropFilter: 'blur(10px)',
        }}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '0.5rem 0.35rem', fontSize: '0.6rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px', color: '#FFD700',
  background: '#142a42', borderBottom: '2px solid #2E86C1',
  borderRight: '1px solid #1e3d5a', whiteSpace: 'nowrap', textAlign: 'left',
  position: 'sticky', top: 0, zIndex: 2,
};

const td = {
  padding: '0.45rem 0.35rem', fontSize: '0.75rem',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  borderRight: '1px solid #1a2f45', borderBottom: '1px solid #162538', color: '#8899aa',
};

const aBtn = {
  width: '22px', height: '22px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #2a4060', borderRadius: '3px',
  background: 'transparent', color: '#5DADE2',
  cursor: 'pointer', fontSize: '0.7rem', padding: 0,
};

function DRow({ label, value, bold, badgeColor, full }) {
  const display = value || '—';
  return (
    <div style={{ padding: '0.5rem 0.4rem', borderBottom: '1px solid var(--border)', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{label}</div>
      {badgeColor && value ? (
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, padding: '0.12rem 0.4rem', borderRadius: '3px',
          background: badgeColor + '18', color: badgeColor, border: `1px solid ${badgeColor}30`,
        }}>{display}</span>
      ) : (
        <div style={{
          fontSize: '0.85rem', color: value ? 'var(--text)' : 'var(--text-light)',
          fontWeight: bold ? 700 : 400,
        }}>{display}</div>
      )}
    </div>
  );
}
