import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const mainLinks = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/control-panel', label: 'Control Panel', icon: '🖥️' },
  { to: '/assets', label: 'Plant Assets', icon: '🏗️' },
  { to: '/work-orders', label: 'Work Orders', icon: '🔧' },
];

const operationLinks = [
  { to: '/inventory', label: 'Spare Parts', icon: '📦' },
  { to: '/vendors', label: 'Suppliers', icon: '🤝' },
];

const analyticsLinks = [
  { to: '/predictive', label: 'Failure Prediction', icon: '🧠' },
  { to: '/reports', label: 'Reports', icon: '📊' },
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
  const { user, logout, isAdmin, isManager } = useAuth();

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div className="brand-text">
            <h2>PowerPlant</h2>
            <small>Maintenance System</small>
          </div>
        </div>
        <div className="sidebar-nav">
          <NavSection title="Overview" links={mainLinks} />
          <NavSection title="Operations" links={operationLinks} />
          <NavSection title="Analytics" links={analyticsLinks} />
          {(isAdmin || isManager) && <NavSection title="Administration" links={adminLinks} />}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Logout">⏻</button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
