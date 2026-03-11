import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/* ── helpers ── */
const REFRESH_MS = 15000;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function simGauge(base, drift) {
  return +(base + (Math.random() - 0.5) * drift * 2).toFixed(1);
}

/* Default unit configurations */
const DEFAULT_UNITS = [
  { id: 1, name: 'Unit 1', capacity: 35, online: true, loadSetpoint: 35 },
  { id: 2, name: 'Unit 2', capacity: 35, online: true, loadSetpoint: 35 },
];

/* simulated live parameters based on config */
function simUnit(cfg) {
  if (!cfg.online) return {
    ...cfg, load: 0, steamTemp: 0, steamPressure: 0, condVacuum: 0,
    vibration: 0, bearingTemp: 0, exhaustTemp: 0, frequency: 0,
  };
  const loadPct = cfg.loadSetpoint / cfg.capacity;
  return {
    ...cfg,
    load: simGauge(cfg.loadSetpoint, cfg.capacity * 0.03),
    steamTemp: simGauge(440 + loadPct * 120, 12),
    steamPressure: simGauge(100 + loadPct * 100, 6),
    condVacuum: simGauge(-0.92, 0.03),
    vibration: simGauge(2.0 + loadPct * 2, 1.2),
    bearingTemp: simGauge(50 + loadPct * 25, 5),
    exhaustTemp: simGauge(30 + loadPct * 18, 4),
    frequency: simGauge(50.0, 0.15),
  };
}

function severityColor(s) {
  if (s === 'critical') return 'var(--danger)';
  if (s === 'warning') return 'var(--warning)';
  return 'var(--accent)';
}
function severityBadge(s) {
  if (s === 'critical') return 'badge-red';
  if (s === 'warning') return 'badge-yellow';
  return 'badge-blue';
}

/* ── Gauge bar ── */
function GaugeBar({ label, value, unit, min, max, warnLow, warnHigh, critLow, critHigh }) {
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100);
  let color = 'var(--success)';
  if (value >= critHigh || value <= critLow) color = 'var(--danger)';
  else if (value >= warnHigh || value <= warnLow) color = 'var(--warning)';

  return (
    <div className="cp-gauge">
      <div className="cp-gauge-header">
        <span className="cp-gauge-label">{label}</span>
        <span className="cp-gauge-value" style={{ color }}>{value} <small>{unit}</small></span>
      </div>
      <div className="cp-gauge-track">
        <div className="cp-gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="cp-gauge-range"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );
}

/* ── Unit Card ── */
function UnitCard({ data, onToggle, onSetLoad, onOpenSettings }) {
  return (
    <div className={`cp-unit card ${data.online ? '' : 'cp-unit-offline'}`}>
      <div className="cp-unit-header">
        <div className="cp-unit-title">
          <span className={`cp-unit-dot ${data.online ? 'online' : 'offline'}`} />
          <h3>{data.name}</h3>
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({data.capacity} MW)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span className={`badge ${data.online ? 'badge-green' : 'badge-red'}`}>
            {data.online ? 'ONLINE' : 'OFFLINE'}
          </span>
          <button className="btn btn-sm btn-secondary" onClick={() => onOpenSettings(data)} title="Unit Settings">⚙️</button>
        </div>
      </div>

      {/* Management controls */}
      <div className="cp-unit-controls">
        <button
          className={`btn btn-sm ${data.online ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => onToggle(data.id)}
        >
          {data.online ? '⏹ Shut Down' : '▶ Start Unit'}
        </button>
        {data.online && (
          <div className="cp-load-control">
            <label>Load Setpoint:</label>
            <input
              type="range" min={0} max={data.capacity} step={10}
              value={data.loadSetpoint}
              onChange={e => onSetLoad(data.id, Number(e.target.value))}
            />
            <span className="cp-load-sp-value">{data.loadSetpoint} MW</span>
          </div>
        )}
      </div>

      {data.online ? (
        <div className="cp-unit-body">
          <div className="cp-unit-load">
            <div className="cp-load-value">{data.load}</div>
            <div className="cp-load-label">MW Output</div>
            <div className="cp-load-bar-track">
              <div className="cp-load-bar-fill" style={{ width: `${clamp(data.load / data.capacity * 100, 0, 100)}%` }} />
            </div>
            <div className="cp-load-capacity">{(data.load / data.capacity * 100).toFixed(0)}% of {data.capacity} MW</div>
          </div>
          <div className="cp-gauges-grid">
            <GaugeBar label="Steam Temp" value={data.steamTemp} unit="°C" min={400} max={600} warnLow={480} warnHigh={560} critLow={450} critHigh={580} />
            <GaugeBar label="Steam Pressure" value={data.steamPressure} unit=" bar" min={100} max={250} warnLow={140} warnHigh={200} critLow={120} critHigh={220} />
            <GaugeBar label="Cond. Vacuum" value={data.condVacuum} unit=" bar" min={-1} max={0} warnLow={-0.99} warnHigh={-0.85} critLow={-1} critHigh={-0.8} />
            <GaugeBar label="Vibration" value={data.vibration} unit=" mm/s" min={0} max={10} warnLow={-1} warnHigh={5} critLow={-1} critHigh={7.5} />
            <GaugeBar label="Bearing Temp" value={data.bearingTemp} unit="°C" min={30} max={100} warnLow={0} warnHigh={78} critLow={0} critHigh={90} />
            <GaugeBar label="Exhaust Temp" value={data.exhaustTemp} unit="°C" min={20} max={80} warnLow={0} warnHigh={55} critLow={0} critHigh={65} />
          </div>
        </div>
      ) : (
        <div className="cp-unit-offline-msg">
          Unit offline — click <strong>Start Unit</strong> to bring online
        </div>
      )}
    </div>
  );
}

/* ── Unit Settings Modal ── */
function UnitSettingsModal({ unit, onClose, onSave }) {
  const [name, setName] = useState(unit.name);
  const [capacity, setCapacity] = useState(unit.capacity);

  function handleSave() {
    onSave(unit.id, { name, capacity: Number(capacity) });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>⚙️ {unit.name} — Settings</h2>
        <div className="form-group">
          <label>Unit Name</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Rated Capacity (MW)</label>
          <input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Status</label>
          <input value={unit.online ? 'Online' : 'Offline'} disabled />
        </div>
        <div className="form-group">
          <label>Current Load Setpoint</label>
          <input value={`${unit.loadSetpoint} MW`} disabled />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Control Panel ── */
export default function ControlPanel() {
  const [unitConfigs, setUnitConfigs] = useState(DEFAULT_UNITS);
  const [units, setUnits] = useState(() => DEFAULT_UNITS.map(c => simUnit(c)));
  const [plantStats, setPlantStats] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [equipStatus, setEquipStatus] = useState([]);
  const [tick, setTick] = useState(0);
  const [settingsUnit, setSettingsUnit] = useState(null); // unit config for settings modal
  const configRef = useRef(unitConfigs);
  configRef.current = unitConfigs;

  /* Toggle unit online/offline */
  function toggleUnit(id) {
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, online: !u.online, loadSetpoint: u.online ? 0 : Math.round(u.capacity * 0.8) } : u
    ));
  }

  /* Adjust load setpoint */
  function setLoadSetpoint(id, mw) {
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, loadSetpoint: mw } : u
    ));
  }

  /* Save unit settings (name, capacity) */
  function saveUnitSettings(id, patch) {
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, ...patch, loadSetpoint: Math.min(u.loadSetpoint, patch.capacity) } : u
    ));
  }

  /* Load real data from API */
  const loadData = useCallback(async () => {
    try {
      const [assetsRes, ordersRes] = await Promise.all([
        api.assets.list(1000),
        api.workOrders.list(100),
      ]);

      const assets = assetsRes.data;
      const orders = ordersRes.data;

      /* plant-level stats */
      const active = assets.filter(a => a.status === 'active').length;
      const maint = assets.filter(a => a.status === 'maintenance').length;
      const openOrders = orders.filter(o => o.status === 'open').length;
      const critOrders = orders.filter(o => o.priority === 'critical').length;
      const inProgress = orders.filter(o => o.status === 'in-progress').length;
      setPlantStats({ total: assets.length, active, maint, openOrders, critOrders, inProgress });

      /* build equipment status from real assets */
      setEquipStatus(assets.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category || '—',
        location: a.location || '—',
        status: a.status,
        serialNumber: a.serialNumber || '',
      })));

      /* build alarms from critical/high work orders */
      const alarmList = orders
        .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
        .sort((a, b) => {
          const p = { critical: 0, high: 1, medium: 2, low: 3 };
          return (p[a.priority] ?? 4) - (p[b.priority] ?? 4);
        })
        .map(o => ({
          id: o.id,
          message: o.title,
          severity: o.priority === 'critical' ? 'critical' : o.priority === 'high' ? 'warning' : 'info',
          priority: o.priority,
          asset: o.assetId?.name || 'Unknown',
          time: o.createdAt,
          status: o.status,
        }));
      setAlarms(alarmList);
    } catch { /* silently retry on next tick */ }
  }, []);

  /* refresh simulation + data */
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setUnits(configRef.current.map(c => simUnit(c)));
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  /* re-sim when configs change */
  useEffect(() => {
    setUnits(unitConfigs.map(c => simUnit(c)));
  }, [unitConfigs]);

  /* re-fetch real data every 30s */
  useEffect(() => {
    if (tick > 0 && tick % 2 === 0) loadData();
  }, [tick, loadData]);

  const totalMW = units.reduce((s, u) => s + (u.online ? u.load : 0), 0);
  const freq = units.find(u => u.online)?.frequency ?? 0;

  const eqStatusBadge = { active: 'badge-green', maintenance: 'badge-yellow', retired: 'badge-gray', inactive: 'badge-red' };

  return (
    <div className="cp">
      <div className="page-header">
        <div>
          <h1>🖥️ Control Panel</h1>
          <div className="subtitle">Real-time plant monitoring & status overview</div>
        </div>
        <div className="cp-live-tag">
          <span className="cp-live-dot" /> LIVE
          <span className="cp-refresh-note">Auto-refresh {REFRESH_MS / 1000}s</span>
        </div>
      </div>

      {/* ── Plant Overview Bar ── */}
      <div className="cp-overview-bar">
        <div className="cp-ov-item">
          <div className="cp-ov-value">{totalMW.toFixed(0)}<small> MW</small></div>
          <div className="cp-ov-label">Total Output</div>
        </div>
        <div className="cp-ov-divider" />
        <div className="cp-ov-item">
          <div className="cp-ov-value">{freq.toFixed(2)}<small> Hz</small></div>
          <div className="cp-ov-label">Grid Frequency</div>
        </div>
        <div className="cp-ov-divider" />
        <div className="cp-ov-item">
          <div className="cp-ov-value">{units.filter(u => u.online).length}<small> / {units.length}</small></div>
          <div className="cp-ov-label">Units Online</div>
        </div>
        <div className="cp-ov-divider" />
        <div className="cp-ov-item">
          <div className="cp-ov-value" style={{ color: plantStats?.critOrders ? 'var(--danger)' : 'var(--success)' }}>
            {plantStats?.critOrders ?? 0}
          </div>
          <div className="cp-ov-label">Critical Alerts</div>
        </div>
        <div className="cp-ov-divider" />
        <div className="cp-ov-item">
          <div className="cp-ov-value">{plantStats?.openOrders ?? 0}</div>
          <div className="cp-ov-label">Open Work Orders</div>
        </div>
        <div className="cp-ov-divider" />
        <div className="cp-ov-item">
          <div className="cp-ov-value">{plantStats?.active ?? 0}<small> / {plantStats?.total ?? 0}</small></div>
          <div className="cp-ov-label">Assets Active</div>
        </div>
      </div>

      {/* ── Unit Cards ── */}
      <div className="section-title" style={{ marginTop: '2rem' }}>⚙️ Generation Units</div>
      <div className="cp-units-grid">
        {units.map(u => (
          <UnitCard
            key={u.id}
            data={u}
            onToggle={toggleUnit}
            onSetLoad={setLoadSetpoint}
            onOpenSettings={(d) => setSettingsUnit(unitConfigs.find(c => c.id === d.id))}
          />
        ))}
      </div>

      {/* Settings modal */}
      {settingsUnit && (
        <UnitSettingsModal
          unit={settingsUnit}
          onClose={() => setSettingsUnit(null)}
          onSave={saveUnitSettings}
        />
      )}

      {/* ── Bottom row: Alarms + Equipment ── */}
      <div className="cp-bottom-grid">
        {/* Alarms */}
        <div className="card cp-alarms-card">
          <div className="cp-card-header">
            <h3>🚨 Active Alerts</h3>
            <Link to="/work-orders" className="btn btn-sm btn-secondary">View All</Link>
          </div>

          {/* Severity summary bar */}
          <div className="cp-alert-summary">
            <div className="cp-alert-summary-item">
              <span className="cp-alert-dot critical" />
              <span className="cp-alert-summary-count" style={{ color: 'var(--danger)' }}>{alarms.filter(a => a.severity === 'critical').length}</span>
              <span className="cp-alert-summary-label">Critical</span>
            </div>
            <div className="cp-alert-summary-item">
              <span className="cp-alert-dot warning" />
              <span className="cp-alert-summary-count" style={{ color: 'var(--warning)' }}>{alarms.filter(a => a.severity === 'warning').length}</span>
              <span className="cp-alert-summary-label">Warning</span>
            </div>
            <div className="cp-alert-summary-item">
              <span className="cp-alert-dot info" />
              <span className="cp-alert-summary-count" style={{ color: 'var(--accent)' }}>{alarms.filter(a => a.severity === 'info').length}</span>
              <span className="cp-alert-summary-label">Info</span>
            </div>
            <div className="cp-alert-summary-item" style={{ marginLeft: 'auto' }}>
              <span className="cp-alert-summary-count" style={{ color: 'var(--text)' }}>{alarms.length}</span>
              <span className="cp-alert-summary-label">Total</span>
            </div>
          </div>

          {/* Alert table-style list */}
          <div className="cp-alarm-list">
            <div className="cp-alarm-row cp-alarm-row-header">
              <span className="cp-alarm-col-sev">Severity</span>
              <span className="cp-alarm-col-msg">Alert</span>
              <span className="cp-alarm-col-asset">Asset</span>
              <span className="cp-alarm-col-status">Status</span>
            </div>
            {alarms.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem' }}>No active alerts</div>
            ) : alarms.map(a => (
              <div key={a.id} className="cp-alarm-row" style={{ borderLeftColor: severityColor(a.severity) }}>
                <span className="cp-alarm-col-sev">
                  <span className={`badge ${severityBadge(a.severity)}`}>{a.severity}</span>
                </span>
                <span className="cp-alarm-col-msg">
                  <strong>{a.message}</strong>
                  {a.time && <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.72rem', marginTop: '.1rem' }}>{new Date(a.time).toLocaleDateString()}</small>}
                </span>
                <span className="cp-alarm-col-asset">{a.asset}</span>
                <span className="cp-alarm-col-status">
                  <span className={`badge ${a.status === 'in-progress' ? 'badge-yellow' : a.status === 'open' ? 'badge-blue' : 'badge-gray'}`}>{a.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Status */}
        <div className="card cp-equip-card">
          <div className="cp-card-header">
            <h3>🏗️ Equipment Status</h3>
            <Link to="/assets" className="btn btn-sm btn-secondary">Manage</Link>
          </div>

          {/* Status summary bar */}
          <div className="cp-equip-summary">
            <div className="cp-equip-summary-item">
              <span className="cp-equip-dot active" />
              <span className="cp-equip-summary-count" style={{ color: 'var(--success)' }}>{equipStatus.filter(e => e.status === 'active').length}</span>
              <span className="cp-equip-summary-label">Active</span>
            </div>
            <div className="cp-equip-summary-item">
              <span className="cp-equip-dot maintenance" />
              <span className="cp-equip-summary-count" style={{ color: 'var(--warning)' }}>{equipStatus.filter(e => e.status === 'maintenance').length}</span>
              <span className="cp-equip-summary-label">Maintenance</span>
            </div>
            <div className="cp-equip-summary-item">
              <span className="cp-equip-dot inactive" />
              <span className="cp-equip-summary-count" style={{ color: 'var(--danger)' }}>{equipStatus.filter(e => e.status === 'inactive').length}</span>
              <span className="cp-equip-summary-label">Inactive</span>
            </div>
            <div className="cp-equip-summary-item">
              <span className="cp-equip-dot retired" />
              <span className="cp-equip-summary-count" style={{ color: 'var(--text-muted)' }}>{equipStatus.filter(e => e.status === 'retired').length}</span>
              <span className="cp-equip-summary-label">Retired</span>
            </div>
          </div>

          {/* Equipment table-style list */}
          <div className="cp-equip-list">
            <div className="cp-equip-row cp-equip-row-header">
              <span className="cp-equip-col-name">Equipment</span>
              <span className="cp-equip-col-cat">Category</span>
              <span className="cp-equip-col-loc">Location</span>
              <span className="cp-equip-col-status">Status</span>
            </div>
            {equipStatus.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem' }}>No equipment found</div>
            ) : equipStatus.map(e => (
              <div key={e.id} className="cp-equip-row">
                <span className="cp-equip-col-name">
                  <span className={`cp-equip-dot ${e.status}`} />
                  <span>
                    <strong>{e.name}</strong>
                    {e.serialNumber && <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.72rem' }}>{e.serialNumber}</small>}
                  </span>
                </span>
                <span className="cp-equip-col-cat">{e.category}</span>
                <span className="cp-equip-col-loc">{e.location}</span>
                <span className="cp-equip-col-status">
                  <span className={`badge ${eqStatusBadge[e.status]}`}>{e.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
