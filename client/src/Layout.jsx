import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import NotificationBell from './components/NotificationBell';

const mainLinks = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/control-panel', label: 'Control Panel', icon: '🖥️' },
  { to: '/monitoring', label: 'Monitoring', icon: '📡' },
  { to: '/assets', label: 'Plant Assets', icon: '🏗️' },
  { to: '/work-orders', label: 'Work Orders', icon: '🔧' },
  { to: '/work-requests', label: 'Work Requests', icon: '📋' },
];

const powerLinks = [
  { to: '/generator-control', label: 'Generator Control', icon: '⚙️' },
  { to: '/load-sharing', label: 'Load Sharing', icon: '⚖️' },
  { to: '/grid-stability', label: 'Grid Stability', icon: '🔌' },
  { to: '/energy-efficiency', label: 'Energy Efficiency', icon: '🌿' },
  { to: '/blackout-prevention', label: 'Blackout Prevention', icon: '🛡️' },
  { to: '/protection-safety', label: 'Protection & Safety', icon: '🔒' },
];

const adminLinks = [
  { to: '/users', label: 'User Management', icon: '👥' },
];

function NavSection({ title, links }) {
  return (
    <>
      <div className="sidebar-section">{title}</div>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className={({ isActive }) => isActive ? 'active' : ''} end={l.to === '/'}>
          <span className="icon">{l.icon}</span> {l.label}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <img src="/hqpower-logo.svg" alt="HQ Power" className="brand-logo" />
          <div className="brand-text">
            <h2>HQ Power</h2>
            <small>Maintenance System</small>
          </div>
        </div>
        <div className="sidebar-nav">
          <NavSection title="Overview" links={mainLinks} />
          <NavSection title="Power Generation" links={powerLinks} />
          <NavSection title="Administration" links={adminLinks} />
        </div>
        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <NotificationBell />
              <span className="user-name">
                {user.user_metadata?.full_name || user.email}
              </span>
            </div>
          )}
          <button className="sign-out-btn" onClick={signOut}>
            Sign Out
          </button>
          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
