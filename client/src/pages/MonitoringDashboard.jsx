import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Constants ── */
const PARAM_TYPES = ['voltage', 'frequency', 'active-power', 'reactive-power', 'current', 'power-factor', 'temperature', 'pressure', 'fuel-flow', 'vibration', 'speed', 'exhaust-temp', 'oil-pressure', 'coolant-temp', 'bearing-temp'];
const PARAM_UNITS = { voltage: 'kV', frequency: 'Hz', 'active-power': 'MW', 'reactive-power': 'MVAr', current: 'A', 'power-factor': '', temperature: '°C', pressure: 'bar', 'fuel-flow': 'L/h', vibration: 'mm/s', speed: 'RPM', 'exhaust-temp': '°C', 'oil-pressure': 'bar', 'coolant-temp': '°C', 'bearing-temp': '°C' };
const PARAM_ICONS = { voltage: '⚡', frequency: '〰️', 'active-power': '🔋', 'reactive-power': '🔌', current: '🔀', 'power-factor': '📐', temperature: '🌡️', pressure: '🔴', 'fuel-flow': '⛽', vibration: '📳', speed: '🔄', 'exhaust-temp': '🌡️', 'oil-pressure': '🛢️', 'coolant-temp': '💧', 'bearing-temp': '⚙️' };
const ALARM_LEVELS = ['normal', 'warning', 'alarm', 'trip'];
const OVERRIDE_TYPES = ['emergency-stop', 'manual-start', 'manual-sync', 'breaker-close', 'breaker-open', 'load-shed', 'fuel-valve', 'cooling-pump', 'governor-set', 'avr-set', 'transfer-switch', 'fire-suppression'];
const OVERRIDE_STATUSES = ['pending', 'executed', 'confirmed', 'rejected', 'reversed'];

const alarmBadge = { normal: 'badge-green', warning: 'badge-yellow', alarm: 'badge-orange', trip: 'badge-red' };
const overrideBadge = { pending: 'badge-yellow', executed: 'badge-blue', confirmed: 'badge-green', rejected: 'badge-red', reversed: 'badge-orange' };

const emptyParam = {
  assetId: '', paramType: 'voltage', currentValue: '', unit: 'kV',
  setpointLow: '', setpointHigh: '', alarmLow: '', alarmHigh: '',
  tripLow: '', tripHigh: '', alarmLevel: 'normal', source: '', notes: '',
};

const emptyOverride = {
  overrideType: 'emergency-stop', targetAssetId: '', reason: '',
  operatorName: '', supervisorApproval: '', status: 'pending',
  executedAt: '', valueBeforeOverride: '', valueAfterOverride: '', notes: '',
};

export default function MonitoringDashboard() {
  const { user } = useAuth();
  const [params, setParams] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [assets, setAssets] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('live');
  const [paramModal, setParamModal] = useState(null);
  const [overModal, setOverModal] = useState(null);
  const [form, setForm] = useState(emptyParam);
  const [oForm, setOForm] = useState(emptyOverride);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filterAlarm, setFilterAlarm] = useState('all');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setO = (k, v) => setOForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [pRes, oRes, aRes, gRes] = await Promise.all([
        api.scadaParameters.list(1000).catch(() => ({ data: [] })),
        api.manualOverrides.list(500).catch(() => ({ data: [] })),
        api.assets.list(1000).catch(() => ({ data: [] })),
        api.generators.list(500).catch(() => ({ data: [] })),
      ]);
      setParams(pRes.data);
      setOverrides(oRes.data);
      setAssets(aRes.data);
      setGenerators(gRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed ── */
  const assetName = (id) => assets.find(a => a.id === id)?.name || generators.find(g => g.id === id)?.name || '—';
  const normalCount = params.filter(p => p.alarmLevel === 'normal').length;
  const warningCount = params.filter(p => p.alarmLevel === 'warning').length;
  const alarmCount = params.filter(p => p.alarmLevel === 'alarm').length;
  const tripCount = params.filter(p => p.alarmLevel === 'trip').length;
  const totalOverrides = overrides.length;
  const pendingOverrides = overrides.filter(o => o.status === 'pending').length;

  const q = search.toLowerCase();
  const filteredParams = params.filter(p => {
    if (filterAlarm !== 'all' && p.alarmLevel !== filterAlarm) return false;
    if (!q) return true;
    return assetName(p.assetId).toLowerCase().includes(q) || p.paramType?.toLowerCase().includes(q) || p.source?.toLowerCase().includes(q);
  });
  const filteredOverrides = overrides.filter(o => !q || o.overrideType?.toLowerCase().includes(q) || assetName(o.targetAssetId).toLowerCase().includes(q) || o.reason?.toLowerCase().includes(q) || o.operatorName?.toLowerCase().includes(q));

  // Group params by asset for SCADA view
  const paramsByAsset = useMemo(() => {
    const map = {};
    params.forEach(p => {
      const name = assetName(p.assetId);
      if (!map[name]) map[name] = { id: p.assetId, params: [] };
      map[name].params.push(p);
    });
    return Object.entries(map).sort((a, b) => {
      const aMax = Math.max(...a[1].params.map(p => ALARM_LEVELS.indexOf(p.alarmLevel)));
      const bMax = Math.max(...b[1].params.map(p => ALARM_LEVELS.indexOf(p.alarmLevel)));
      return bMax - aMax;
    });
  }, [params, assets, generators]);

  // Voltage, frequency, load summary from live params
  const keyReadings = useMemo(() => {
    const find = (type) => params.filter(p => p.paramType === type);
    const voltages = find('voltage');
    const freqs = find('frequency');
    const loads = find('active-power');
    const fuels = find('fuel-flow');
    return { voltages, freqs, loads, fuels };
  }, [params]);

  /* ── Param CRUD ── */
  function openNewParam() {
    setForm({ ...emptyParam });
    setParamModal('new');
  }
  function openEditParam(p) {
    setForm({
      assetId: p.assetId || '', paramType: p.paramType || 'voltage',
      currentValue: p.currentValue ?? '', unit: p.unit || PARAM_UNITS[p.paramType] || '',
      setpointLow: p.setpointLow ?? '', setpointHigh: p.setpointHigh ?? '',
      alarmLow: p.alarmLow ?? '', alarmHigh: p.alarmHigh ?? '',
      tripLow: p.tripLow ?? '', tripHigh: p.tripHigh ?? '',
      alarmLevel: p.alarmLevel || 'normal', source: p.source || '', notes: p.notes || '',
    });
    setParamModal(p);
  }
  async function saveParam() {
    if (!form.assetId || !form.paramType) { showToast('Asset and parameter type required', 'error'); return; }
    setSaving(true);
    try {
      if (paramModal === 'new') await api.scadaParameters.create(form);
      else await api.scadaParameters.update(paramModal.id, form);
      setParamModal(null); await load();
      showToast(paramModal === 'new' ? 'Parameter added' : 'Parameter updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteParam(id) {
    if (!confirm('Delete this parameter reading?')) return;
    try { await api.scadaParameters.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Override CRUD ── */
  function openNewOverride() {
    setOForm({ ...emptyOverride, operatorName: user?.user_metadata?.full_name || user?.email || '' });
    setOverModal('new');
  }
  function openEditOverride(o) {
    setOForm({
      overrideType: o.overrideType || 'emergency-stop', targetAssetId: o.targetAssetId || '',
      reason: o.reason || '', operatorName: o.operatorName || '',
      supervisorApproval: o.supervisorApproval || '', status: o.status || 'pending',
      executedAt: o.executedAt ? o.executedAt.slice(0, 16) : '',
      valueBeforeOverride: o.valueBeforeOverride || '', valueAfterOverride: o.valueAfterOverride || '',
      notes: o.notes || '',
    });
    setOverModal(o);
  }
  async function saveOverride() {
    if (!oForm.targetAssetId || !oForm.reason) { showToast('Target asset and reason required', 'error'); return; }
    setSaving(true);
    try {
      if (overModal === 'new') await api.manualOverrides.create(oForm);
      else await api.manualOverrides.update(overModal.id, oForm);
      setOverModal(null); await load();
      showToast('Override saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteOverride(id) {
    if (!confirm('Delete this override record?')) return;
    try { await api.manualOverrides.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Helpers ── */
  const valColor = (p) => {
    const v = parseFloat(p.currentValue);
    if (isNaN(v)) return 'var(--text-muted)';
    if ((p.tripLow && v <= parseFloat(p.tripLow)) || (p.tripHigh && v >= parseFloat(p.tripHigh))) return 'var(--danger)';
    if ((p.alarmLow && v <= parseFloat(p.alarmLow)) || (p.alarmHigh && v >= parseFloat(p.alarmHigh))) return '#f59e0b';
    if ((p.setpointLow && v <= parseFloat(p.setpointLow)) || (p.setpointHigh && v >= parseFloat(p.setpointHigh))) return '#eab308';
    return 'var(--success)';
  };

  const pctInRange = (p) => {
    const v = parseFloat(p.currentValue);
    const lo = parseFloat(p.setpointLow) || parseFloat(p.alarmLow) || 0;
    const hi = parseFloat(p.setpointHigh) || parseFloat(p.alarmHigh) || 100;
    if (isNaN(v) || hi === lo) return 50;
    return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>📡 Monitoring & SCADA Interface</h1>
          <div className="subtitle">Real-time parameters, alarm management & manual overrides</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'live' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('live')}>Live View</button>
          <button className={`btn ${tab === 'params' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('params')}>Parameters</button>
          <button className={`btn ${tab === 'overrides' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('overrides')}>Manual Overrides</button>
          <button className={`btn ${tab === 'reference' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('reference')}>Reference</button>
          {tab === 'params' && <button className="btn btn-primary" onClick={openNewParam}>+ Add Parameter</button>}
          {tab === 'overrides' && <button className="btn btn-primary" onClick={openNewOverride}>+ Log Override</button>}
        </div>
      </div>

      {/* ── Alarm Summary Bar ── */}
      <div className="md-alarm-bar">
        <div className="md-alarm-chip md-alarm-normal" onClick={() => { setFilterAlarm(filterAlarm === 'normal' ? 'all' : 'normal'); setTab('params'); }}>
          <span className="md-alarm-dot" style={{ background: 'var(--success)' }} />
          <span>{normalCount}</span> Normal
        </div>
        <div className="md-alarm-chip md-alarm-warn" onClick={() => { setFilterAlarm(filterAlarm === 'warning' ? 'all' : 'warning'); setTab('params'); }}>
          <span className="md-alarm-dot" style={{ background: '#eab308' }} />
          <span>{warningCount}</span> Warning
        </div>
        <div className="md-alarm-chip md-alarm-alert" onClick={() => { setFilterAlarm(filterAlarm === 'alarm' ? 'all' : 'alarm'); setTab('params'); }}>
          <span className="md-alarm-dot" style={{ background: 'var(--primary)' }} />
          <span>{alarmCount}</span> Alarm
        </div>
        <div className="md-alarm-chip md-alarm-trip" onClick={() => { setFilterAlarm(filterAlarm === 'trip' ? 'all' : 'trip'); setTab('params'); }}>
          <span className="md-alarm-dot" style={{ background: 'var(--danger)' }} />
          <span>{tripCount}</span> Trip
        </div>
        <div style={{ flex: 1 }} />
        <div className="md-alarm-chip" style={{ opacity: .7 }}>
          🎛️ {params.length} parameters · 🔧 {pendingOverrides} pending overrides
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search parameters, assets, overrides..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '.75rem 2.5rem .75rem 2.8rem', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '.92rem', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', transition: 'border-color .2s, box-shadow .2s', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,.12)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--border)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', color: 'var(--text-muted)' }} title="Clear">✕</button>
          )}
        </div>
        {filterAlarm !== 'all' && (
          <div style={{ marginTop: '.5rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.84rem', color: 'var(--text-muted)' }}>
            Filtering: <span className={`badge ${alarmBadge[filterAlarm]}`}>{filterAlarm}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setFilterAlarm('all')}>Clear filter</button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          LIVE VIEW TAB  — SCADA-style dashboard
         ═══════════════════════════════════════ */}
      {tab === 'live' && (
        <>
          {/* Key Readings Panels */}
          <div className="md-key-grid">
            {/* Voltage Panel */}
            <div className="md-key-panel">
              <div className="md-key-title">⚡ Voltage</div>
              {keyReadings.voltages.length === 0 ? <div className="empty" style={{ padding: '.5rem 0' }}>No voltage readings</div> : (
                keyReadings.voltages.map(p => (
                  <div key={p.id} className="md-reading-row">
                    <span className="md-reading-label">{assetName(p.assetId)}</span>
                    <div className="md-reading-gauge">
                      <div className="md-gauge-track"><div className="md-gauge-fill" style={{ width: `${pctInRange(p)}%`, background: valColor(p) }} /></div>
                    </div>
                    <span className="md-reading-value" style={{ color: valColor(p) }}>
                      {p.currentValue ?? '—'} <small>{p.unit}</small>
                    </span>
                    <span className={`badge ${alarmBadge[p.alarmLevel]}`} style={{ fontSize: '.65rem' }}>{p.alarmLevel}</span>
                  </div>
                ))
              )}
            </div>
            {/* Frequency Panel */}
            <div className="md-key-panel">
              <div className="md-key-title">〰️ Frequency</div>
              {keyReadings.freqs.length === 0 ? <div className="empty" style={{ padding: '.5rem 0' }}>No frequency readings</div> : (
                keyReadings.freqs.map(p => (
                  <div key={p.id} className="md-reading-row">
                    <span className="md-reading-label">{assetName(p.assetId)}</span>
                    <div className="md-reading-gauge">
                      <div className="md-gauge-track"><div className="md-gauge-fill" style={{ width: `${pctInRange(p)}%`, background: valColor(p) }} /></div>
                    </div>
                    <span className="md-reading-value" style={{ color: valColor(p) }}>
                      {p.currentValue ?? '—'} <small>Hz</small>
                    </span>
                    <span className={`badge ${alarmBadge[p.alarmLevel]}`} style={{ fontSize: '.65rem' }}>{p.alarmLevel}</span>
                  </div>
                ))
              )}
            </div>
            {/* Load Panel */}
            <div className="md-key-panel">
              <div className="md-key-title">🔋 Active Power</div>
              {keyReadings.loads.length === 0 ? <div className="empty" style={{ padding: '.5rem 0' }}>No load readings</div> : (
                keyReadings.loads.map(p => (
                  <div key={p.id} className="md-reading-row">
                    <span className="md-reading-label">{assetName(p.assetId)}</span>
                    <div className="md-reading-gauge">
                      <div className="md-gauge-track"><div className="md-gauge-fill" style={{ width: `${pctInRange(p)}%`, background: valColor(p) }} /></div>
                    </div>
                    <span className="md-reading-value" style={{ color: valColor(p) }}>
                      {p.currentValue ?? '—'} <small>MW</small>
                    </span>
                    <span className={`badge ${alarmBadge[p.alarmLevel]}`} style={{ fontSize: '.65rem' }}>{p.alarmLevel}</span>
                  </div>
                ))
              )}
            </div>
            {/* Fuel Flow Panel */}
            <div className="md-key-panel">
              <div className="md-key-title">⛽ Fuel Flow</div>
              {keyReadings.fuels.length === 0 ? <div className="empty" style={{ padding: '.5rem 0' }}>No fuel flow readings</div> : (
                keyReadings.fuels.map(p => (
                  <div key={p.id} className="md-reading-row">
                    <span className="md-reading-label">{assetName(p.assetId)}</span>
                    <div className="md-reading-gauge">
                      <div className="md-gauge-track"><div className="md-gauge-fill" style={{ width: `${pctInRange(p)}%`, background: valColor(p) }} /></div>
                    </div>
                    <span className="md-reading-value" style={{ color: valColor(p) }}>
                      {p.currentValue ?? '—'} <small>L/h</small>
                    </span>
                    <span className={`badge ${alarmBadge[p.alarmLevel]}`} style={{ fontSize: '.65rem' }}>{p.alarmLevel}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SCADA Asset Cards */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🏭 Equipment SCADA View</h3>
            {paramsByAsset.length === 0 ? (
              <div className="empty">No SCADA parameters configured. Go to the Parameters tab to add readings.</div>
            ) : (
              <div className="md-scada-grid">
                {paramsByAsset.map(([name, { params: pList }]) => {
                  const worst = Math.max(...pList.map(p => ALARM_LEVELS.indexOf(p.alarmLevel)));
                  const border = worst >= 3 ? 'var(--danger)' : worst >= 2 ? 'var(--primary)' : worst >= 1 ? '#eab308' : 'var(--success)';
                  return (
                    <div key={name} className="md-scada-card" style={{ borderTopColor: border }}>
                      <div className="md-scada-header">
                        <strong>{name}</strong>
                        <span className={`badge ${alarmBadge[ALARM_LEVELS[worst]]}`}>{ALARM_LEVELS[worst]}</span>
                      </div>
                      <div className="md-scada-params">
                        {pList.map(p => (
                          <div key={p.id} className="md-scada-param">
                            <span className="md-scada-picon">{PARAM_ICONS[p.paramType] || '📊'}</span>
                            <span className="md-scada-pname">{p.paramType}</span>
                            <span className="md-scada-pval" style={{ color: valColor(p) }}>
                              {p.currentValue ?? '—'}{p.unit ? ` ${p.unit}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Overrides */}
          {overrides.filter(o => o.status === 'pending' || o.status === 'executed').length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>🔧 Active / Pending Overrides</h3>
              <div className="md-override-list">
                {overrides.filter(o => o.status === 'pending' || o.status === 'executed').map(o => (
                  <div key={o.id} className={`md-override-item ${o.overrideType === 'emergency-stop' ? 'md-override-danger' : ''}`}>
                    <span className="md-override-icon">{o.overrideType === 'emergency-stop' ? '🛑' : '🎛️'}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{o.overrideType}</strong> → <strong>{assetName(o.targetAssetId)}</strong>
                      <br /><span style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>{o.reason}</span>
                    </div>
                    <span className={`badge ${overrideBadge[o.status]}`}>{o.status}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{o.operatorName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════
          PARAMETERS TAB
         ═══════════════════════════════════════ */}
      {tab === 'params' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredParams.length === 0 ? <div className="empty">No parameters configured.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Setpoint</th>
                    <th>Alarm Limits</th>
                    <th>Trip Limits</th>
                    <th>Level</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParams.map(p => (
                    <tr key={p.id} style={p.alarmLevel === 'trip' ? { background: 'rgba(239,68,68,.06)' } : p.alarmLevel === 'alarm' ? { background: 'rgba(249,115,22,.04)' } : {}}>
                      <td><strong>{assetName(p.assetId)}</strong></td>
                      <td>
                        <span style={{ marginRight: '.3rem' }}>{PARAM_ICONS[p.paramType] || '📊'}</span>
                        {p.paramType}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: valColor(p) }}>
                        {p.currentValue ?? '—'}
                      </td>
                      <td style={{ fontSize: '.82rem' }}>{p.unit || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                        {p.setpointLow || p.setpointHigh ? `${p.setpointLow || '—'} – ${p.setpointHigh || '—'}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                        {p.alarmLow || p.alarmHigh ? `${p.alarmLow || '—'} – ${p.alarmHigh || '—'}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                        {p.tripLow || p.tripHigh ? `${p.tripLow || '—'} – ${p.tripHigh || '—'}` : '—'}
                      </td>
                      <td><span className={`badge ${alarmBadge[p.alarmLevel]}`}>{p.alarmLevel}</span></td>
                      <td style={{ fontSize: '.82rem' }}>{p.source || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditParam(p)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteParam(p.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          MANUAL OVERRIDES TAB
         ═══════════════════════════════════════ */}
      {tab === 'overrides' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredOverrides.length === 0 ? <div className="empty">No manual overrides recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Override Type</th>
                    <th>Target Asset</th>
                    <th>Reason</th>
                    <th>Operator</th>
                    <th>Supervisor</th>
                    <th>Before → After</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverrides.map(o => (
                    <tr key={o.id} style={o.overrideType === 'emergency-stop' ? { background: 'rgba(239,68,68,.06)' } : {}}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{o.executedAt ? new Date(o.executedAt).toLocaleString() : o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                      <td>
                        <span className={`badge ${o.overrideType === 'emergency-stop' ? 'badge-red' : o.overrideType.includes('start') ? 'badge-green' : 'badge-blue'}`}>
                          {o.overrideType}
                        </span>
                      </td>
                      <td><strong>{assetName(o.targetAssetId)}</strong></td>
                      <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{o.reason}</td>
                      <td style={{ fontSize: '.82rem' }}>{o.operatorName || '—'}</td>
                      <td style={{ fontSize: '.82rem' }}>{o.supervisorApproval || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                        {o.valueBeforeOverride || o.valueAfterOverride ? `${o.valueBeforeOverride || '?'} → ${o.valueAfterOverride || '?'}` : '—'}
                      </td>
                      <td><span className={`badge ${overrideBadge[o.status]}`}>{o.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditOverride(o)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteOverride(o.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          REFERENCE TAB
         ═══════════════════════════════════════ */}
      {tab === 'reference' && (
        <>
          <div className="md-ref-grid">
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🖥️ SCADA Architecture</h3>
              <div className="md-fw-list">
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>📡</div>
                  <div>
                    <strong>RTU / PLC Integration</strong>
                    <p>Remote Terminal Units and PLCs collect field data via Modbus RTU/TCP, IEC 61850, DNP3. Scan rates: 100ms–1s for protection, 1–5s for monitoring.</p>
                  </div>
                </div>
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>🗄️</div>
                  <div>
                    <strong>Data Historian</strong>
                    <p>OSIsoft PI or similar historian stores time-series data at 1-second resolution. Compression ratio typically 10:1. Retention: raw 90 days, compressed 10+ years.</p>
                  </div>
                </div>
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>🔐</div>
                  <div>
                    <strong>Cybersecurity (IEC 62443)</strong>
                    <p>Defense-in-depth: DMZ between OT/IT networks, role-based access, encrypted communications, regular patching per NERC CIP standards.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🎛️ Manual Override Protocols</h3>
              <div className="md-fw-list">
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>🛑</div>
                  <div>
                    <strong>Emergency Stop (E-Stop)</strong>
                    <p>Hardwired pushbutton bypasses all software. De-energizes equipment immediately. Requires physical reset + supervisor authorization to restart.</p>
                  </div>
                </div>
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>🔑</div>
                  <div>
                    <strong>Key-Switch Override</strong>
                    <p>Physical key-switch for critical breakers and valves. Local/Remote selector prevents conflicting commands. Key management per lockout/tagout procedures.</p>
                  </div>
                </div>
                <div className="md-fw-item">
                  <div className="md-fw-icon" style={{ background: 'rgba(234,179,8,.15)', color: '#eab308' }}>📋</div>
                  <div>
                    <strong>Dual Authorization</strong>
                    <p>Safety-critical overrides require operator + supervisor confirmation. System logs both identities, timestamp, before/after values for audit trail compliance.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Typical Alarm Setpoints */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>📋 Typical Alarm Setpoints Reference</h3>
            <table>
              <thead>
                <tr><th>Parameter</th><th>Unit</th><th>Normal Range</th><th>Warning</th><th>Alarm</th><th>Trip</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>⚡ <strong>Voltage (HV Bus)</strong></td><td>kV</td>
                  <td style={{ fontFamily: 'monospace' }}>10.45 – 11.55</td>
                  <td><span className="badge badge-yellow">±5%</span></td>
                  <td><span className="badge badge-orange">±8%</span></td>
                  <td><span className="badge badge-red">±10%</span></td>
                </tr>
                <tr>
                  <td>〰️ <strong>Frequency</strong></td><td>Hz</td>
                  <td style={{ fontFamily: 'monospace' }}>49.8 – 50.2</td>
                  <td><span className="badge badge-yellow">49.5 / 50.5</span></td>
                  <td><span className="badge badge-orange">49.0 / 51.0</span></td>
                  <td><span className="badge badge-red">48.0 / 52.0</span></td>
                </tr>
                <tr>
                  <td>🌡️ <strong>Bearing Temperature</strong></td><td>°C</td>
                  <td style={{ fontFamily: 'monospace' }}>45 – 75</td>
                  <td><span className="badge badge-yellow">85°C</span></td>
                  <td><span className="badge badge-orange">95°C</span></td>
                  <td><span className="badge badge-red">105°C</span></td>
                </tr>
                <tr>
                  <td>📳 <strong>Vibration</strong></td><td>mm/s</td>
                  <td style={{ fontFamily: 'monospace' }}>0.5 – 4.5</td>
                  <td><span className="badge badge-yellow">7.1</span></td>
                  <td><span className="badge badge-orange">11.2</span></td>
                  <td><span className="badge badge-red">18.0</span></td>
                </tr>
                <tr>
                  <td>🛢️ <strong>Lube Oil Pressure</strong></td><td>bar</td>
                  <td style={{ fontFamily: 'monospace' }}>1.5 – 3.5</td>
                  <td><span className="badge badge-yellow">1.2</span></td>
                  <td><span className="badge badge-orange">1.0</span></td>
                  <td><span className="badge badge-red">0.7</span></td>
                </tr>
                <tr>
                  <td>🌡️ <strong>Exhaust Temperature</strong></td><td>°C</td>
                  <td style={{ fontFamily: 'monospace' }}>450 – 550</td>
                  <td><span className="badge badge-yellow">580°C</span></td>
                  <td><span className="badge badge-orange">600°C</span></td>
                  <td><span className="badge badge-red">630°C</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          PARAMETER MODAL
         ═══════════════════════════════════════ */}
      {paramModal && (
        <div className="modal-overlay" onClick={() => setParamModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{paramModal === 'new' ? '📊 Add SCADA Parameter' : '📊 Edit Parameter'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Asset *</label>
                <select value={form.assetId} onChange={e => set('assetId', e.target.value)}>
                  <option value="">Select asset / generator...</option>
                  <optgroup label="Generators">
                    {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </optgroup>
                  <optgroup label="Assets">
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>Parameter Type *</label>
                <select value={form.paramType} onChange={e => { set('paramType', e.target.value); set('unit', PARAM_UNITS[e.target.value] || ''); }}>
                  {PARAM_TYPES.map(t => <option key={t} value={t}>{PARAM_ICONS[t] || ''} {t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Current Value</label>
                <input type="number" step="any" value={form.currentValue} onChange={e => set('currentValue', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. kV, Hz, MW" />
              </div>
              <div className="form-group">
                <label>Alarm Level</label>
                <select value={form.alarmLevel} onChange={e => set('alarmLevel', e.target.value)}>
                  {ALARM_LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Setpoint Low</label>
                <input type="number" step="any" value={form.setpointLow} onChange={e => set('setpointLow', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Setpoint High</label>
                <input type="number" step="any" value={form.setpointHigh} onChange={e => set('setpointHigh', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Alarm Low</label>
                <input type="number" step="any" value={form.alarmLow} onChange={e => set('alarmLow', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Alarm High</label>
                <input type="number" step="any" value={form.alarmHigh} onChange={e => set('alarmHigh', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Trip Low</label>
                <input type="number" step="any" value={form.tripLow} onChange={e => set('tripLow', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Trip High</label>
                <input type="number" step="any" value={form.tripHigh} onChange={e => set('tripHigh', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Source / Tag</label>
              <input value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g. RTU-01, PLC-MAIN, SCADA Tag: GT01_V_HV" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setParamModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveParam} disabled={saving || !form.assetId}>
                {saving ? 'Saving...' : paramModal === 'new' ? 'Add Parameter' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          OVERRIDE MODAL
         ═══════════════════════════════════════ */}
      {overModal && (
        <div className="modal-overlay" onClick={() => setOverModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{overModal === 'new' ? '🎛️ Log Manual Override' : '🎛️ Edit Override'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Override Type *</label>
                <select value={oForm.overrideType} onChange={e => setO('overrideType', e.target.value)}>
                  {OVERRIDE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Asset *</label>
                <select value={oForm.targetAssetId} onChange={e => setO('targetAssetId', e.target.value)}>
                  <option value="">Select...</option>
                  <optgroup label="Generators">
                    {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </optgroup>
                  <optgroup label="Assets">
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={oForm.status} onChange={e => setO('status', e.target.value)}>
                  {OVERRIDE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Reason / Justification *</label>
              <textarea value={oForm.reason} onChange={e => setO('reason', e.target.value)} placeholder="e.g. Emergency shutdown due to high bearing temperature exceeding trip limit..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Operator Name</label>
                <input value={oForm.operatorName} onChange={e => setO('operatorName', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Supervisor Approval</label>
                <input value={oForm.supervisorApproval} onChange={e => setO('supervisorApproval', e.target.value)} placeholder="Supervisor name" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Executed At</label>
                <input type="datetime-local" value={oForm.executedAt} onChange={e => setO('executedAt', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Value Before</label>
                <input value={oForm.valueBeforeOverride} onChange={e => setO('valueBeforeOverride', e.target.value)} placeholder="e.g. Running, 11.2 kV" />
              </div>
              <div className="form-group">
                <label>Value After</label>
                <input value={oForm.valueAfterOverride} onChange={e => setO('valueAfterOverride', e.target.value)} placeholder="e.g. Stopped, 0 kV" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={oForm.notes} onChange={e => setO('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOverModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveOverride} disabled={saving || !oForm.targetAssetId || !oForm.reason}>
                {saving ? 'Saving...' : overModal === 'new' ? 'Log Override' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
