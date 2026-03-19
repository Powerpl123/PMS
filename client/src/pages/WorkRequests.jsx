import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
  generatePermitNumber,
  printWorkPermit,
} from '../utils/workPermit';
import PhotoAttachments from '../components/PhotoAttachments';

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
const statusLabel = { pending: 'Waiting for Approval', approved: 'Approved', 'in-progress': 'In Progress', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' };
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
  const [photoModal, setPhotoModal] = useState(null); // null | requestItem (for photo attachments)
  const [form, setForm] = useState(emptyRequest);
  const [permitForm, setPermitForm] = useState(emptyPermit);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('requests');
  const [toast, setToast] = useState(null);
  const [attachmentCounts, setAttachmentCounts] = useState({}); // Track attachment counts

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
      // Load attachment counts for all work requests
      loadAttachmentCounts(wr.data);
    });

  // Load attachment counts for all work requests
  async function loadAttachmentCounts(workRequests) {
    const counts = {};
    try {
      for (const wr of workRequests) {
        const result = await api.workRequestAttachments.list(wr.id, 1).catch(() => ({ data: [] }));
        counts[wr.id] = result.data.length;
      }
      setAttachmentCounts(counts);
    } catch (err) {
      console.warn('Failed to load attachment counts:', err.message);
    }
  }

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

      // Send notification to assigned person
      if (body.assignedToName && isNew) {
        const assignedUser = usersList.find(u => u.fullName === body.assignedToName);
        if (assignedUser) {
          try {
            await api.notifications.create({
              userId: assignedUser.id,
              title: 'New Work Request Assigned',
              message: `"${body.title}" has been assigned to you — Priority: ${body.priority}`,
              type: 'assignment',
              link: '/work-requests',
            });
          } catch { /* non-blocking */ }
        }
      }

      // Send approval notifications to all managers and admins
      if (isNew) {
        const managers = usersList.filter(u => u.role && ['manager', 'admin'].includes(u.role.toLowerCase()));
        for (const manager of managers) {
          try {
            await api.notifications.create({
              userId: manager.id,
              title: '🔔 New Work Request Pending Approval',
              message: `"${body.title}" (${body.priority.toUpperCase()}) from ${body.requestedBy} is waiting for your approval. Location: ${body.location || 'N/A'}`,
              type: 'approval',
              link: '/work-requests',
            });
          } catch { /* non-blocking */ }
        }
        showToast(`Work request created successfully. Approval notifications sent to managers.`, 'success');
      } else {
        showToast('Work request updated successfully', 'success');
      }

      setModal(null);
      await load();
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

  /* ── Approve → Create Work Order ── (Manager/Admin Only) */
  async function approveToWorkOrder(request) {
    // Check user role - only manager or admin can approve
    if (!user?.profile?.role || !['manager', 'admin'].includes(user.profile.role.toLowerCase())) {
      showToast('Only managers and admins can approve work requests', 'error');
      return;
    }

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

      // 2. Update work request status to approved (with role verification)
      await api.workRequests.update(request.id, { 
        status: 'approved',
        approvedBy: user?.user_metadata?.full_name || user?.email || 'Unknown',
        approvedAt: new Date().toISOString(),
      });

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

  /* ── Photo Attachments ── */
  function openPhotoModal(request) {
    setPhotoModal(request);
  }

  function closePhotoModal() {
    setPhotoModal(null);
    // Reload attachment counts when modal closes
    loadAttachmentCounts(items);
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
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: '2rem' }}>
      {/* Professional Header */}
      <div style={{
        background: 'linear-gradient(135deg, #004E89 0%, #1a5099 100%)',
        color: '#FFFFFF',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        boxShadow: '0 4px 12px rgba(255, 184, 28, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Work Requests
            </h1>
            <p style={{ margin: '0', fontSize: '0.95rem', opacity: 0.9, fontWeight: '300' }}>
              Create, track, and approve maintenance work requests with integrated notifications
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className={`btn ${tab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab('requests')}
              style={{ fontWeight: '600' }}
            >
              Requests ({items.length})
            </button>
            <button
              className={`btn ${tab === 'permits' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab('permits')}
              style={{ fontWeight: '600' }}
            >
              Permits ({permits.length})
            </button>
            {tab === 'requests' && (
              <button className="btn btn-primary" onClick={openNew} style={{ fontWeight: '600' }}>
                ➕ New Request
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid - Professional Design */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div style={{
          background: '#1c1c1c',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(255, 184, 28, 0.08), 0 0 15px rgba(255, 184, 28, 0.05)',
          border: '1px solid #383838',
          borderLeft: '4px solid #FFB81C'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Total Requests</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#FFB81C', textShadow: '0 0 10px rgba(255, 184, 28, 0.3)' }}>{items.length}</div>
        </div>
        <div style={{
          background: '#1c1c1c',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(255, 140, 0, 0.08), 0 0 15px rgba(255, 140, 0, 0.05)',
          border: '1px solid #383838',
          borderLeft: '4px solid #FF8C00'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Waiting for Approval</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#FF8C00', textShadow: '0 0 10px rgba(255, 140, 0, 0.3)' }}>{items.filter((i) => i.status === 'pending').length}</div>
        </div>
        <div style={{
          background: '#1c1c1c',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0, 255, 0, 0.08), 0 0 15px rgba(0, 255, 0, 0.05)',
          border: '1px solid #383838',
          borderLeft: '4px solid #00FF00'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Approved</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#00FF00', textShadow: '0 0 10px rgba(0, 255, 0, 0.3)' }}>{items.filter((i) => i.status === 'approved').length}</div>
        </div>
        <div style={{
          background: '#1c1c1c',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0, 255, 0, 0.08), 0 0 15px rgba(0, 255, 0, 0.05)',
          border: '1px solid #383838',
          borderLeft: '4px solid #00FF00'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Completed</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#00FF00', textShadow: '0 0 10px rgba(0, 255, 0, 0.3)' }}>{items.filter((i) => i.status === 'completed').length}</div>
        </div>
      </div>

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e0e0e0',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No work requests yet</div>
              <div style={{ fontSize: '0.85rem', color: '#bbb' }}>Create your first work request to get started</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Title & Description</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>KKS Code</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Asset</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Priority</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Photos</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Assigned To</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#004E89', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w, idx) => (
                  <tr key={w.id} style={{
                    borderBottom: '1px solid #eee',
                    background: idx % 2 === 0 ? '#fff' : '#fafafa',
                    transition: 'background 0.2s'
                  }}>
                    {/* Title & Description */}
                    <td style={{ padding: '1rem', color: '#004E89', fontWeight: '600', fontSize: '0.9rem', maxWidth: '250px' }}>
                      <div style={{ marginBottom: '0.35rem' }}>{w.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.35rem' }}>By: {w.requestedBy}</div>
                      {w.description && (
                        <div style={{ 
                          fontSize: '0.8rem', 
                          color: '#666', 
                          fontStyle: 'italic',
                          wordBreak: 'break-word',
                          maxHeight: '60px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {w.description}
                        </div>
                      )}
                    </td>

                    {/* KKS Code */}
                    <td style={{ padding: '1rem', color: '#004E89', fontWeight: '700', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {w.kksCode || (w.assetId?.kksCode) || '—'}
                    </td>

                    {/* Type */}
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: w.workType === 'corrective' ? '#ffebee' : w.workType === 'preventive' ? '#e3f2fd' : w.workType === 'inspection' ? '#f3e5f5' : '#f5f5f5',
                        color: w.workType === 'corrective' ? '#D41E3A' : w.workType === 'preventive' ? '#004E89' : w.workType === 'inspection' ? '#FFA500' : '#999999'
                      }}>
                        {w.workType}
                      </span>
                    </td>

                    {/* Asset */}
                    <td style={{ padding: '1rem', color: '#424242', fontSize: '0.9rem' }}>
                      <div>{w.assetId?.name || '—'}</div>
                      {w.location && <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>📍 {w.location}</div>}
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: w.priority === 'critical' ? '#ffe8eb' : w.priority === 'high' ? '#fff4e6' : w.priority === 'medium' ? '#e6f3ff' : '#f5f5f5',
                        color: w.priority === 'critical' ? '#D41E3A' : w.priority === 'high' ? '#FFA500' : w.priority === 'medium' ? '#0099CC' : '#999999'
                      }}>
                        {w.priority.toUpperCase()}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: w.status === 'pending' ? '#fff3e0' : w.status === 'approved' ? '#e8f5e9' : w.status === 'in-progress' ? '#e1f5fe' : w.status === 'completed' ? '#e8f5e9' : w.status === 'rejected' ? '#ffecf0' : '#f5f5f5',
                        color: w.status === 'pending' ? '#FFA500' : w.status === 'approved' ? '#00FF00' : w.status === 'in-progress' ? '#00BFFF' : w.status === 'completed' ? '#00FF00' : w.status === 'rejected' ? '#D41E3A' : '#999999'
                      }}>
                        {statusLabel[w.status]}
                      </span>
                    </td>

                    {/* Photos/Attachments */}
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {attachmentCounts[w.id] ? (
                        <button
                          onClick={() => openPhotoModal(w)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.7rem',
                            background: '#e3f2fd',
                            border: '1px solid #0099CC',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            color: '#0099CC',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#e6f3ff';
                            e.target.style.borderColor = '#1565c0';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#e3f2fd';
                            e.target.style.borderColor = '#0099CC';
                          }}
                          title="Click to view/manage photos"
                        >
                          📷 {attachmentCounts[w.id]}
                        </button>
                      ) : (
                        <button
                          onClick={() => openPhotoModal(w)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.7rem',
                            background: '#f5f5f5',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            color: '#999',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#e0e0e0';
                            e.target.style.borderColor = '#999';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#f5f5f5';
                            e.target.style.borderColor = '#ccc';
                          }}
                          title="Click to add photos"
                        >
                          📷 Add
                        </button>
                      )}
                    </td>

                    {/* Assigned To */}
                    <td style={{ padding: '1rem', color: '#424242', fontSize: '0.9rem' }}>{w.assignedToName || '—'}</td>

                    {/* Actions */}
                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => openEdit(w)}
                        style={{
                          padding: '0.4rem 0.7rem',
                          marginRight: '0.35rem',
                          fontSize: '0.8rem',
                          background: '#1e3a5f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#2d5a7b'}
                        onMouseOut={(e) => e.target.style.background = '#1e3a5f'}
                      >
                        Edit
                      </button>
                      {w.status === 'pending' && user?.profile?.role && ['manager', 'admin'].includes(user.profile.role.toLowerCase()) && (
                        <button
                          className="btn btn-sm"
                          style={{ 
                            background: '#004E89', 
                            color: '#fff', 
                            marginRight: '.35rem',
                            padding: '0.4rem 0.7rem',
                            fontSize: '0.8rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => approveToWorkOrder(w)}
                          disabled={sending}
                          title="Approve and create Work Order (Manager/Admin only)"
                          onMouseOver={(e) => !sending && (e.target.style.background = '#00897b')}
                          onMouseOut={(e) => !sending && (e.target.style.background = '#004E89')}
                        >
                          ✓ Approve
                        </button>
                      )}
                      <button
                        onClick={() => removeRequest(w.id)}
                        style={{
                          padding: '0.4rem 0.7rem',
                          fontSize: '0.8rem',
                          background: '#f5f5f5',
                          color: '#D41E3A',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#ffebee';
                          e.target.style.borderColor = '#ef5350';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#f5f5f5';
                          e.target.style.borderColor = '#e0e0e0';
                        }}
                      >
                        Delete
                      </button>
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
        <div style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e0e0e0',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : permits.length === 0 ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No work permits issued yet</div>
              <div style={{ fontSize: '0.85rem', color: '#bbb' }}>Permits will appear here once they are generated</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Permit Number</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Work Request</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Issued To</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Location</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((p, idx) => {
                  const req = items.find((r) => r.id === p.workRequestId);
                  return (
                    <tr key={p.id} style={{
                      borderBottom: '1px solid #eee',
                      background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      transition: 'background 0.2s'
                    }}>
                      <td style={{ padding: '1rem', color: '#1e3a5f', fontWeight: '600', fontSize: '0.9rem', fontFamily: 'monospace' }}>{p.permitNumber}</td>
                      <td style={{ padding: '1rem', color: '#424242', fontSize: '0.9rem' }}>{p.workRequestTitle || req?.title || '—'}</td>
                      <td style={{ padding: '1rem', color: '#424242', fontSize: '0.9rem' }}>{p.issuedTo || '—'}</td>
                      <td style={{ padding: '1rem', color: '#424242', fontSize: '0.9rem' }}>{p.location || '—'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: p.status === 'active' ? '#e8f5e9' : p.status === 'issued' ? '#e3f2fd' : p.status === 'revoked' ? '#ffcdd2' : '#f5f5f5',
                          color: p.status === 'active' ? '#00796b' : p.status === 'issued' ? '#1976d2' : p.status === 'revoked' ? '#c62828' : '#616161'
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => printWorkPermit(p, req)}
                          style={{
                            padding: '0.4rem 0.7rem',
                            fontSize: '0.8rem',
                            background: '#1e3a5f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.background = '#2d5a7b'}
                          onMouseOut={(e) => e.target.style.background = '#1e3a5f'}
                        >
                          🖨️ Print
                        </button>
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
        <div style={{
          position: 'fixed',
          inset: '0',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '1000'
        }} onClick={() => setModal(null)}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            padding: '2rem',
            animation: 'slideUp 0.3s ease'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#1e3a5f',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '1rem'
            }}>
              {modal === 'new' ? '📋 New Work Request' : '📋 Edit Work Request'}
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Title *</label>
              <input 
                value={form.title} 
                onChange={(e) => set('title', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Work Type *</label>
                <select 
                  value={form.workType} 
                  onChange={(e) => set('workType', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                  <option value="inspection">Inspection</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Asset *</label>
                <select 
                  value={form.assetId} 
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    set('assetId', selectedId);
                    const selected = assets.find(a => a.id === selectedId);
                    if (selected?.kksCode) set('kksCode', selected.kksCode);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                >
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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>KKS Code</label>
              <input 
                value={form.kksCode} 
                onChange={(e) => set('kksCode', e.target.value)}
                placeholder="Auto-filled from asset"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Assign To</label>
              <select 
                value={form.assignedToName} 
                onChange={(e) => set('assignedToName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select user...</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.fullName}>
                    {u.fullName}{u.department ? ` — ${u.department}` : ''} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Priority</label>
                <select 
                  value={form.priority} 
                  onChange={(e) => set('priority', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Status</label>
                <select 
                  value={form.status} 
                  onChange={(e) => set('status', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="pending">Waiting for Approval</option>
                  <option value="approved">Approved</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Location</label>
                <input 
                  value={form.location} 
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="Building A, Floor 2"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Scheduled Date</label>
                <input 
                  type="date"
                  value={form.scheduledDate} 
                  onChange={(e) => set('scheduledDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Requested By</label>
                <input 
                  value={form.requestedBy} 
                  onChange={(e) => set('requestedBy', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Department</label>
                <input 
                  value={form.department} 
                  onChange={(e) => set('department', e.target.value)}
                  placeholder="e.g. Mechanical, Electrical, Operations"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Description</label>
              <textarea 
                value={form.description} 
                onChange={(e) => set('description', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  minHeight: '100px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Notes</label>
              <textarea 
                value={form.notes} 
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
              <button 
                onClick={() => setModal(null)}
                style={{
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  background: '#f5f5f5',
                  color: '#424242',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
                onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
              >
                Cancel
              </button>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                {modal !== 'new' && modal?.id && (
                  <button 
                    onClick={() => openPhotoModal(modal)}
                    title="Attach photos or capture from camera"
                    style={{
                      padding: '0.6rem 1.2rem',
                      fontSize: '0.9rem',
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#1565c0'}
                    onMouseOut={(e) => e.target.style.background = '#1976d2'}
                  >
                    📷 Photos/Camera {attachmentCounts[modal.id] ? `(${attachmentCounts[modal.id]})` : ''}
                  </button>
                )}
                <button 
                  onClick={saveRequest} 
                  disabled={sending || !form.title || !form.assetId}
                  style={{
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.9rem',
                    background: sending || !form.title || !form.assetId ? '#ccc' : '#1e3a5f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: sending || !form.title || !form.assetId ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!sending && form.title && form.assetId) {
                      e.target.style.background = '#2d5a7b';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!sending && form.title && form.assetId) {
                      e.target.style.background = '#1e3a5f';
                    }
                  }}
                >
                  {sending ? 'Saving...' : 'Save & Notify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Work Permit Modal ── */}
      {permitModal && (
        <div style={{
          position: 'fixed',
          inset: '0',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '1000'
        }} onClick={() => setPermitModal(null)}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            padding: '2rem',
            animation: 'slideUp 0.3s ease'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#1e3a5f',
              marginBottom: '0.5rem',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '1rem'
            }}>
              📄 Generate Work Permit
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#616161', marginBottom: '1.5rem' }}>
              For: <strong style={{ color: '#1e3a5f' }}>{permitModal.title}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Issued To</label>
                <input 
                  value={permitForm.issuedTo} 
                  onChange={(e) => setP('issuedTo', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Issued By</label>
                <input 
                  value={permitForm.issuedBy} 
                  onChange={(e) => setP('issuedBy', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Start Date</label>
                <input 
                  type="date"
                  value={permitForm.startDate} 
                  onChange={(e) => setP('startDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>End Date</label>
                <input 
                  type="date"
                  value={permitForm.endDate} 
                  onChange={(e) => setP('endDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #d0d0d0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Location</label>
              <input 
                value={permitForm.location} 
                onChange={(e) => setP('location', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Work Description</label>
              <textarea 
                value={permitForm.workDescription} 
                onChange={(e) => setP('workDescription', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Hazards</label>
              <textarea 
                value={permitForm.hazards} 
                onChange={(e) => setP('hazards', e.target.value)}
                rows={2}
                placeholder="Describe potential hazards..."
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Safety Precautions</label>
              <textarea 
                value={permitForm.safetyPrecautions} 
                onChange={(e) => setP('safetyPrecautions', e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.6rem', fontSize: '0.9rem' }}>PPE Required</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {PPE_OPTIONS.map((ppe) => (
                  <label
                    key={ppe}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: '1px solid ' + (permitForm.ppeRequired.includes(ppe) ? '#f57c00' : '#d0d0d0'),
                      background: permitForm.ppeRequired.includes(ppe) ? '#fff3e0' : 'transparent',
                      color: permitForm.ppeRequired.includes(ppe) ? '#e65100' : '#616161',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={permitForm.ppeRequired.includes(ppe)}
                      onChange={() => handlePpeToggle(ppe)}
                      style={{ display: 'none' }}
                    />
                    ✓ {ppe}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#1e3a5f', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Approved By</label>
              <input 
                value={permitForm.approvedBy} 
                onChange={(e) => setP('approvedBy', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
              <button 
                onClick={() => setPermitModal(null)}
                style={{
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  background: '#f5f5f5',
                  color: '#424242',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
                onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
              >
                Cancel
              </button>
              <button 
                onClick={savePermit} 
                disabled={sending}
                style={{
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  background: sending ? '#ccc' : '#00796b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!sending) e.target.style.background = '#00695c';
                }}
                onMouseOut={(e) => {
                  if (!sending) e.target.style.background = '#00796b';
                }}
              >
                {sending ? 'Generating...' : '📄 Generate & Print Permit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Attachments Modal ── */}
      {photoModal && (
        <PhotoAttachments workRequestId={photoModal.id} onClose={closePhotoModal} />
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#ffcdd2' : '#e8f5e9',
            color: toast.type === 'error' ? '#c62828' : '#00796b',
            fontSize: '0.9rem',
            fontWeight: '600',
            border: `1px solid ${toast.type === 'error' ? '#ef5350' : '#81c784'}`,
            borderLeft: `4px solid ${toast.type === 'error' ? '#c62828' : '#00796b'}`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: '200',
            maxWidth: '420px',
            animation: 'slideIn 0.3s ease-out',
            cursor: 'pointer'
          }}
          onClick={() => setToast(null)}
        >
          <div>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>
        </div>
      )}
    </div>
  );
}
