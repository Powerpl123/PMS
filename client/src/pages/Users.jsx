import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const roles = ['admin', 'manager', 'technician', 'operator', 'viewer'];
const roleBadge = { admin: 'badge-red', manager: 'badge-yellow', technician: 'badge-blue', operator: 'badge-green', viewer: 'badge-gray' };
const roleEmoji = { admin: '🔓', manager: '✅', technician: '👷', operator: '👁️', viewer: '👁️' };
const roleColor = { admin: '#dc2626', manager: '#ea8c55', technician: '#0284c7', operator: '#16a34a', viewer: '#6b7280' };

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
  const [filterRole, setFilterRole] = useState(''); // Filter by role
  const [filterStatus, setFilterStatus] = useState(''); // Filter by status
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

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

  async function toggleUserStatus(u) {
    try {
      await api.profiles.update(u.id, { active: !u.active });
      showToast(`User ${!u.active ? 'activated' : 'deactivated'} successfully`);
      load();
    } catch (err) {
      showToast('Failed to update status: ' + err.message, 'error');
    }
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

  // Apply filters
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = !q || 
      u.fullName?.toLowerCase().includes(q) || 
      u.email?.toLowerCase().includes(q) || 
      u.role?.toLowerCase().includes(q) || 
      u.department?.toLowerCase().includes(q);
    const matchesRole = !filterRole || u.role === filterRole;
    const matchesStatus = !filterStatus || (filterStatus === 'active' ? u.active : !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Statistics
  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    byRole: roles.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {}),
  };

  return (
    <div className="page" style={{ 
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
      paddingBottom: '3rem'
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .professional-header {
          animation: slideIn 0.4s ease;
          background: linear-gradient(to right, #004E89 0%, #00365F 100%);
        }
        .stat-card {
          transition: all 0.2s ease;
          animation: fadeIn 0.5s ease forwards;
        }
        .stat-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          transform: translateY(-2px);
        }
        .user-row {
          transition: background-color 0.15s ease;
          border-bottom: 1px solid #e0e0e0;
        }
        .user-row:hover {
          background-color: #f9f9f9;
        }
        .user-card {
          transition: all 0.2s ease;
          animation: fadeIn 0.5s ease forwards;
          border: 1px solid #d0d0d0;
        }
        .user-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          transform: translateY(-2px);
        }
        .action-btn {
          transition: all 0.15s ease;
        }
        .action-btn:hover {
          opacity: 0.85;
        }
        .filter-input {
          border: 1px solid #d0d0d0;
          transition: all 0.2s ease;
        }
        .filter-input:focus {
          border-color: #004E89;
          box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1);
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            padding: '1rem 1.5rem',
            borderRadius: '4px',
            background: toast.type === 'error' ? '#D41E3A' : '#00FF00',
            color: '#fff',
            fontSize: '.9rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 200,
            animation: 'slideIn 0.3s ease',
            cursor: 'pointer',
          }}
          onClick={() => setToast(null)}
        >
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Professional Header */}
      <div className="professional-header" style={{
        color: 'white',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h1 style={{ fontSize: '2.2rem', margin: '0 0 0.5rem 0', fontWeight: 600, letterSpacing: '-0.5px' }}>User Management System</h1>
            <p style={{ fontSize: '0.95rem', margin: 0, opacity: 0.95 }}>
              Manage system users, roles, and access permissions
            </p>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.9 }}>
              {users.length} total users • {stats.active} active • {stats.byRole.admin + stats.byRole.manager} approvers
            </div>
          </div>
          <button 
            className="action-btn" 
            onClick={openNew} 
            style={{ 
              fontSize: '0.95rem', 
              padding: '0.75rem 1.75rem',
              background: 'white',
              color: '#004E89',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
            }}
          >
            + Add New User
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card" style={{ 
          padding: '1.5rem', 
          borderRadius: '4px',
          background: 'white',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Total Users</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 600, color: '#004E89', marginBottom: '0.5rem' }}>{stats.total}</div>
          <div style={{ fontSize: '0.8rem', color: '#9e9e9e' }}>System users registered</div>
        </div>

        <div className="stat-card" style={{ 
          padding: '1.5rem', 
          borderRadius: '4px',
          background: 'white',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Active Users</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 600, color: '#00796b', marginBottom: '0.5rem' }}>{stats.active}</div>
          <div style={{ fontSize: '0.8rem', color: '#9e9e9e' }}>Currently available</div>
        </div>

        <div className="stat-card" style={{ 
          padding: '1.5rem', 
          borderRadius: '4px',
          background: 'white',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Approvers</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 600, color: '#D41E3A', marginBottom: '0.5rem' }}>{stats.byRole.admin + stats.byRole.manager}</div>
          <div style={{ fontSize: '0.8rem', color: '#9e9e9e' }}>Admin & Managers</div>
        </div>

        <div className="stat-card" style={{ 
          padding: '1.5rem', 
          borderRadius: '4px',
          background: 'white',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Team Members</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 600, color: '#e65100', marginBottom: '0.5rem' }}>{stats.byRole.technician + stats.byRole.operator + stats.byRole.viewer}</div>
          <div style={{ fontSize: '0.8rem', color: '#9e9e9e' }}>Staff & Viewers</div>
        </div>
      </div>

      {/* Role Distribution */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'white', border: '1px solid #e0e0e0', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: 600, color: '#004E89', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Distribution by Role</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {roles.map((r, i) => {
            const roleNames = { admin: 'Administrator', manager: 'Manager', technician: 'Technician', operator: 'Operator', viewer: 'Viewer' };
            const roleColors = { admin: '#D41E3A', manager: '#FFA500', technician: '#004E89', operator: '#00FF00', viewer: '#999999' };
            return (
              <div key={r} style={{ 
                padding: '1.25rem',
                backgroundColor: '#fafafa',
                borderRadius: '4px',
                border: `1px solid #e0e0e0`,
                textAlign: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
                e.currentTarget.style.borderColor = roleColors[r];
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.borderColor = '#e0e0e0';
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#424242', textTransform: 'capitalize' }}>
                  {roleNames[r]}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 600, color: roleColors[r] }}>{stats.byRole[r] || 0}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: '#9e9e9e' }}>user{(stats.byRole[r] || 0) !== 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'white', border: '1px solid #e0e0e0', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end', gridAutoFlow: 'row' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#424242', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search</label>
            <input
              placeholder="Search by name, email, role, or department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="filter-input"
              style={{
                width: '100%',
                padding: '.75rem 1rem',
                borderRadius: '4px',
                fontSize: '.9rem',
                fontFamily: 'inherit',
                backgroundColor: '#fafafa',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#424242', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</label>
            <select 
              value={filterRole} 
              onChange={e => setFilterRole(e.target.value)}
              className="filter-input"
              style={{
                width: '100%',
                padding: '.75rem 1rem',
                borderRadius: '4px',
                fontSize: '.9rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                backgroundColor: '#fafafa',
                color: '#424242',
              }}
            >
              <option value="">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#424242', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="filter-input"
              style={{
                width: '100%',
                padding: '.75rem 1rem',
                borderRadius: '4px',
                fontSize: '.9rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                backgroundColor: '#fafafa',
                color: '#424242',
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', gridColumn: 'span 1' }}>
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: viewMode === 'table' ? '2px solid #004E89' : '1px solid #d0d0d0',
                borderRadius: '4px',
                backgroundColor: viewMode === 'table' ? '#004E89' : '#fafafa',
                color: viewMode === 'table' ? 'white' : '#424242',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
              onMouseEnter={e => { if(viewMode !== 'table') e.target.style.backgroundColor = '#f5f5f5'; }}
              onMouseLeave={e => { if(viewMode !== 'table') e.target.style.backgroundColor = '#fafafa'; }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              title="Card view"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: viewMode === 'card' ? '2px solid #004E89' : '1px solid #d0d0d0',
                borderRadius: '4px',
                backgroundColor: viewMode === 'card' ? '#004E89' : '#fafafa',
                color: viewMode === 'card' ? 'white' : '#424242',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
              onMouseEnter={e => { if(viewMode !== 'card') e.target.style.backgroundColor = '#f5f5f5'; }}
              onMouseLeave={e => { if(viewMode !== 'card') e.target.style.backgroundColor = '#fafafa'; }}
            >
              Cards
            </button>
          </div>
        </div>

        {(search || filterRole || filterStatus) && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.85rem', color: '#616161', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <span>Showing <strong style={{ color: '#004E89' }}>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''}</span>
            <button 
              onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); }}
              style={{ background: 'none', border: 'none', color: '#004E89', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Users List - Table View */}
      {viewMode === 'table' && (
        <div style={{ 
          background: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9e9e9e' }}>
              <p>Loading users...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9e9e9e' }}>
              <p>No users found</p>
              <button className="action-btn" onClick={openNew} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                Add New User
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
              }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approval</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => (
                    <tr 
                      key={u.id} 
                      className="user-row"
                      style={{ 
                        backgroundColor: idx % 2 === 0 ? '#fafafa' : 'white',
                        opacity: u.active ? 1 : 0.7,
                      }}
                    >
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#004E89' }}>{u.fullName}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#616161' }}>{u.email}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: u.role === 'admin' ? '#D41E3A44' : u.role === 'manager' ? '#FFA50044' : u.role === 'technician' ? '#004E8944' : u.role === 'operator' ? '#00FF0044' : '#99999944',
                          color: u.role === 'admin' ? '#D41E3A' : u.role === 'manager' ? '#FFA500' : u.role === 'technician' ? '#004E89' : u.role === 'operator' ? '#00FF00' : '#999999',
                        }}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {['admin', 'manager'].includes(u.role?.toLowerCase()) ? (
                          <span style={{ color: '#00796b', fontWeight: 600, fontSize: '0.85rem' }}>Yes</span>
                        ) : (
                          <span style={{ color: '#9e9e9e', fontWeight: 600, fontSize: '0.85rem' }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#616161', fontSize: '0.9rem' }}>{u.department || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#616161', fontSize: '0.9rem' }}>{u.phone || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: u.active ? '#00FF0033' : '#D41E3A33',
                          color: u.active ? '#00FF00' : '#D41E3A',
                        }}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            className="action-btn"
                            onClick={() => openEdit(u)}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.9rem',
                              background: '#1e3a5f',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => toggleUserStatus(u)}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.9rem',
                              background: u.active ? '#D41E3A' : '#00FF00',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            {u.active ? 'Lock' : 'Unlock'}
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => deleteUser(u)}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.9rem',
                              background: '#D41E3A',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users List - Card View */}
      {viewMode === 'card' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'white', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              <p style={{ color: '#9e9e9e' }}>Loading users...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'white', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              <p style={{ color: '#9e9e9e' }}>No users found matching your filters</p>
              <button className="action-btn" onClick={openNew} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                Add New User
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {filtered.map(u => {
                const roleNames = { admin: 'Administrator', manager: 'Manager', technician: 'Technician', operator: 'Operator', viewer: 'Viewer' };
                const roleColors = { admin: '#D41E3A', manager: '#FFA500', technician: '#004E89', operator: '#00FF00', viewer: '#999999' };
                return (
                  <div key={u.id} className="user-card" style={{
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    background: 'white',
                    border: '1px solid #e0e0e0',
                    borderLeft: `4px solid ${roleColors[u.role]}`,
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: u.active ? 1 : 0.7,
                  }}>
                    {/* Card Header */}
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 600, color: '#004E89' }}>{u.fullName}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#616161' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '4px',
                            backgroundColor: `${roleColors[u.role]}22`,
                            color: roleColors[u.role],
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}>
                            {roleNames[u.role]}
                          </span>
                        </p>
                      </div>
                      <span style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '4px',
                        background: u.active ? '#00FF0033' : '#D41E3A33',
                        color: u.active ? '#00FF00' : '#D41E3A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}>
                        {u.active ? '●' : '◯'}
                      </span>
                    </div>

                    {/* Card Details */}
                    <div style={{ padding: '1.25rem', flex: 1 }}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                        <div style={{ fontSize: '0.9rem', color: '#424242', wordBreak: 'break-all' }}>{u.email}</div>
                      </div>
                      {u.department && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</div>
                          <div style={{ fontSize: '0.9rem', color: '#424242' }}>{u.department}</div>
                        </div>
                      )}
                      {u.phone && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
                          <div style={{ fontSize: '0.9rem', color: '#424242' }}>{u.phone}</div>
                        </div>
                      )}
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${roleColors[u.role]}11`, borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, color: roleColors[u.role] }}>
                        {['admin', 'manager'].includes(u.role?.toLowerCase()) ? 'Can approve requests' : 'Cannot approve requests'}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div style={{ padding: '1.25rem', borderTop: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        className="action-btn"
                        onClick={() => openEdit(u)}
                        style={{
                          padding: '0.6rem 1rem',
                          background: '#1e3a5f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.85rem',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => toggleUserStatus(u)}
                        style={{
                          padding: '0.6rem 1rem',
                          background: u.active ? '#D41E3A' : '#00FF00',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.85rem',
                        }}
                      >
                        {u.active ? 'Lock' : 'Unlock'}
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => deleteUser(u)}
                        style={{
                          padding: '0.6rem 1rem',
                          background: '#c62828',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.85rem',
                          gridColumn: '1 / -1',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit User Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)} style={{ backdropFilter: 'blur(2px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#004E89' }}>
                {modal === 'new' ? 'Add New User' : 'Edit User'}
              </h2>
              {modal !== 'new' && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ID: {modal.id?.substring(0, 8)}
                </span>
              )}
            </div>

            {/* Form Sections */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name *</label>
                  <input
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    placeholder="John Smith"
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="user@company.com"
                    disabled={modal !== 'new'}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit', opacity: modal !== 'new' ? 0.6 : 1 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {modal === 'new' ? 'Password *' : 'New Password (leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={modal === 'new' ? 'Min 6 characters' : 'Leave blank'}
                  minLength={6}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</label>
                  <select
                    value={form.role}
                    onChange={e => set('role', e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit', cursor: 'pointer', backgroundColor: 'white' }}
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.8rem', color: '#616161', lineHeight: '1.4' }}>
                    {form.role === 'admin' && 'Full system access and user management rights.'}
                    {form.role === 'manager' && 'Can approve work requests and manage assignments.'}
                    {form.role === 'technician' && 'Can view and update assigned work requests.'}
                    {form.role === 'operator' && 'Can view work requests and work orders.'}
                    {form.role === 'viewer' && 'Read-only access to reports and dashboards.'}
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</label>
                  <input
                    value={form.department}
                    onChange={e => set('department', e.target.value)}
                    placeholder="e.g. Electrical"
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+966 5xx xxx xxx"
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: '#424242', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                  <select
                    value={form.active ? 'active' : 'inactive'}
                    onChange={e => set('active', e.target.value === 'active')}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'inherit', cursor: 'pointer', backgroundColor: 'white' }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', padding: '1.5rem', borderTop: '1px solid #e0e0e0', backgroundColor: '#f5f5f5' }}>
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f5f5f5',
                  color: '#424242',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#1e3a5f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  opacity: saving || !form.title || !form.assetId ? 0.6 : 1,
                }}
                onClick={saveUser}
                disabled={saving}
              >
                {saving ? 'Saving...' : (modal === 'new' ? 'Add User' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
