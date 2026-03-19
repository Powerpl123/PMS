import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import NotificationCorner from '../components/NotificationCorner';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approving, setApproving] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const [assets, orders, workRequests] = await Promise.all([
          api.assets.list(1).catch(() => ({ total: 0 })),
          api.workOrders.list(1).catch(() => ({ total: 0 })),
          api.workRequests.list(100).catch(() => ([])),
        ]);
        
        // Count pending approvals by priority
        const requests = Array.isArray(workRequests) ? workRequests : (workRequests.data || []);
        const pending = requests.filter(r => r.status === 'pending');
        const approvalCounts = { critical: 0, high: 0, medium: 0, low: 0, total: pending.length };
        pending.forEach(req => {
          if (req.priority && approvalCounts.hasOwnProperty(req.priority)) {
            approvalCounts[req.priority]++;
          }
        });

        setStats({
          assets: assets.total,
          workOrders: orders.total,
        });
        setPendingApprovals(approvalCounts);
        setPendingRequests(pending);
      } catch {
        setStats({ assets: 0, workOrders: 0 });
        setPendingApprovals({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
        setPendingRequests([]);
      }
    }
    load();
  }, []);

  async function approveRequest(requestId) {
    setApproving(prev => ({ ...prev, [requestId]: true }));
    try {
      await api.workRequests.update(requestId, { status: 'approved' });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setPendingApprovals(prev => ({
        ...prev,
        [prev.priority]: (prev[prev.priority] || 0) - 1,
        total: Math.max(0, prev.total - 1)
      }));
    } catch (err) {
      console.error('Failed to approve request', err);
    } finally {
      setApproving(prev => ({ ...prev, [requestId]: false }));
    }
  }

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>⚡ Control Center</h1>
          <div className="subtitle">Power Plant Predictive Maintenance Overview</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon orange">🏗️</div>
          <div className="stat-info">
            <div className="value orange">{stats.assets}</div>
            <div className="label">Plant Assets</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">🔧</div>
          <div className="stat-info">
            <div className="value blue">{stats.workOrders}</div>
            <div className="label">Work Orders</div>
          </div>
        </div>
      </div>

      <div className="section-title">🚀 Quick Actions</div>
      <div className="actions-grid" style={{ marginBottom: '2rem' }}>
        <Link to="/assets" className="action-card">
          <span className="action-icon">🏗️</span>
          <span className="action-label">Manage Assets</span>
          <span className="action-desc">Turbines, generators, boilers</span>
        </Link>
        <Link to="/work-orders" className="action-card">
          <span className="action-icon">🔧</span>
          <span className="action-label">Work Orders</span>
          <span className="action-desc">Schedule & track maintenance</span>
        </Link>
        <Link to="/predictive" className="action-card">
          <span className="action-icon">🧠</span>
          <span className="action-label">Failure Prediction</span>
          <span className="action-desc">AI-powered risk analysis</span>
        </Link>
        <Link to="/reports" className="action-card">
          <span className="action-icon">📊</span>
          <span className="action-label">Reports</span>
          <span className="action-desc">Maintenance analytics</span>
        </Link>
        {pendingApprovals.total > 0 && (
          <Link to="/work-requests" className="action-card" style={{ position: 'relative', borderLeft: '4px solid #D41E3A' }}>
            <span className="action-icon">📋</span>
            <span className="action-label">Waiting for Approval</span>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {pendingApprovals.critical > 0 && <span style={{ background: '#D41E3A', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 'bold' }}>Critical: {pendingApprovals.critical}</span>}
              {pendingApprovals.high > 0 && <span style={{ background: '#FFA500', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 'bold' }}>High: {pendingApprovals.high}</span>}
              {pendingApprovals.medium > 0 && <span style={{ background: '#0099CC', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 'bold' }}>Med: {pendingApprovals.medium}</span>}
              {pendingApprovals.low > 0 && <span style={{ background: '#999999', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 'bold' }}>Low: {pendingApprovals.low}</span>}
            </div>
            <span className="action-desc" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#D41E3A', fontWeight: 'bold' }}>Total: {pendingApprovals.total} awaiting review</span>
          </Link>
        )}
      </div>

      {/* Pending Approvals Section - Managers/Admins Only */}
      {pendingApprovals.total > 0 && user?.profile?.role && ['manager', 'admin'].includes(user.profile.role.toLowerCase()) && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#004E89', marginBottom: '1rem', letterSpacing: '0.5px' }}>⚠️  APPROVAL QUEUE ({pendingApprovals.total})</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '1rem'
          }}>
            {pendingRequests.map(req => {
              const priorityColor = req.priority === 'critical' ? '#D41E3A' : req.priority === 'high' ? '#FFA500' : req.priority === 'medium' ? '#0099CC' : '#999999';
              const priorityBg = req.priority === 'critical' ? '#ffe8eb' : req.priority === 'high' ? '#fff4e6' : req.priority === 'medium' ? '#e6f3ff' : '#f5f5f5';
              const typeColor = req.workType === 'corrective' ? '#D41E3A' : req.workType === 'preventive' ? '#004E89' : req.workType === 'inspection' ? '#FFA500' : '#999999';
              const typeBg = req.workType === 'corrective' ? '#ffe8eb' : req.workType === 'preventive' ? '#e8f3ff' : req.workType === 'inspection' ? '#fff4e6' : '#f5f5f5';

              return (
                <div key={req.id} style={{
                  background: 'white',
                  border: `2px solid ${priorityColor}`,
                  borderRadius: '8px',
                  padding: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.2s'
                }}>
                  {/* Header with Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0', fontSize: '1rem', fontWeight: '700', color: '#004E89', wordBreak: 'break-word' }}>{req.title}</h3>
                      <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.2rem' }}>By: {req.requestedBy}</div>
                    </div>
                    <span style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: priorityBg,
                      color: priorityColor,
                      whiteSpace: 'nowrap',
                      marginLeft: '0.5rem'
                    }}>
                      {req.priority.toUpperCase()}
                    </span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: typeBg,
                      color: typeColor
                    }}>
                      {req.workType}
                    </span>
                    {req.location && (
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: '#f5f5f5',
                        color: '#616161'
                      }}>
                        📍 {req.location}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {req.description && (
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '0.8rem',
                      fontStyle: 'italic',
                      lineHeight: '1.4',
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {req.description}
                    </div>
                  )}

                  {/* Asset & KKS Code */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #eee'
                  }}>
                    <div><strong>Asset:</strong> {req.assetId?.name || '—'}</div>
                    {req.kksCode && <div><strong>KKS Code:</strong> <code style={{ fontSize: '0.75rem', background: '#f5f5f5', padding: '0.2rem 0.35rem', borderRadius: '3px' }}>{req.kksCode}</code></div>}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => approveRequest(req.id)}
                    disabled={approving[req.id]}
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      background: approving[req.id] ? '#ccc' : '#00FF00',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: approving[req.id] ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                      if (!approving[req.id]) {
                        e.target.style.background = '#00897b';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 121, 107, 0.25)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!approving[req.id]) {
                        e.target.style.background = '#00FF00';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {approving[req.id] ? '⏳ Approving...' : '✓ Approve Request'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NotificationCorner />
    </div>
  );
}
