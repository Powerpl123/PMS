import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
  generatePermitNumber,
  printWorkPermit,
} from '../utils/workPermit';
import PhotoAttachments from '../components/PhotoAttachments';

const emptyRequest = {
  title: '', description: '', assetId: '', kksCode: '', requestedBy: '',
  assignedToName: '', department: '', workType: 'corrective', priority: 'medium',
  status: 'pending', location: '', scheduledDate: '', notes: '',
};

const emptyPermit = {
  issuedBy: '', issuedTo: '', workDescription: '', location: '',
  startDate: '', endDate: '', safetyPrecautions: '', ppeRequired: [],
  hazards: '', approvedBy: '',
};

const priorityColors = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };
const statusColors = { pending: '#f59e0b', approved: '#22c55e', 'in-progress': '#3b82f6', completed: '#10b981', rejected: '#ef4444', cancelled: '#6b7280' };
const statusLabel = { pending: 'Pending', approved: 'Approved', 'in-progress': 'In Progress', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' };
const typeColors = { corrective: '#ef4444', preventive: '#3b82f6', inspection: '#a855f7', emergency: '#f97316' };

const PPE_OPTIONS = ['Hard Hat', 'Safety Glasses', 'Steel-toe Boots', 'Gloves', 'Ear Protection', 'High-vis Vest', 'Face Shield', 'Respiratory Mask', 'Fall Harness', 'Fire-resistant Clothing'];

export default function WorkRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [permits, setPermits] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [permitModal, setPermitModal] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [form, setForm] = useState(emptyRequest);
  const [permitForm, setPermitForm] = useState(emptyPermit);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('requests');
  const [toast, setToast] = useState(null);
  const [attachmentCounts] = useState({});
  const [viewItem, setViewItem] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const load = () =>
    Promise.all([
      api.workRequests.list(100).catch(() => ({ data: [] })),
      api.workPermits.list(100).catch(() => ({ data: [] })),
      api.profiles.list(200).catch(() => ({ data: [] })),
    ]).then(([wr, wp, u]) => {
      setItems(wr.data);
      setPermits(wp.data);
      setUsersList(u.data.filter(p => p.active));
      setLoading(false);
    });

  const loadAssets = () => {
    if (assetsLoaded) return;
    api.assets.listAll().catch(() => ({ data: [] }))
      .then(a => { setAssets(a.data); setAssetsLoaded(true); });
  };

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...emptyRequest, requestedBy: user?.user_metadata?.full_name || user?.email || '' });
    loadAssets();
    setModal('new');
  }

  function openEdit(item) {
    setForm({
      title: item.title, description: item.description || '',
      assetId: item.assetId?.id || item.assetId || '', kksCode: item.kksCode || '',
      requestedBy: item.requestedBy || '', assignedToName: item.assignedToName || '',
      department: item.department || '', workType: item.workType || 'corrective',
      priority: item.priority, status: item.status, location: item.location || '',
      scheduledDate: item.scheduledDate ? item.scheduledDate.slice(0, 10) : '',
      notes: item.notes || '',
    });
    loadAssets();
    setModal(item);
  }

  async function saveRequest() {
    setSending(true);
    try {
      const body = { ...form };
      if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate).toISOString();
      const isNew = modal === 'new';
      if (isNew) await api.workRequests.create(body);
      else await api.workRequests.update(modal.id, body);

      if (body.assignedToName && isNew) {
        const assignedUser = usersList.find(u => u.fullName === body.assignedToName);
        if (assignedUser) {
          try { await api.notifications.create({ userId: assignedUser.id, title: 'New Work Request Assigned', message: `"${body.title}" has been assigned to you — Priority: ${body.priority}`, type: 'assignment', link: '/work-requests' }); } catch {}
        }
      }
      if (isNew) {
        const managers = usersList.filter(u => u.role && ['manager', 'admin'].includes(u.role.toLowerCase()));
        for (const manager of managers) {
          try { await api.notifications.create({ userId: manager.id, title: 'New Work Request Pending Approval', message: `"${body.title}" (${body.priority.toUpperCase()}) from ${body.requestedBy} is waiting for your approval.`, type: 'approval', link: '/work-requests' }); } catch {}
        }
        showToast('Work request created. Approval notifications sent.');
      } else {
        showToast('Work request updated.');
      }
      setModal(null);
      await load();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { setSending(false); }
  }

  async function removeRequest(id) {
    if (!confirm('Delete this work request?')) return;
    await api.workRequests.remove(id);
    load();
  }

  async function approveToWorkOrder(request) {
    if (!user?.profile?.role || !['manager', 'admin'].includes(user.profile.role.toLowerCase())) {
      showToast('Only managers and admins can approve', 'error');
      return;
    }
    if (!confirm(`Approve "${request.title}" and create a Work Order?`)) return;
    setSending(true);
    try {
      await api.workOrders.create({
        title: request.title, description: request.description || '',
        assetId: request.assetId?.id || request.assetId || '',
        assignedTo: request.assignedToName || '', priority: request.priority,
        status: 'open', dueDate: request.scheduledDate || '', estimatedCost: '',
      });
      await api.workRequests.update(request.id, {
        status: 'approved',
        approvedBy: user?.user_metadata?.full_name || user?.email || 'Unknown',
        approvedAt: new Date().toISOString(),
      });
      if (request.assignedToName) {
        const assignedUser = usersList.find(u => u.fullName === request.assignedToName);
        if (assignedUser) {
          try { await api.notifications.create({ userId: assignedUser.id, title: 'Work Order Created', message: `Work order "${request.title}" has been created and assigned to you`, type: 'approval', link: '/work-orders' }); } catch {}
        }
      }
      await load();
      showToast('Work order created from request');
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { setSending(false); }
  }

  function openPhotoModal(request) { setPhotoModal(request); }
  function closePhotoModal() { setPhotoModal(null); }

  function openPermitModal(request) {
    const existing = permits.find(p => p.workRequestId === request.id);
    if (existing) { printWorkPermit(existing, request); return; }
    setPermitForm({
      ...emptyPermit,
      issuedTo: request.assignedToName || '',
      issuedBy: user?.user_metadata?.full_name || user?.email || '',
      workDescription: request.description || '',
      location: request.location || '',
      approvedBy: user?.user_metadata?.full_name || user?.email || '',
    });
    setPermitModal(request);
  }

  async function savePermit() {
    setSending(true);
    try {
      const permitNumber = generatePermitNumber();
      const body = { ...permitForm, workRequestId: permitModal.id, permitNumber, status: 'issued' };
      if (body.startDate) body.startDate = new Date(body.startDate).toISOString();
      if (body.endDate) body.endDate = new Date(body.endDate).toISOString();
      const savedPermit = await api.workPermits.create(body);
      await api.workRequests.update(permitModal.id, { status: 'approved' });
      const reqForPrint = permitModal;
      setPermitModal(null);
      await load();
      showToast(`Work permit ${permitNumber} generated`);
      printWorkPermit({ ...permitForm, ...savedPermit, permitNumber }, reqForPrint);
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { setSending(false); }
  }

  function handlePpeToggle(item) {
    setPermitForm(prev => ({
      ...prev,
      ppeRequired: prev.ppeRequired.includes(item)
        ? prev.ppeRequired.filter(i => i !== item)
        : [...prev.ppeRequired, item],
    }));
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setP = (k, v) => setPermitForm(prev => ({ ...prev, [k]: v }));

  const requestPermitMap = {};
  permits.forEach(p => { requestPermitMap[p.workRequestId] = p; });

  const isManager = user?.profile?.role && ['manager', 'admin'].includes(user.profile.role.toLowerCase());
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const inProgressCount = items.filter(i => i.status === 'in-progress').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Work Requests</h1>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Create, track and approve maintenance requests</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${tab === 'requests' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('requests')}>
            Requests ({items.length})
          </button>
          <button className={`btn ${tab === 'permits' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('permits')}>
            Permits ({permits.length})
          </button>
          {tab === 'requests' && (
            <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Request</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
        <StatCard label="Total" value={items.length} color="#FFB81C" />
        <StatCard label="Pending" value={pendingCount} color="#f59e0b" />
        <StatCard label="Approved" value={approvedCount} color="#22c55e" />
        <StatCard label="Completed" value={completedCount} color="#10b981" />
      </div>

      {/* Requests Tab */}
      {tab === 'requests' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> :
           items.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No work requests yet. Create your first request to get started.</div> : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '17%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Title', 'KKS Code', 'Type', 'Priority', 'Status', 'Assigned To', 'Photos', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setViewItem(w)}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>{w.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>by {w.requestedBy || '—'}</div>
                    </td>
                    <td style={tdStyle}>
                      {w.kksCode || w.assetId?.kksCode ? (
                        <code style={kksStyle}>{w.kksCode || w.assetId?.kksCode}</code>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>
                      <Badge color={typeColors[w.workType]}>{w.workType}</Badge>
                    </td>
                    <td style={tdStyle}>
                      <Badge color={priorityColors[w.priority]}>{w.priority}</Badge>
                    </td>
                    <td style={tdStyle}>
                      <Badge color={statusColors[w.status]}>{statusLabel[w.status]}</Badge>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{w.assignedToName || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openPhotoModal(w)} style={photoBtnStyle}>
                        {attachmentCounts[w.id] ? `${attachmentCounts[w.id]}` : '+'}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => openEdit(w)} title="Edit" style={iconBtn}>&#9998;</button>
                        {w.status === 'pending' && isManager && (
                          <button onClick={() => approveToWorkOrder(w)} title="Approve" disabled={sending} style={iconBtnSuccess}>&#10003;</button>
                        )}
                        {w.status === 'approved' && (
                          <button onClick={() => openPermitModal(w)} title="Permit" style={iconBtnInfo}>&#9993;</button>
                        )}
                        <button onClick={() => removeRequest(w.id)} title="Delete" style={iconBtnDanger}>&#128465;</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Permits Tab */}
      {tab === 'permits' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> :
           permits.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No permits issued yet.</div> : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Permit #', 'Work Request', 'Issued To', 'Location', 'Status', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permits.map(p => {
                  const req = items.find(r => r.id === p.workRequestId);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}><code style={kksStyle}>{p.permitNumber}</code></td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{p.workRequestTitle || req?.title || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{p.issuedTo || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{p.location || '—'}</td>
                      <td style={tdStyle}>
                        <Badge color={p.status === 'issued' ? '#3b82f6' : p.status === 'active' ? '#22c55e' : '#ef4444'}>{p.status}</Badge>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button onClick={() => printWorkPermit(p, req)} title="Print" style={iconBtnInfo}>&#128424;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Detail View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Request Details</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</button>
                {viewItem.status === 'pending' && isManager && (
                  <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }} onClick={() => { setViewItem(null); approveToWorkOrder(viewItem); }}>Approve</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setViewItem(null)}>Close</button>
              </div>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <DRow label="Title" value={viewItem.title} bold full />
              <DRow label="KKS Code" value={viewItem.kksCode || viewItem.assetId?.kksCode} mono />
              <DRow label="Asset" value={viewItem.assetId?.name} />
              <DRow label="Work Type" value={viewItem.workType} badgeColor={typeColors[viewItem.workType]} />
              <DRow label="Priority" value={viewItem.priority} badgeColor={priorityColors[viewItem.priority]} />
              <DRow label="Status" value={statusLabel[viewItem.status]} badgeColor={statusColors[viewItem.status]} />
              <DRow label="Assigned To" value={viewItem.assignedToName} />
              <DRow label="Requested By" value={viewItem.requestedBy} />
              <DRow label="Department" value={viewItem.department} />
              <DRow label="Location" value={viewItem.location} />
              <DRow label="Scheduled Date" value={viewItem.scheduledDate ? new Date(viewItem.scheduledDate).toLocaleDateString() : null} />
              <DRow label="Description" value={viewItem.description} full />
              <DRow label="Notes" value={viewItem.notes} full />
            </div>
          </div>
        </div>
      )}

      {/* Work Request Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>{modal === 'new' ? 'New Work Request' : 'Edit Work Request'}</h2>
            <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label>Work Type *</label>
                <select value={form.workType} onChange={e => set('workType', e.target.value)}>
                  <option value="corrective">Corrective</option><option value="preventive">Preventive</option>
                  <option value="inspection">Inspection</option><option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="form-group"><label>Asset *</label>
                <select value={form.assetId} onChange={e => {
                  const id = e.target.value; set('assetId', id);
                  const sel = assets.find(a => a.id === id);
                  if (sel?.kksCode) set('kksCode', sel.kksCode);
                }}>
                  <option value="">Select asset...</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.kksCode ? ` [${a.kksCode}]` : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>KKS Code</label><input value={form.kksCode} onChange={e => set('kksCode', e.target.value)} placeholder="Auto-filled from asset" /></div>
            <div className="form-group"><label>Assign To</label>
              <select value={form.assignedToName} onChange={e => set('assignedToName', e.target.value)}>
                <option value="">Select user...</option>
                {usersList.map(u => <option key={u.id} value={u.fullName}>{u.fullName}{u.department ? ` — ${u.department}` : ''} ({u.role})</option>)}
              </select>
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
                  <option value="pending">Pending</option><option value="approved">Approved</option>
                  <option value="in-progress">In Progress</option><option value="completed">Completed</option>
                  <option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} /></div>
              <div className="form-group"><label>Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Requested By</label><input value={form.requestedBy} onChange={e => set('requestedBy', e.target.value)} /></div>
              <div className="form-group"><label>Department</label><input value={form.department} onChange={e => set('department', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} /></div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {modal !== 'new' && modal?.id && (
                  <button className="btn btn-secondary" onClick={() => openPhotoModal(modal)}>Photos {attachmentCounts[modal.id] ? `(${attachmentCounts[modal.id]})` : ''}</button>
                )}
                <button className="btn btn-primary" onClick={saveRequest} disabled={sending || !form.title || !form.assetId}>
                  {sending ? 'Saving...' : 'Save & Notify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permit Modal */}
      {permitModal && (
        <div className="modal-overlay" onClick={() => setPermitModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Generate Work Permit</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>For: <strong style={{ color: 'var(--text)' }}>{permitModal.title}</strong></p>
            <div className="form-row">
              <div className="form-group"><label>Issued To</label><input value={permitForm.issuedTo} onChange={e => setP('issuedTo', e.target.value)} /></div>
              <div className="form-group"><label>Issued By</label><input value={permitForm.issuedBy} onChange={e => setP('issuedBy', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Start Date</label><input type="date" value={permitForm.startDate} onChange={e => setP('startDate', e.target.value)} /></div>
              <div className="form-group"><label>End Date</label><input type="date" value={permitForm.endDate} onChange={e => setP('endDate', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Location</label><input value={permitForm.location} onChange={e => setP('location', e.target.value)} /></div>
            <div className="form-group"><label>Work Description</label><textarea value={permitForm.workDescription} onChange={e => setP('workDescription', e.target.value)} /></div>
            <div className="form-group"><label>Hazards</label><textarea value={permitForm.hazards} onChange={e => setP('hazards', e.target.value)} rows={2} placeholder="Describe potential hazards..." /></div>
            <div className="form-group"><label>Safety Precautions</label><textarea value={permitForm.safetyPrecautions} onChange={e => setP('safetyPrecautions', e.target.value)} rows={2} /></div>
            <div className="form-group">
              <label>PPE Required</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                {PPE_OPTIONS.map(ppe => (
                  <label key={ppe} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${permitForm.ppeRequired.includes(ppe) ? 'var(--primary)' : 'var(--border)'}`,
                    background: permitForm.ppeRequired.includes(ppe) ? 'rgba(255,184,28,0.15)' : 'transparent',
                    color: permitForm.ppeRequired.includes(ppe) ? 'var(--primary)' : 'var(--text-muted)',
                  }}>
                    <input type="checkbox" checked={permitForm.ppeRequired.includes(ppe)} onChange={() => handlePpeToggle(ppe)} style={{ display: 'none' }} />
                    {permitForm.ppeRequired.includes(ppe) ? '✓' : ''} {ppe}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group"><label>Approved By</label><input value={permitForm.approvedBy} onChange={e => setP('approvedBy', e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPermitModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePermit} disabled={sending}>{sending ? 'Generating...' : 'Generate & Print'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Attachments Modal */}
      {photoModal && <PhotoAttachments workRequestId={photoModal.id} onClose={closePhotoModal} />}

      {/* Toast */}
      {toast && (
        <div onClick={() => setToast(null)} style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', padding: '0.75rem 1.25rem',
          borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, zIndex: 200, cursor: 'pointer', maxWidth: '400px',
          background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: toast.type === 'error' ? '#ef4444' : '#22c55e',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          backdropFilter: 'blur(10px)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ── Shared Styles ── */
const thStyle = {
  padding: '0.6rem 0.4rem', fontSize: '0.65rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.4px', color: '#FFD700',
  background: 'linear-gradient(90deg, #1A5276, #2E86C1)',
  borderBottom: '2px solid #FFD700', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.55rem 0.4rem', fontSize: '0.78rem',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  background: 'var(--card)',
};

const kksStyle = {
  fontSize: '0.68rem', background: 'var(--bg)', padding: '0.2rem 0.35rem',
  borderRadius: '3px', color: 'var(--accent)', border: '1px solid var(--border)',
  fontWeight: 600, fontFamily: 'monospace',
};

const btnBase = {
  width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)',
  cursor: 'pointer', fontSize: '0.8rem', padding: 0,
};
const iconBtn = { ...btnBase, color: 'var(--text-muted)' };
const iconBtnDanger = { ...btnBase, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' };
const iconBtnSuccess = { ...btnBase, color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)' };
const iconBtnInfo = { ...btnBase, color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)' };

const photoBtnStyle = {
  width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', borderRadius: '50%', background: 'var(--bg)',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, padding: 0,
};

function Badge({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '3px',
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
      background: color + '20', color: color, border: `1px solid ${color}40`,
    }}>{children}</span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.7rem 0.85rem', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
    </div>
  );
}

function DRow({ label, value, mono, bold, badgeColor, full }) {
  const display = value || '—';
  return (
    <div style={{ padding: '0.6rem 0.5rem', borderBottom: '1px solid var(--border)', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{label}</div>
      {badgeColor && value ? (
        <Badge color={badgeColor}>{display}</Badge>
      ) : (
        <div style={{
          fontSize: '0.88rem', color: value ? 'var(--text)' : 'var(--text-light)',
          fontFamily: mono ? 'monospace' : 'inherit', fontWeight: bold ? 700 : 400,
          whiteSpace: full ? 'pre-wrap' : 'normal',
        }}>{display}</div>
      )}
    </div>
  );
}
