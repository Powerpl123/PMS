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

        const requests = Array.isArray(workRequests) ? workRequests : (workRequests.data || []);
        const pending = requests.filter(r => r.status === 'pending');
        const approvalCounts = { critical: 0, high: 0, medium: 0, low: 0, total: pending.length };
        pending.forEach(req => {
          if (req.priority && approvalCounts.hasOwnProperty(req.priority)) {
            approvalCounts[req.priority]++;
          }
        });

        setStats({ assets: assets.total, workOrders: orders.total });
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
        total: Math.max(0, prev.total - 1)
      }));
    } catch (err) {
      console.error('Failed to approve request', err);
    } finally {
      setApproving(prev => ({ ...prev, [requestId]: false }));
    }
  }

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  const isManager = user?.profile?.role && ['manager', 'admin'].includes(user.profile.role.toLowerCase());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Control Center</h1>
          <div className="subtitle">Power Plant Predictive Maintenance Overview</div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
      }}>
        <StatCard icon="🏗️" value={stats.assets} label="Plant Assets" color="#FF8C00" />
        <StatCard icon="🔧" value={stats.workOrders} label="Work Orders" color="#00D9FF" />
        {pendingApprovals.total > 0 && (
          <StatCard icon="📋" value={pendingApprovals.total} label="Pending Approvals" color="#FF5500" />
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="section-title">Quick Actions</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1rem',
        }}>
          <ActionCard to="/assets" icon="🏗️" label="Plant Assets" desc="Turbines, generators, boilers" />
          <ActionCard to="/work-orders" icon="🔧" label="Work Orders" desc="Schedule & track maintenance" />
          <ActionCard to="/predictive" icon="🧠" label="Failure Prediction" desc="AI-powered risk analysis" />
          <ActionCard to="/reports" icon="📊" label="Reports" desc="Maintenance analytics" />
          {pendingApprovals.total > 0 && (
            <Link to="/work-requests" className="action-card" style={{ borderLeft: '3px solid #FF5500' }}>
              <span className="action-icon">📋</span>
              <span className="action-label">Approvals</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {pendingApprovals.critical > 0 && <PriorityPill label="Critical" count={pendingApprovals.critical} color="#FF5500" />}
                {pendingApprovals.high > 0 && <PriorityPill label="High" count={pendingApprovals.high} color="#FF8C00" />}
                {pendingApprovals.medium > 0 && <PriorityPill label="Med" count={pendingApprovals.medium} color="#00D9FF" />}
                {pendingApprovals.low > 0 && <PriorityPill label="Low" count={pendingApprovals.low} color="#A0A0A0" />}
              </div>
              <span className="action-desc" style={{ color: '#FF5500', fontWeight: '600' }}>
                {pendingApprovals.total} awaiting review
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Approval Queue - Managers/Admins Only */}
      {pendingApprovals.total > 0 && isManager && (
        <div>
          <div className="section-title">Approval Queue ({pendingApprovals.total})</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1rem',
            maxHeight: '500px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
          }}>
            {pendingRequests.map(req => (
              <ApprovalCard
                key={req.id}
                req={req}
                approving={approving[req.id]}
                onApprove={() => approveRequest(req.id)}
              />
            ))}
          </div>
        </div>
      )}

      <NotificationCorner />
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1.25rem 1.5rem',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: 'var(--radius-lg)',
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.4rem',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1.2, textShadow: `0 0 8px ${color}40` }}>
          {value}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ to, icon, label, desc }) {
  return (
    <Link to={to} className="action-card">
      <span className="action-icon">{icon}</span>
      <span className="action-label">{label}</span>
      <span className="action-desc">{desc}</span>
    </Link>
  );
}

function PriorityPill({ label, count, color }) {
  return (
    <span style={{
      background: `${color}25`,
      color,
      padding: '0.15rem 0.5rem',
      borderRadius: '3px',
      fontSize: '0.7rem',
      fontWeight: 700,
      border: `1px solid ${color}50`,
    }}>
      {label}: {count}
    </span>
  );
}

function ApprovalCard({ req, approving, onApprove }) {
  const priorityColors = { critical: '#FF5500', high: '#FF8C00', medium: '#00D9FF', low: '#A0A0A0' };
  const typeColors = { corrective: '#FF5500', preventive: '#FFB81C', inspection: '#FF8C00' };
  const pColor = priorityColors[req.priority] || '#A0A0A0';
  const tColor = typeColors[req.workType] || '#A0A0A0';

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${pColor}`,
      borderRadius: 'var(--radius-lg)',
      padding: '1.1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>
            {req.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            By: {req.requestedBy}
          </div>
        </div>
        <span style={{
          padding: '0.25rem 0.6rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 700,
          background: `${pColor}20`,
          color: pColor,
          border: `1px solid ${pColor}40`,
          whiteSpace: 'nowrap',
        }}>
          {req.priority?.toUpperCase()}
        </span>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{
          padding: '0.2rem 0.5rem',
          borderRadius: '3px',
          fontSize: '0.7rem',
          fontWeight: 600,
          background: `${tColor}15`,
          color: tColor,
        }}>
          {req.workType}
        </span>
        {req.location && (
          <span style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '3px',
            fontSize: '0.7rem',
            fontWeight: 600,
            background: 'rgba(160,160,160,0.15)',
            color: 'var(--text-muted)',
          }}>
            {req.location}
          </span>
        )}
      </div>

      {/* Description */}
      {req.description && (
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {req.description}
        </div>
      )}

      {/* Asset info */}
      <div style={{
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        paddingTop: '0.5rem',
        borderTop: '1px solid var(--border)',
      }}>
        <div><strong style={{ color: 'var(--text-secondary)' }}>Asset:</strong> {req.assetId?.name || '—'}</div>
        {req.kksCode && (
          <div>
            <strong style={{ color: 'var(--text-secondary)' }}>KKS:</strong>{' '}
            <code style={{ fontSize: '0.72rem', background: 'var(--bg)', padding: '0.15rem 0.3rem', borderRadius: '3px', color: '#FFB81C' }}>
              {req.kksCode}
            </code>
          </div>
        )}
      </div>

      {/* Approve button */}
      <button
        onClick={onApprove}
        disabled={approving}
        style={{
          width: '100%',
          padding: '0.6rem',
          background: approving ? 'var(--border)' : '#00FF00',
          color: approving ? 'var(--text-muted)' : '#000',
          border: 'none',
          borderRadius: 'var(--radius)',
          cursor: approving ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          boxShadow: approving ? 'none' : '0 0 8px rgba(0, 255, 0, 0.3)',
        }}
      >
        {approving ? 'Approving...' : 'Approve Request'}
      </button>
    </div>
  );
}
