import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
  generatePermitNumber,
  printWorkPermit,
} from '../utils/workPermit';

const emptyRequest = {
  title: '',
  description: '',
  assetId: '',
  kksCode: '',
  requestedBy: '',
  assignedToName: '',
  department: '',
  workType: 'corrective',
  priority: 'medium',
  status: 'pending',
  location: '',
  scheduledDate: '',
  notes: '',
};

const emptyPermit = {
  issuedBy: '',
  issuedTo: '',
  workDescription: '',
  location: '',
  startDate: '',
  endDate: '',
  safetyPrecautions: '',
  ppeRequired: [],
  hazards: '',
  approvedBy: '',
};

const priorityBadge = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-yellow', critical: 'badge-red' };
const statusBadge = { pending: 'badge-orange', approved: 'badge-blue', 'in-progress': 'badge-yellow', completed: 'badge-green', rejected: 'badge-red', cancelled: 'badge-gray' };
const typeBadge = { corrective: 'badge-red', preventive: 'badge-blue', inspection: 'badge-purple', emergency: 'badge-red' };

const PPE_OPTIONS = ['Hard Hat', 'Safety Glasses', 'Steel-toe Boots', 'Gloves', 'Ear Protection', 'High-vis Vest', 'Face Shield', 'Respiratory Mask', 'Fall Harness', 'Fire-resistant Clothing'];

export default function WorkRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [permits, setPermits] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // null | 'new' | item
  const [permitModal, setPermitModal] = useState(null); // null | requestItem
  const [form, setForm] = useState(emptyRequest);
  const [permitForm, setPermitForm] = useState(emptyPermit);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('requests');
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const load = () =>
    Promise.all([
      api.workRequests.list(100).catch((err) => { console.warn('work_requests:', err.message); return { data: [] }; }),
      api.assets.list(1000).catch((err) => { console.warn('assets:', err.message); return { data: [] }; }),
      api.workPermits.list(100).catch((err) => { console.warn('work_permits:', err.message); return { data: [] }; }),
      api.profiles.list(200).catch((err) => { console.warn('profiles:', err.message); return { data: [] }; }),
    ]).then(([wr, a, wp, u]) => {
      setItems(wr.data);
      setAssets(a.data);
      setPermits(wp.data);
      setUsersList(u.data.filter(p => p.active));
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  /* ── Work Request CRUD ── */
  function openNew() {
    setForm({
      ...emptyRequest,
      requestedBy: user?.user_metadata?.full_name || user?.email || '',
    });
    setModal('new');
  }

  function openEdit(item) {
    setForm({
      title: item.title,
      description: item.description || '',
      assetId: item.assetId?.id || item.assetId || '',
      kksCode: item.kksCode || '',
      requestedBy: item.requestedBy || '',
      assignedToName: item.assignedToName || '',
      department: item.department || '',
      workType: item.workType || 'corrective',
      priority: item.priority,
      status: item.status,
      location: item.location || '',
      scheduledDate: item.scheduledDate ? item.scheduledDate.slice(0, 10) : '',
      notes: item.notes || '',
    });
    setModal(item);
  }

  async function saveRequest() {
    setSending(true);
    try {
      const body = { ...form };
      if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate).toISOString();

      let savedRequest;
      const isNew = modal === 'new';

      if (isNew) {
        savedRequest = await api.workRequests.create(body);
      } else {
        savedRequest = await api.workRequests.update(modal.id, body);
      }

      // Send in-app notification to assigned person
      if (body.assignedToName) {
        const assignedUser = usersList.find(u => u.fullName === body.assignedToName);
        if (assignedUser) {
          try {
            await api.notifications.create({
              userId: assignedUser.id,
              title: isNew ? 'New Work Request Assigned' : 'Work Request Updated',
              message: `"${body.title}" has been ${isNew ? 'assigned to you' : 'updated'} — Priority: ${body.priority}`,
              type: 'assignment',
              link: '/work-requests',
            });
          } catch { /* non-blocking */ }
        }
      }

      setModal(null);
      await load();
      const saveMsg = isNew ? 'Work request created' : 'Work request updated';
      showToast(`${saveMsg} successfully`, 'success');
    } catch (err) {
      showToast('Failed to save work request: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function removeRequest(id) {
    if (!confirm('Delete this work request?')) return;
    await api.workRequests.remove(id);
    load();
  }

  /* ── Approve → Create Work Order ── */
  async function approveToWorkOrder(request) {
    if (!confirm(`Approve "${request.title}" and create a Work Order?`)) return;
    setSending(true);
    try {
      // 1. Create work order from the request
      const woBody = {
        title: request.title,
        description: request.description || '',
        assetId: request.assetId?.id || request.assetId || '',
        assignedTo: request.assignedToName || '',
        priority: request.priority,
        status: 'open',
        dueDate: request.scheduledDate || '',
        estimatedCost: '',
      };
      const workOrder = await api.workOrders.create(woBody);

      // 2. Update work request status to approved
      await api.workRequests.update(request.id, { status: 'approved' });

      // Send in-app notification to assigned person
      if (request.assignedToName) {
        const assignedUser = usersList.find(u => u.fullName === request.assignedToName);
        if (assignedUser) {
          try {
            await api.notifications.create({
              userId: assignedUser.id,
              title: 'Work Order Created',
              message: `Work order "${request.title}" has been created and assigned to you`,
              type: 'approval',
              link: '/work-orders',
            });
          } catch { /* non-blocking */ }
        }
      }

      await load();
      showToast('Work order created from request', 'success');
    } catch (err) {
      showToast('Failed to create work order: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  /* ── Work Permit ── */
  function openPermitModal(request) {
    const existingPermit = permits.find((p) => p.workRequestId === request.id);
    if (existingPermit) {
      printWorkPermit(existingPermit, request);
      return;
    }
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
      const body = {
        ...permitForm,
        workRequestId: permitModal.id,
        permitNumber,
        status: 'issued',
      };
      if (body.startDate) body.startDate = new Date(body.startDate).toISOString();
      if (body.endDate) body.endDate = new Date(body.endDate).toISOString();

      const savedPermit = await api.workPermits.create(body);

      // Update work request status to approved
      await api.workRequests.update(permitModal.id, { status: 'approved' });

      const reqForPrint = permitModal;
      setPermitModal(null);
      await load();
      showToast(`Work permit ${permitNumber} generated successfully`, 'success');

      // Print the permit
      printWorkPermit({ ...permitForm, ...savedPermit, permitNumber }, reqForPrint);
    } catch (err) {
      showToast('Failed to generate permit: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  function handlePpeToggle(item) {
    setPermitForm((prev) => ({
      ...prev,
      ppeRequired: prev.ppeRequired.includes(item)
        ? prev.ppeRequired.filter((i) => i !== item)
        : [...prev.ppeRequired, item],
    }));
  }

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const setP = (k, v) => setPermitForm((prev) => ({ ...prev, [k]: v }));

  const requestPermitMap = {};
  permits.forEach((p) => { requestPermitMap[p.workRequestId] = p; });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📋 Work Requests</h1>
          <div className="subtitle">Create requests, notify assigned personnel & generate work permits</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button
            className={`btn ${tab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('requests')}
          >
            Requests
          </button>
          <button
            className={`btn ${tab === 'permits' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('permits')}
          >
            Permits
          </button>
          {tab === 'requests' && (
            <button className="btn btn-primary" onClick={openNew}>+ New Request</button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon orange">📋</div>
          <div className="stat-info">
            <div className="value orange">{items.length}</div>
            <div className="label">Total Requests</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">⏳</div>
          <div className="stat-info">
            <div className="value blue">{items.filter((i) => i.status === 'pending').length}</div>
            <div className="label">Pending</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <div className="value green">{items.filter((i) => i.status === 'completed').length}</div>
            <div className="label">Completed</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon purple">📄</div>
          <div className="stat-info">
            <div className="value purple">{permits.length}</div>
            <div className="label">Permits Issued</div>
          </div>
        </div>
      </div>

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        <div className="card">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty">No work requests yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Asset</th>
                  <th>KKS Code</th>
                  <th>Assigned To</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Permit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.title}</strong></td>
                    <td><span className={`badge ${typeBadge[w.workType] || 'badge-gray'}`}>{w.workType}</span></td>
                    <td>{w.assetId?.name || '—'}</td>
                    <td>{w.kksCode || '—'}</td>
                    <td>
                      {w.assignedToName || '—'}
                    </td>
                    <td>{w.department || '—'}</td>
                    <td><span className={`badge ${priorityBadge[w.priority]}`}>{w.priority}</span></td>
                    <td><span className={`badge ${statusBadge[w.status]}`}>{w.status}</span></td>
                    <td>
                      {requestPermitMap[w.id] ? (
                        <button className="btn btn-accent btn-sm" onClick={() => printWorkPermit(requestPermitMap[w.id], w)} title="Print permit">
                          🖨️ {requestPermitMap[w.id].permitNumber}
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => openPermitModal(w)}>
                          + Permit
                        </button>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {w.status === 'pending' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--success)', color: '#fff', marginRight: '.35rem' }}
                          onClick={() => approveToWorkOrder(w)}
                          disabled={sending}
                          title="Approve and create Work Order"
                        >
                          ✅ Approve → WO
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => removeRequest(w.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Permits Tab ── */}
      {tab === 'permits' && (
        <div className="card">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : permits.length === 0 ? (
            <div className="empty">No work permits issued yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Permit #</th>
                  <th>Work Request</th>
                  <th>Issued To</th>
                  <th>Issued By</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((p) => {
                  const req = items.find((r) => r.id === p.workRequestId);
                  return (
                    <tr key={p.id}>
                      <td><code>{p.permitNumber}</code></td>
                      <td>{p.workRequestTitle || req?.title || '—'}</td>
                      <td>{p.issuedTo || '—'}</td>
                      <td>{p.issuedBy || '—'}</td>
                      <td>{p.location || '—'}</td>
                      <td><span className={`badge ${p.status === 'active' ? 'badge-green' : p.status === 'issued' ? 'badge-blue' : p.status === 'revoked' ? 'badge-red' : 'badge-gray'}`}>{p.status}</span></td>
                      <td>
                        <button className="btn btn-accent btn-sm" onClick={() => printWorkPermit(p, req)}>🖨️ Print</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Work Request Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === 'new' ? '📋 New Work Request' : '📋 Edit Work Request'}</h2>
            <div className="form-group">
              <label>Title *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Work Type *</label>
                <select value={form.workType} onChange={(e) => set('workType', e.target.value)}>
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                  <option value="inspection">Inspection</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="form-group">
                <label>Asset *</label>
                <select value={form.assetId} onChange={(e) => {
                  const selectedId = e.target.value;
                  set('assetId', selectedId);
                  const selected = assets.find(a => a.id === selectedId);
                  if (selected?.kksCode) set('kksCode', selected.kksCode);
                }}>
                  <option value="">Select asset...</option>
                  {assets.length === 0 && <option disabled>No assets found</option>}
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.location ? ` — ${a.location}` : ''}{a.category ? ` (${a.category})` : ''}{a.kksCode ? ` [${a.kksCode}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>KKS Code</label>
              <input value={form.kksCode} onChange={(e) => set('kksCode', e.target.value)} placeholder="Auto-filled from asset" />
            </div>
            <div className="form-group">
              <label>Assign To</label>
              <select value={form.assignedToName} onChange={(e) => set('assignedToName', e.target.value)}>
                <option value="">Select user...</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.fullName}>
                    {u.fullName}{u.department ? ` — ${u.department}` : ''} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Building A, Floor 2" />
              </div>
              <div className="form-group">
                <label>Scheduled Date</label>
                <input type="date" value={form.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Requested By</label>
                <input value={form.requestedBy} onChange={(e) => set('requestedBy', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Mechanical, Electrical, Operations" />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRequest} disabled={sending || !form.title || !form.assetId}>
                {sending ? 'Saving...' : 'Save & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Work Permit Modal ── */}
      {permitModal && (
        <div className="modal-overlay" onClick={() => setPermitModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>📄 Generate Work Permit</h2>
            <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              For: <strong>{permitModal.title}</strong>
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Issued To</label>
                <input value={permitForm.issuedTo} onChange={(e) => setP('issuedTo', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Issued By</label>
                <input value={permitForm.issuedBy} onChange={(e) => setP('issuedBy', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={permitForm.startDate} onChange={(e) => setP('startDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={permitForm.endDate} onChange={(e) => setP('endDate', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={permitForm.location} onChange={(e) => setP('location', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Work Description</label>
              <textarea value={permitForm.workDescription} onChange={(e) => setP('workDescription', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hazards</label>
              <textarea value={permitForm.hazards} onChange={(e) => setP('hazards', e.target.value)} rows={2} placeholder="Describe potential hazards..." />
            </div>
            <div className="form-group">
              <label>Safety Precautions</label>
              <textarea value={permitForm.safetyPrecautions} onChange={(e) => setP('safetyPrecautions', e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label>PPE Required</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.35rem' }}>
                {PPE_OPTIONS.map((ppe) => (
                  <label
                    key={ppe}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '.35rem',
                      padding: '.3rem .7rem',
                      borderRadius: '999px',
                      fontSize: '.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: permitForm.ppeRequired.includes(ppe) ? 'rgba(249,115,22,.15)' : 'transparent',
                      color: permitForm.ppeRequired.includes(ppe) ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={permitForm.ppeRequired.includes(ppe)}
                      onChange={() => handlePpeToggle(ppe)}
                      style={{ display: 'none' }}
                    />
                    {ppe}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Approved By</label>
              <input value={permitForm.approvedBy} onChange={(e) => setP('approvedBy', e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPermitModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePermit} disabled={sending}>
                {sending ? 'Generating...' : '📄 Generate & Print Permit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            padding: '.85rem 1.5rem',
            borderRadius: 'var(--radius)',
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            color: '#fff',
            fontSize: '.9rem',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
            zIndex: 200,
            maxWidth: '420px',
            animation: 'fadeIn .3s ease',
          }}
          onClick={() => setToast(null)}
        >
          {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
