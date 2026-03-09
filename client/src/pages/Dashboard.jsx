import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const [assets, orders, inventory, vendors] = await Promise.all([
        api.get('/assets?limit=1'),
        api.get('/work-orders?limit=1'),
        api.get('/inventory?limit=1'),
        api.get('/vendors?limit=1'),
      ]);
      setStats({
        assets: assets.pagination.total,
        workOrders: orders.pagination.total,
        inventory: inventory.pagination.total,
        vendors: vendors.pagination.total,
      });
    }
    load();
  }, []);

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
        <div className="card stat-card">
          <div className="stat-icon green">📦</div>
          <div className="stat-info">
            <div className="value green">{stats.inventory}</div>
            <div className="label">Spare Parts</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon purple">🤝</div>
          <div className="stat-info">
            <div className="value purple">{stats.vendors}</div>
            <div className="label">Suppliers</div>
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
        <Link to="/inventory" className="action-card">
          <span className="action-icon">📦</span>
          <span className="action-label">Spare Parts</span>
          <span className="action-desc">Inventory & reorder levels</span>
        </Link>
        <Link to="/predictive" className="action-card">
          <span className="action-icon">🧠</span>
          <span className="action-label">Failure Prediction</span>
          <span className="action-desc">AI-powered risk analysis</span>
        </Link>
        <Link to="/vendors" className="action-card">
          <span className="action-icon">🤝</span>
          <span className="action-label">Suppliers</span>
          <span className="action-desc">Vendor management & ratings</span>
        </Link>
        <Link to="/reports" className="action-card">
          <span className="action-icon">📊</span>
          <span className="action-label">Reports</span>
          <span className="action-desc">Maintenance analytics</span>
        </Link>
      </div>
    </div>
  );
}
