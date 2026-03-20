import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import NotificationCorner from '../components/NotificationCorner';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentWO, setRecentWO] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approving, setApproving] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const [assets, orders, workRequests] = await Promise.all([
          api.assets.list(1).catch(() => ({ total: 0 })),
          api.workOrders.list(10).catch(() => ({ total: 0, data: [] })),
          api.workRequests.list(100).catch(() => ([])),
        ]);

        const woData = orders.data || [];
        const requests = Array.isArray(workRequests) ? workRequests : (workRequests.data || []);
        const pending = requests.filter(r => r.status === 'pending');

        const woOpen = woData.filter(w => w.status === 'open').length;
        const woInProgress = woData.filter(w => w.status === 'in-progress').length;
        const woCompleted = woData.filter(w => w.status === 'completed').length;
        const woCritical = woData.filter(w => w.priority === 'critical').length;

        const approvalCounts = { critical: 0, high: 0, medium: 0, low: 0, total: pending.length };
        pending.forEach(req => {
          if (req.priority && approvalCounts.hasOwnProperty(req.priority)) {
            approvalCounts[req.priority]++;
          }
        });

        setStats({
          assets: assets.total,
          workOrders: orders.total,
          woOpen, woInProgress, woCompleted, woCritical,
          totalRequests: requests.length,
          pendingApprovals: approvalCounts,
        });
        setRecentWO(woData.slice(0, 5));
        setPendingRequests(pending.slice(0, 6));
      } catch {
        setStats({ assets: 0, workOrders: 0, woOpen: 0, woInProgress: 0, woCompleted: 0, woCritical: 0, totalRequests: 0, pendingApprovals: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } });
      }
    }
    load();
  }, []);

  async function approveRequest(requestId) {
    setApproving(prev => ({ ...prev, [requestId]: true }));
    try {
      await api.workRequests.update(requestId, { status: 'approved' });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setStats(prev => prev ? { ...prev, pendingApprovals: { ...prev.pendingApprovals, total: Math.max(0, prev.pendingApprovals.total - 1) } } : prev);
    } catch (err) {
      console.error('Failed to approve request', err);
    } finally {
      setApproving(prev => ({ ...prev, [requestId]: false }));
    }
  }

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  const isManager = profile?.role && ['manager', 'admin'].includes(profile.role.toLowerCase());
  const pa = stats.pendingApprovals;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {greeting}, {profile?.full_name || 'Operator'}
          </h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            HQ Power — Plant Maintenance Control Center
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '3px',
            background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e30', textTransform: 'uppercase',
          }}>System Online</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        <KPICard label="Plant Assets" value={stats.assets.toLocaleString()} icon="⚡" color="#FF8C00" to="/assets" />
        <KPICard label="Work Orders" value={stats.workOrders} icon="🔧" color="#00D9FF" to="/work-orders" sub={stats.woOpen > 0 ? `${stats.woOpen} open` : null} />
        <KPICard label="Work Requests" value={stats.totalRequests} icon="📋" color="#a78bfa" to="/work-requests" sub={pa.total > 0 ? `${pa.total} pending` : null} />
        <KPICard label="Critical Items" value={stats.woCritical + pa.critical} icon="🚨" color={stats.woCritical + pa.critical > 0 ? '#ef4444' : '#22c55e'} pulse={stats.woCritical + pa.critical > 0} />
      </div>

      {/* Work Order Status Bar */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px',
        padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>WO Status</span>
        <div style={{ flex: 1, display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#0e1722' }}>
          {stats.workOrders > 0 ? (
            <>
              {stats.woCompleted > 0 && <div style={{ width: `${(stats.woCompleted / stats.workOrders) * 100}%`, background: '#22c55e', transition: 'width 0.5s' }} title={`Completed: ${stats.woCompleted}`} />}
              {stats.woInProgress > 0 && <div style={{ width: `${(stats.woInProgress / stats.workOrders) * 100}%`, background: '#f59e0b', transition: 'width 0.5s' }} title={`In Progress: ${stats.woInProgress}`} />}
              {stats.woOpen > 0 && <div style={{ width: `${(stats.woOpen / stats.workOrders) * 100}%`, background: '#00D9FF', transition: 'width 0.5s' }} title={`Open: ${stats.woOpen}`} />}
            </>
          ) : <div style={{ width: '100%', background: '#1a2d42' }} />}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
          <StatusDot color="#22c55e" label="Done" count={stats.woCompleted} />
          <StatusDot color="#f59e0b" label="Active" count={stats.woInProgress} />
          <StatusDot color="#00D9FF" label="Open" count={stats.woOpen} />
        </div>
      </div>

      {/* Main Grid: Quick Actions + Recent + Approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: pa.total > 0 && isManager ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Quick Actions */}
          <div>
            <SectionHeader title="Quick Actions" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
              <QuickAction to="/assets" icon="⚡" label="Plant Assets" desc="Browse equipment" color="#FF8C00" />
              <QuickAction to="/work-orders" icon="🔧" label="Work Orders" desc="Maintenance tasks" color="#00D9FF" />
              <QuickAction to="/work-requests" icon="📋" label="Work Requests" desc="Submit & review" color="#a78bfa" />
              <QuickAction to="/predictive" icon="🧠" label="AI Prediction" desc="Failure analysis" color="#f472b6" />
              <QuickAction to="/reports" icon="📊" label="Reports" desc="Analytics & KPIs" color="#22c55e" />
              <QuickAction to="/control-panel" icon="🎛️" label="Control Panel" desc="System controls" color="#f59e0b" />
            </div>
          </div>

          {/* Recent Work Orders */}
          <div>
            <SectionHeader title="Recent Work Orders" to="/work-orders" />
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
              {recentWO.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>No work orders yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Title', 'Asset', 'Priority', 'Status'].map(h => (
                        <th key={h} style={{
                          padding: '0.4rem 0.5rem', fontSize: '0.58rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.5px', color: '#FFD700',
                          background: '#142a42', borderBottom: '2px solid #2E86C1', textAlign: 'left',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentWO.map((w, i) => {
                      const bg = i % 2 === 0 ? '#111d2b' : '#0e1722';
                      const pColors = { low: '#6b7280', medium: '#00D9FF', high: '#f59e0b', critical: '#ef4444' };
                      const sColors = { open: '#00D9FF', 'in-progress': '#f59e0b', completed: '#22c55e', cancelled: '#6b7280' };
                      const pc = pColors[w.priority] || '#6b7280';
                      const sc = sColors[w.status] || '#6b7280';
                      return (
                        <tr key={w.id} style={{ background: bg }}>
                          <td style={tdS}><span style={{ fontWeight: 600, color: '#e2e8f0' }}>{w.title}</span></td>
                          <td style={tdS}>{w.assetId?.name || '—'}</td>
                          <td style={tdS}><MiniTag color={pc}>{w.priority}</MiniTag></td>
                          <td style={tdS}><MiniTag color={sc}>{w.status}</MiniTag></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Approval Queue */}
        {pa.total > 0 && isManager && (
          <div>
            <SectionHeader title={`Approval Queue (${pa.total})`} to="/work-requests" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '480px', overflowY: 'auto', paddingRight: '0.15rem' }}>
              {pendingRequests.map(req => (
                <ApprovalRow key={req.id} req={req} approving={approving[req.id]} onApprove={() => approveRequest(req.id)} />
              ))}
              {pa.total > pendingRequests.length && (
                <Link to="/work-requests" style={{
                  display: 'block', textAlign: 'center', padding: '0.5rem', fontSize: '0.72rem',
                  color: '#00D9FF', fontWeight: 600,
                }}>View all {pa.total} pending requests →</Link>
              )}
            </div>
          </div>
        )}
      </div>

      <NotificationCorner />
    </div>
  );
}

/* ── Sub-components ── */

function KPICard({ label, value, icon, color, to, sub, pulse }) {
  const inner = (
    <div style={{
      padding: '0.7rem 0.8rem', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: '6px',
      borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: '0.6rem',
      cursor: to ? 'pointer' : 'default', transition: 'border-color 0.2s',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.1rem', flexShrink: 0,
        animation: pulse ? 'pulse-glow 2s infinite' : 'none',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 10px ${color}30` }}>
          {value}
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '0.1rem' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: '0.58rem', color: `${color}cc`, fontWeight: 600, marginTop: '0.05rem' }}>{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner;
}

function QuickAction({ to, icon, label, desc, color }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.55rem 0.65rem', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: '6px',
      textDecoration: 'none', color: 'inherit', transition: 'border-color 0.2s',
      borderLeft: `2px solid ${color}`,
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </Link>
  );
}

function ApprovalRow({ req, approving, onApprove }) {
  const pColors = { critical: '#ef4444', high: '#FF8C00', medium: '#00D9FF', low: '#6b7280' };
  const pc = pColors[req.priority] || '#6b7280';
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${pc}`,
      borderRadius: '6px', padding: '0.6rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {req.title}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.15rem' }}>
          <MiniTag color={pc}>{req.priority}</MiniTag>
          {req.workType && <MiniTag color="#8899aa">{req.workType}</MiniTag>}
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>by {req.requestedBy || '—'}</span>
        </div>
        {req.assetId?.name && (
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            Asset: {req.assetId.name}
            {req.kksCode && <> · <code style={{ fontSize: '0.58rem', color: '#FFB81C' }}>{req.kksCode}</code></>}
          </div>
        )}
      </div>
      <button onClick={onApprove} disabled={approving} style={{
        padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px',
        background: approving ? '#1a2d42' : '#22c55e', color: approving ? '#6b7280' : '#000',
        fontWeight: 700, fontSize: '0.65rem', cursor: approving ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {approving ? '...' : '✓ Approve'}
      </button>
    </div>
  );
}

function SectionHeader({ title, to }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
      {to && <Link to={to} style={{ fontSize: '0.6rem', color: '#00D9FF', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>}
    </div>
  );
}

function StatusDot({ color, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}80` }} />
      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>{count}</span>
    </div>
  );
}

function MiniTag({ color, children }) {
  return (
    <span style={{
      fontSize: '0.55rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '3px',
      background: `${color}15`, color, border: `1px solid ${color}25`, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

const tdS = {
  padding: '0.35rem 0.5rem', fontSize: '0.72rem', color: '#8899aa',
  borderBottom: '1px solid #162538', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
