import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/* ── helpers ── */
const REFRESH_MS = 15000;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function simGauge(base, drift) {
  return +(base + (Math.random() - 0.5) * drift * 2).toFixed(1);
}

/* Default unit configurations (fallback when DB has no generation_units) */
const DEFAULT_UNITS = [
  { id: 'sim-1', unitNumber: 1, name: 'Unit 1', capacityMw: 35, online: true, loadSetpointMw: 35, fuelType: 'peat' },
  { id: 'sim-2', unitNumber: 2, name: 'Unit 2', capacityMw: 35, online: true, loadSetpointMw: 35, fuelType: 'peat' },
];

/* Map parameter names to gauge config */
const GAUGE_CFG = {
  steam_temp:     { label: 'Steam Temp',     unit: '°C',    min: 400, max: 600, warnLow: 480, warnHigh: 560, critLow: 450, critHigh: 580 },
  steam_pressure: { label: 'Steam Pressure', unit: ' bar',  min: 100, max: 250, warnLow: 140, warnHigh: 200, critLow: 120, critHigh: 220 },
  cond_vacuum:    { label: 'Cond. Vacuum',   unit: ' bar',  min: -1,  max: 0,   warnLow: -0.99, warnHigh: -0.85, critLow: -1, critHigh: -0.8 },
  vibration:      { label: 'Vibration',       unit: ' mm/s', min: 0,   max: 10,  warnLow: -1, warnHigh: 5, critLow: -1, critHigh: 7.5 },
  bearing_temp:   { label: 'Bearing Temp',   unit: '°C',    min: 30,  max: 100, warnLow: 0, warnHigh: 78, critLow: 0, critHigh: 90 },
  exhaust_temp:   { label: 'Exhaust Temp',   unit: '°C',    min: 20,  max: 80,  warnLow: 0, warnHigh: 55, critLow: 0, critHigh: 65 },
  load:           { label: 'Load',            unit: ' MW',   min: 0,   max: 40,  warnLow: -1, warnHigh: 35, critLow: -1, critHigh: 38 },
  frequency:      { label: 'Grid Frequency',  unit: ' Hz',   min: 49,  max: 51,  warnLow: 49.5, warnHigh: 50.5, critLow: 49.2, critHigh: 50.8 },
};

/* simulated live parameters based on config (used when no sensor tags are configured) */
function simUnit(cfg) {
  if (!cfg.online) return {
    ...cfg, load: 0, steamTemp: 0, steamPressure: 0, condVacuum: 0,
    vibration: 0, bearingTemp: 0, exhaustTemp: 0, frequency: 0,
  };
  const loadPct = cfg.loadSetpointMw / cfg.capacityMw;
  return {
    ...cfg,
    load: simGauge(cfg.loadSetpointMw, cfg.capacityMw * 0.03),
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
function UnitCard({ data, gauges, isLive, onToggle, onSetLoad, onOpenSettings }) {
  const capacity = data.capacityMw;
  const loadSetpoint = data.loadSetpointMw;
  const load = gauges.load ?? data.load ?? 0;

  return (
    <div className={`cp-unit card ${data.online ? '' : 'cp-unit-offline'}`}>
      <div className="cp-unit-header">
        <div className="cp-unit-title">
          <span className={`cp-unit-dot ${data.online ? 'online' : 'offline'}`} />
          <h3>{data.name}</h3>
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({capacity} MW)</span>
          {isLive && <span className="badge badge-green" style={{ marginLeft: '.5rem', fontSize: '.6rem' }}>LIVE</span>}
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
              type="range" min={0} max={capacity} step={10}
              value={loadSetpoint}
              onChange={e => onSetLoad(data.id, Number(e.target.value))}
            />
            <span className="cp-load-sp-value">{loadSetpoint} MW</span>
          </div>
        )}
      </div>

      {data.online ? (
        <div className="cp-unit-body">
          <div className="cp-unit-load">
            <div className="cp-load-value">{load.toFixed ? load.toFixed(1) : load}</div>
            <div className="cp-load-label">MW Output</div>
            <div className="cp-load-bar-track">
              <div className="cp-load-bar-fill" style={{ width: `${clamp(load / capacity * 100, 0, 100)}%` }} />
            </div>
            <div className="cp-load-capacity">{(load / capacity * 100).toFixed(0)}% of {capacity} MW</div>
          </div>
          <div className="cp-gauges-grid">
            <GaugeBar label="Steam Temp" value={gauges.steamTemp ?? data.steamTemp ?? 0} unit="°C" min={400} max={600} warnLow={480} warnHigh={560} critLow={450} critHigh={580} />
            <GaugeBar label="Steam Pressure" value={gauges.steamPressure ?? data.steamPressure ?? 0} unit=" bar" min={100} max={250} warnLow={140} warnHigh={200} critLow={120} critHigh={220} />
            <GaugeBar label="Cond. Vacuum" value={gauges.condVacuum ?? data.condVacuum ?? 0} unit=" bar" min={-1} max={0} warnLow={-0.99} warnHigh={-0.85} critLow={-1} critHigh={-0.8} />
            <GaugeBar label="Vibration" value={gauges.vibration ?? data.vibration ?? 0} unit=" mm/s" min={0} max={10} warnLow={-1} warnHigh={5} critLow={-1} critHigh={7.5} />
            <GaugeBar label="Bearing Temp" value={gauges.bearingTemp ?? data.bearingTemp ?? 0} unit="°C" min={30} max={100} warnLow={0} warnHigh={78} critLow={0} critHigh={90} />
            <GaugeBar label="Exhaust Temp" value={gauges.exhaustTemp ?? data.exhaustTemp ?? 0} unit="°C" min={20} max={80} warnLow={0} warnHigh={55} critLow={0} critHigh={65} />
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
  const [capacity, setCapacity] = useState(unit.capacityMw);

  function handleSave() {
    onSave(unit.id, { name, capacityMw: Number(capacity) });
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
          <input value={`${unit.loadSetpointMw} MW`} disabled />
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
  const [unitConfigs, setUnitConfigs] = useState([]);
  const [units, setUnits] = useState([]);
  const [liveValues, setLiveValues] = useState({}); // { tagId: { value, timestamp } }
  const [sensorTags, setSensorTags] = useState([]); // all active sensor tags
  const [plantStats, setPlantStats] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [liveAlarms, setLiveAlarms] = useState([]);
  const [equipStatus, setEquipStatus] = useState([]);
  const [tick, setTick] = useState(0);
  const [settingsUnit, setSettingsUnit] = useState(null);
  const [dataMode, setDataMode] = useState('loading'); // 'live' | 'simulated' | 'loading'
  const configRef = useRef(unitConfigs);
  configRef.current = unitConfigs;
  const unsubRef = useRef([]);

  /* Load generation units from DB or fall back to defaults */
  const loadUnits = useCallback(async () => {
    try {
      const dbUnits = await api.generationUnits.list();
      if (dbUnits.length > 0) {
        setUnitConfigs(dbUnits);
      } else {
        setUnitConfigs(DEFAULT_UNITS);
      }
    } catch {
      setUnitConfigs(DEFAULT_UNITS);
    }
  }, []);

  /* Load sensor tags and determine live vs simulated mode */
  const loadSensorTags = useCallback(async () => {
    try {
      const { data } = await api.sensorTags.list(1000);
      const activeTags = (data || []).filter(t => t.active !== false);
      setSensorTags(activeTags);
      if (activeTags.length > 0) {
        setDataMode('live');
        // Fetch latest readings for all tags
        const tagIds = activeTags.map(t => t.id);
        const latest = await api.sensorReadings.latest(tagIds);
        const vals = {};
        latest.forEach(r => { vals[r.tagId] = { value: r.value, timestamp: r.timestamp }; });
        setLiveValues(vals);
      } else {
        setDataMode('simulated');
      }
    } catch {
      setDataMode('simulated');
    }
  }, []);

  /* Load live alarm events */
  const loadAlarmEvents = useCallback(async () => {
    try {
      const active = await api.alarmEvents.active(50);
      setLiveAlarms(active);
    } catch { /* ignore */ }
  }, []);

  /* Toggle unit online/offline */
  async function toggleUnit(id) {
    const unit = unitConfigs.find(u => u.id === id);
    if (!unit) return;
    const newOnline = !unit.online;
    const newSetpoint = newOnline ? Math.round(unit.capacityMw * 0.8) : 0;
    // Try to persist to DB
    try {
      await api.generationUnits.update(id, { online: newOnline, loadSetpointMw: newSetpoint });
    } catch { /* local-only update for sim units */ }
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, online: newOnline, loadSetpointMw: newSetpoint } : u
    ));
  }

  /* Adjust load setpoint */
  async function setLoadSetpoint(id, mw) {
    try {
      await api.generationUnits.update(id, { loadSetpointMw: mw });
    } catch { /* local-only */ }
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, loadSetpointMw: mw } : u
    ));
  }

  /* Save unit settings (name, capacity) */
  async function saveUnitSettings(id, patch) {
    try {
      await api.generationUnits.update(id, patch);
    } catch { /* local-only */ }
    setUnitConfigs(prev => prev.map(u =>
      u.id === id ? { ...u, ...patch, loadSetpointMw: Math.min(u.loadSetpointMw, patch.capacityMw || u.capacityMw) } : u
    ));
  }

  /* Build gauge values for a unit from live sensor readings */
  function getGaugesForUnit(unit) {
    if (dataMode !== 'live') return {};
    const unitTags = sensorTags.filter(t => t.generationUnit === unit.unitNumber);
    const gauges = {};
    for (const tag of unitTags) {
      const reading = liveValues[tag.id];
      if (!reading) continue;
      // Map parameter name to camelCase gauge key
      const paramMap = {
        steam_temp: 'steamTemp', steam_pressure: 'steamPressure',
        cond_vacuum: 'condVacuum', vibration: 'vibration',
        bearing_temp: 'bearingTemp', exhaust_temp: 'exhaustTemp',
        load: 'load', frequency: 'frequency',
      };
      const key = paramMap[tag.parameter];
      if (key) gauges[key] = reading.value;
    }
    return gauges;
  }

  /* Load work-order and asset data from API */
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

      /* equipment status from real assets */
      setEquipStatus(assets.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category || '—',
        location: a.location || '—',
        status: a.status,
        serialNumber: a.serialNumber || '',
      })));

      /* build alarms from work orders */
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
          source: 'wo',
        }));
      setAlarms(alarmList);
    } catch { /* silently retry on next tick */ }
  }, []);

  /* Initial load */
  useEffect(() => {
    loadUnits();
    loadSensorTags();
    loadAlarmEvents();
    loadData();
  }, [loadUnits, loadSensorTags, loadAlarmEvents, loadData]);

  /* Subscribe to Realtime channels when in live mode */
  useEffect(() => {
    if (dataMode !== 'live' || sensorTags.length === 0) return;

    const tagIds = sensorTags.map(t => t.id);
    const unsubSensor = api.sensorReadings.subscribe(tagIds, (reading) => {
      setLiveValues(prev => ({
        ...prev,
        [reading.tagId]: { value: reading.value, timestamp: reading.timestamp },
      }));
    });

    const unsubAlarm = api.alarmEvents.subscribe((alarmEvt) => {
      setLiveAlarms(prev => [alarmEvt, ...prev].slice(0, 50));
    });

    unsubRef.current = [unsubSensor, unsubAlarm];
    return () => { unsubRef.current.forEach(fn => fn()); };
  }, [dataMode, sensorTags]);

  /* Simulation ticker (only active when no live sensor data) */
  useEffect(() => {
    if (unitConfigs.length === 0) return;
    if (dataMode === 'live') {
      // In live mode, just build units from configs (gauges come from liveValues)
      setUnits(unitConfigs);
      return;
    }
    // Simulated mode
    setUnits(unitConfigs.map(c => simUnit(c)));
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setUnits(configRef.current.map(c => simUnit(c)));
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [unitConfigs, dataMode]);

  /* Re-sim when configs change (simulated mode) */
  useEffect(() => {
    if (dataMode === 'simulated' && unitConfigs.length > 0) {
      setUnits(unitConfigs.map(c => simUnit(c)));
    } else if (dataMode === 'live') {
      setUnits(unitConfigs);
    }
  }, [unitConfigs, dataMode]);

  /* Periodic data refresh */
  useEffect(() => {
    if (tick > 0 && tick % 2 === 0) {
      loadData();
      if (dataMode === 'live') loadAlarmEvents();
    }
  }, [tick, loadData, loadAlarmEvents, dataMode]);

  /* Merge WO alarms + sensor alarm events */
  const allAlarms = [
    ...liveAlarms.map(a => ({
      id: `alarm-${a.id}`,
      message: a.message || `${a.parameter || 'Sensor'} alarm: ${a.severity}`,
      severity: a.severity,
      priority: a.severity,
      asset: a.tagName || '—',
      time: a.triggeredAt,
      status: a.acknowledged ? 'acknowledged' : 'active',
      source: 'sensor',
    })),
    ...alarms,
  ].sort((a, b) => {
    const p = { critical: 0, warning: 1, info: 2 };
    return (p[a.severity] ?? 3) - (p[b.severity] ?? 3);
  });

  const totalMW = units.reduce((s, u) => {
    if (!u.online) return s;
    if (dataMode === 'live') {
      const g = getGaugesForUnit(u);
      return s + (g.load ?? 0);
    }
    return s + (u.load ?? 0);
  }, 0);

  const freq = (() => {
    if (dataMode === 'live') {
      const onlineUnit = units.find(u => u.online);
      if (onlineUnit) {
        const g = getGaugesForUnit(onlineUnit);
        if (g.frequency != null) return g.frequency;
      }
    }
    return units.find(u => u.online)?.frequency ?? 0;
  })();

  const eqStatusBadge = { active: 'badge-green', maintenance: 'badge-yellow', retired: 'badge-gray', inactive: 'badge-red' };

  return (
    <div className="cp">
      <div className="page-header">
        <div>
          <h1>🖥️ Control Panel</h1>
          <div className="subtitle">Real-time plant monitoring & status overview</div>
        </div>
        <div className="cp-live-tag">
          <span className="cp-live-dot" /> {dataMode === 'live' ? 'LIVE' : 'SIMULATED'}
          <span className="cp-refresh-note">
            {dataMode === 'live' ? 'Realtime via Supabase' : `Auto-refresh ${REFRESH_MS / 1000}s`}
          </span>
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
            gauges={dataMode === 'live' ? getGaugesForUnit(u) : {}}
            isLive={dataMode === 'live'}
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
              <span className="cp-alert-summary-count" style={{ color: 'var(--danger)' }}>{allAlarms.filter(a => a.severity === 'critical').length}</span>
              <span className="cp-alert-summary-label">Critical</span>
            </div>
            <div className="cp-alert-summary-item">
              <span className="cp-alert-dot warning" />
              <span className="cp-alert-summary-count" style={{ color: 'var(--warning)' }}>{allAlarms.filter(a => a.severity === 'warning').length}</span>
              <span className="cp-alert-summary-label">Warning</span>
            </div>
            <div className="cp-alert-summary-item">
              <span className="cp-alert-dot info" />
              <span className="cp-alert-summary-count" style={{ color: 'var(--accent)' }}>{allAlarms.filter(a => a.severity === 'info').length}</span>
              <span className="cp-alert-summary-label">Info</span>
            </div>
            <div className="cp-alert-summary-item" style={{ marginLeft: 'auto' }}>
              <span className="cp-alert-summary-count" style={{ color: 'var(--text)' }}>{allAlarms.length}</span>
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
            {allAlarms.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem' }}>No active alerts</div>
            ) : allAlarms.map(a => (
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
