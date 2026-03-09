import { NavLink, Outlet } from 'react-router-dom';

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
        </div>
        <div className="sidebar-footer">
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
