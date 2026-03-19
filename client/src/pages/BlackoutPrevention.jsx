import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Constants ── */
const FAULT_TYPES = ['overcurrent', 'earth-fault', 'bus-fault', 'cable-fault', 'transformer-fault', 'generator-fault', 'under-voltage', 'over-voltage', 'under-frequency', 'arc-flash'];
const ZONE_STATUSES = ['healthy', 'faulted', 'isolated', 'degraded', 'restored', 'maintenance'];
const RECONFIG_TYPES = ['auto-isolation', 'auto-transfer', 'load-shedding', 'bus-tie-close', 'backup-feed', 'generator-start', 'manual-switch'];
const RECONFIG_STATUSES = ['pending', 'in-progress', 'completed', 'failed', 'rolled-back'];
const CRITICALITY = ['critical', 'essential', 'normal', 'non-essential'];

const statusBadge = {
  healthy: 'badge-green', faulted: 'badge-red', isolated: 'badge-orange',
  degraded: 'badge-yellow', restored: 'badge-blue', maintenance: 'badge-gray',
  pending: 'badge-gray', 'in-progress': 'badge-blue', completed: 'badge-green',
  failed: 'badge-red', 'rolled-back': 'badge-orange',
  critical: 'badge-red', essential: 'badge-orange', normal: 'badge-blue', 'non-essential': 'badge-gray',
  'auto-isolation': 'badge-red', 'auto-transfer': 'badge-blue', 'load-shedding': 'badge-orange',
  'bus-tie-close': 'badge-purple', 'backup-feed': 'badge-green', 'generator-start': 'badge-green',
  'manual-switch': 'badge-yellow',
};

const emptyZone = {
  name: '', zoneType: 'bus-section', status: 'healthy', criticality: 'normal',
  location: '', feedSource: '', backupSource: '', assetId: '',
  maxLoadMw: '', currentLoadMw: '', notes: '',
};

const emptyFault = {
  zoneId: '', faultType: 'overcurrent', severity: 'high',
  description: '', faultCurrentKa: '', faultLocationDesc: '',
  detectedBy: '', isolatedWithinMs: '', status: 'detected', notes: '',
};

const emptyReconfig = {
  faultEventId: '', reconfigType: 'auto-isolation', status: 'completed',
  fromZoneId: '', toZoneId: '', actionDescription: '',
  responseTimeMs: '', successVerified: true, notes: '',
};

export default function BlackoutPrevention() {
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [faults, setFaults] = useState([]);
  const [reconfigs, setReconfigs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [zoneModal, setZoneModal] = useState(null);
  const [faultModal, setFaultModal] = useState(null);
  const [reconfigModal, setReconfigModal] = useState(null);
  const [form, setForm] = useState(emptyZone);
  const [fForm, setFForm] = useState(emptyFault);
  const [rForm, setRForm] = useState(emptyReconfig);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setF = (k, v) => setFForm(p => ({ ...p, [k]: v }));
  const setR = (k, v) => setRForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [zRes, fRes, rRes, aRes] = await Promise.all([
        api.powerZones.list(500).catch(() => ({ data: [] })),
        api.faultEvents.list(500).catch(() => ({ data: [] })),
        api.reconfigurations.list(500).catch(() => ({ data: [] })),
        api.assets.list(1000).catch(() => ({ data: [] })),
      ]);
      setZones(zRes.data);
      setFaults(fRes.data);
      setReconfigs(rRes.data);
      setAssets(aRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed ── */
  const healthyCount = zones.filter(z => z.status === 'healthy').length;
  const faultedCount = zones.filter(z => z.status === 'faulted' || z.status === 'isolated').length;
  const degradedCount = zones.filter(z => z.status === 'degraded').length;
  const recentFaults = faults.filter(f => {
    const d = new Date(f.createdAt);
    return (Date.now() - d.getTime()) < 7 * 24 * 3600 * 1000;
  });
  const avgResponseMs = useMemo(() => {
    const completed = reconfigs.filter(r => r.responseTimeMs);
    return completed.length > 0 ? (completed.reduce((s, r) => s + (parseFloat(r.responseTimeMs) || 0), 0) / completed.length).toFixed(0) : '—';
  }, [reconfigs]);

  const getZoneName = (id) => zones.find(z => z.id === id)?.name || '—';
  const q = search.toLowerCase();
  const filteredZones = zones.filter(z => !q || z.name?.toLowerCase().includes(q) || z.status?.toLowerCase().includes(q) || z.location?.toLowerCase().includes(q));
  const filteredFaults = faults.filter(f => !q || getZoneName(f.zoneId).toLowerCase().includes(q) || f.faultType?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q));
  const filteredReconfigs = reconfigs.filter(r => !q || r.reconfigType?.toLowerCase().includes(q) || r.actionDescription?.toLowerCase().includes(q) || getZoneName(r.fromZoneId).toLowerCase().includes(q));

  /* ── Zone CRUD ── */
  function openNewZone() { setForm({ ...emptyZone }); setZoneModal('new'); }
  function openEditZone(z) {
    setForm({
      name: z.name || '', zoneType: z.zoneType || 'bus-section', status: z.status || 'healthy',
      criticality: z.criticality || 'normal', location: z.location || '',
      feedSource: z.feedSource || '', backupSource: z.backupSource || '', assetId: z.assetId || '',
      maxLoadMw: z.maxLoadMw ?? '', currentLoadMw: z.currentLoadMw ?? '', notes: z.notes || '',
    });
    setZoneModal(z);
  }
  async function saveZone() {
    if (!form.name) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (zoneModal === 'new') await api.powerZones.create(form);
      else await api.powerZones.update(zoneModal.id, form);
      setZoneModal(null); await load();
      showToast(zoneModal === 'new' ? 'Zone added' : 'Zone updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteZone(id) {
    if (!confirm('Delete this power zone?')) return;
    try { await api.powerZones.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Fault CRUD ── */
  function openNewFault() { setFForm({ ...emptyFault }); setFaultModal('new'); }
  async function saveFault() {
    if (!fForm.zoneId || !fForm.description) { showToast('Zone and description required', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...fForm, reportedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (faultModal === 'new') await api.faultEvents.create(body);
      else await api.faultEvents.update(faultModal.id, body);
      setFaultModal(null); await load();
      showToast('Fault event saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteFault(id) {
    if (!confirm('Delete this fault event?')) return;
    try { await api.faultEvents.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Reconfiguration CRUD ── */
  function openNewReconfig() { setRForm({ ...emptyReconfig }); setReconfigModal('new'); }
  async function saveReconfig() {
    if (!rForm.actionDescription) { showToast('Action description required', 'error'); return; }
    setSaving(true);
    try {
      if (reconfigModal === 'new') await api.reconfigurations.create(rForm);
      else await api.reconfigurations.update(reconfigModal.id, rForm);
      setReconfigModal(null); await load();
      showToast('Reconfiguration saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteReconfig(id) {
    if (!confirm('Delete this reconfiguration record?')) return;
    try { await api.reconfigurations.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>🔌 Blackout Prevention & Reliability</h1>
          <div className="subtitle">Fault detection, automatic isolation & reconfiguration for continuous power</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`btn ${tab === 'zones' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('zones')}>Power Zones</button>
          <button className={`btn ${tab === 'faults' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('faults')}>Fault Events</button>
          <button className={`btn ${tab === 'reconfig' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('reconfig')}>Reconfigurations</button>
          {tab === 'zones' && <button className="btn btn-primary" onClick={openNewZone}>+ Add Zone</button>}
          {tab === 'faults' && <button className="btn btn-primary" onClick={openNewFault}>+ Log Fault</button>}
          {tab === 'reconfig' && <button className="btn btn-primary" onClick={openNewReconfig}>+ Log Reconfig</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info"><div className="value green">{healthyCount}</div><div className="label">Healthy Zones</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: faultedCount > 0 ? 'rgba(255,85,0,.15)' : 'rgba(0,255,0,.15)' }}>
            {faultedCount > 0 ? '🚨' : '✅'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: faultedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{faultedCount}</div>
            <div className="label">Faulted / Isolated</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon orange">⚡</div>
          <div className="stat-info"><div className="value orange">{recentFaults.length}</div><div className="label">Faults (7 days)</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">⏱️</div>
          <div className="stat-info"><div className="value blue">{avgResponseMs}{avgResponseMs !== '—' && <small style={{ fontSize: '.6em', marginLeft: '.15em' }}>ms</small>}</div><div className="label">Avg Response Time</div></div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search zones, faults, reconfigurations..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '.75rem 2.5rem .75rem 2.8rem', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '.92rem', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', transition: 'border-color .2s, box-shadow .2s', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,.12)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--border)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', color: 'var(--text-muted)' }} title="Clear">✕</button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          OVERVIEW TAB
         ═══════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Zone Status Map */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🗺️ Power Zone Status</h3>
            {zones.length === 0 ? (
              <div className="empty">No power zones defined. Go to Power Zones tab to add zones.</div>
            ) : (
              <div className="bp-zone-grid">
                {zones.map(z => {
                  const cap = parseFloat(z.maxLoadMw) || 0;
                  const cur = parseFloat(z.currentLoadMw) || 0;
                  const pct = cap > 0 ? (cur / cap * 100).toFixed(0) : 0;
                  return (
                    <div key={z.id} className={`bp-zone-card bp-zone-${z.status}`}>
                      <div className="bp-zone-top">
                        <strong>{z.name}</strong>
                        <span className={`badge ${statusBadge[z.status]}`}>{z.status}</span>
                      </div>
                      <div className="bp-zone-meta">
                        <span className={`badge ${statusBadge[z.criticality] || 'badge-gray'}`} style={{ fontSize: '.68rem' }}>{z.criticality}</span>
                        {z.location && <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{z.location}</span>}
                      </div>
                      {cap > 0 && (
                        <div style={{ marginTop: '.5rem' }}>
                          <div className="bp-bar-track">
                            <div className="bp-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', marginTop: '.2rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            <span>{cur} / {cap} MW</span><span>{pct}%</span>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: '.76rem', color: 'var(--text-muted)', marginTop: '.4rem' }}>
                        Feed: {z.feedSource || '—'} {z.backupSource && <> · Backup: {z.backupSource}</>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Faults */}
          {faults.filter(f => f.status === 'detected' || f.status === 'isolating').length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>🚨 Active Faults</h3>
              <div className="bp-alert-list">
                {faults.filter(f => f.status === 'detected' || f.status === 'isolating').map(f => (
                  <div key={f.id} className="bp-alert bp-alert-danger">
                    <span className="bp-alert-icon">⚡</span>
                    <div>
                      <strong>{f.faultType}</strong> on <strong>{getZoneName(f.zoneId)}</strong>
                      {f.faultCurrentKa && <> — {f.faultCurrentKa} kA</>}
                      <br /><span style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>{f.description}</span>
                    </div>
                    <span className={`badge ${statusBadge[f.status] || 'badge-red'}`}>{f.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reliability Framework */}
          <div className="bp-framework-grid">
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>🔍 Fault Detection</h3>
              <div className="bp-fw-list">
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>⚡</div>
                  <div>
                    <strong>Overcurrent & Differential</strong>
                    <p>ANSI 50/51 overcurrent and 87 differential relays detect short-circuits within milliseconds. Zone-selective interlocking (ZSI) prevents unnecessary upstream tripping.</p>
                  </div>
                </div>
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>📡</div>
                  <div>
                    <strong>IEC 61850 GOOSE Messaging</strong>
                    <p>High-speed peer-to-peer GOOSE messages between protective relays enable sub-4ms fault isolation without master controller dependency.</p>
                  </div>
                </div>
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>🌐</div>
                  <div>
                    <strong>Arc Flash Detection</strong>
                    <p>Optical arc flash sensors combined with overcurrent detection. Trip time under 35ms, reducing incident energy by up to 98%.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>🔄 Auto Reconfiguration</h3>
              <div className="bp-fw-list">
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>🔀</div>
                  <div>
                    <strong>Automatic Bus Transfer (ABT)</strong>
                    <p>Fast bus transfer switch (≤100ms) transfers critical loads to alternate bus on source failure. Open/closed transition modes supported.</p>
                  </div>
                </div>
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>🏭</div>
                  <div>
                    <strong>Emergency Generator Auto-Start</strong>
                    <p>Standby diesel generators auto-start on bus undervoltage. Target: engine ready in ≤10s, load acceptance in ≤15s per NFPA 110 Type 10.</p>
                  </div>
                </div>
                <div className="bp-fw-item">
                  <div className="bp-fw-icon" style={{ background: 'rgba(234,179,8,.15)', color: 'var(--warning)' }}>📉</div>
                  <div>
                    <strong>Under-Frequency Load Shedding (UFLS)</strong>
                    <p>Staged load shedding at 49.0 Hz, 48.5 Hz, 48.0 Hz. Non-essential loads shed first to protect critical operations and prevent cascade failure.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Operations Priority */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🏥 Critical Operations Priority</h3>
            <table>
              <thead>
                <tr><th>Priority</th><th>Category</th><th>Examples</th><th>Backup Requirement</th><th>Max Outage</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-red">Critical</span></td>
                  <td>Safety & Emergency Systems</td>
                  <td>Fire protection, BMS, ESD, emergency lighting, control room UPS</td>
                  <td>UPS + Diesel Gen (auto-start ≤10s)</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>0 ms</td>
                </tr>
                <tr>
                  <td><span className="badge badge-orange">Essential</span></td>
                  <td>Core Process Equipment</td>
                  <td>Boiler feed pumps, cooling water, turbine lube oil, DCS/SCADA</td>
                  <td>Dual-feed + Auto Bus Transfer (≤100ms)</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>≤100 ms</td>
                </tr>
                <tr>
                  <td><span className="badge badge-blue">Normal</span></td>
                  <td>Standard Process Loads</td>
                  <td>Coal handling, ash handling, water treatment, auxiliary cooling</td>
                  <td>Single feed + manual switchover</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>≤30 min</td>
                </tr>
                <tr>
                  <td><span className="badge badge-gray">Non-Essential</span></td>
                  <td>Facility / Comfort Loads</td>
                  <td>Office HVAC, general lighting, non-critical workshops, EV charging</td>
                  <td>First tier of load shedding</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>Hours</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          ZONES TAB
         ═══════════════════════════════════════ */}
      {tab === 'zones' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredZones.length === 0 ? <div className="empty">No power zones defined.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Zone Name</th>
                    <th>Type</th>
                    <th>Criticality</th>
                    <th>Location</th>
                    <th>Feed Source</th>
                    <th>Backup</th>
                    <th>Load</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map(z => {
                    const cap = parseFloat(z.maxLoadMw) || 0;
                    const cur = parseFloat(z.currentLoadMw) || 0;
                    const pct = cap > 0 ? (cur / cap * 100).toFixed(0) : '—';
                    return (
                      <tr key={z.id}>
                        <td><strong>{z.name}</strong></td>
                        <td style={{ fontSize: '.82rem' }}>{z.zoneType || '—'}</td>
                        <td><span className={`badge ${statusBadge[z.criticality] || 'badge-gray'}`}>{z.criticality}</span></td>
                        <td style={{ fontSize: '.82rem' }}>{z.location || '—'}</td>
                        <td style={{ fontSize: '.82rem' }}>{z.feedSource || '—'}</td>
                        <td style={{ fontSize: '.82rem' }}>{z.backupSource || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                          {cur > 0 ? `${cur}/${cap} MW` : '—'}
                          {pct !== '—' && <><br /><span className={`badge ${pct > 90 ? 'badge-red' : pct > 70 ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: '.68rem' }}>{pct}%</span></>}
                        </td>
                        <td><span className={`badge ${statusBadge[z.status]}`}>{z.status}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => openEditZone(z)}>Edit</button>{' '}
                          <button className="btn btn-sm btn-danger" onClick={() => deleteZone(z.id)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          FAULT EVENTS TAB
         ═══════════════════════════════════════ */}
      {tab === 'faults' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredFaults.length === 0 ? <div className="empty">No fault events recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Zone</th>
                    <th>Fault Type</th>
                    <th>Severity</th>
                    <th>Fault Current</th>
                    <th>Description</th>
                    <th>Detected By</th>
                    <th>Isolated In</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaults.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}</td>
                      <td><strong>{getZoneName(f.zoneId)}</strong></td>
                      <td><span className="badge badge-red">{f.faultType}</span></td>
                      <td><span className={`badge ${f.severity === 'critical' ? 'badge-red' : f.severity === 'high' ? 'badge-orange' : f.severity === 'medium' ? 'badge-yellow' : 'badge-green'}`}>{f.severity}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{f.faultCurrentKa ? `${f.faultCurrentKa} kA` : '—'}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '220px' }}>{f.description}</td>
                      <td style={{ fontSize: '.82rem' }}>{f.detectedBy || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{f.isolatedWithinMs ? `${f.isolatedWithinMs} ms` : '—'}</td>
                      <td><span className={`badge ${f.status === 'detected' ? 'badge-red' : f.status === 'isolating' ? 'badge-orange' : f.status === 'isolated' ? 'badge-yellow' : f.status === 'resolved' ? 'badge-green' : 'badge-gray'}`}>{f.status}</span></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteFault(f.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          RECONFIGURATIONS TAB
         ═══════════════════════════════════════ */}
      {tab === 'reconfig' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredReconfigs.length === 0 ? <div className="empty">No reconfiguration records.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>From Zone</th>
                    <th>To Zone</th>
                    <th>Action</th>
                    <th>Response Time</th>
                    <th>Verified</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReconfigs.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                      <td><span className={`badge ${statusBadge[r.reconfigType] || 'badge-blue'}`}>{r.reconfigType}</span></td>
                      <td>{getZoneName(r.fromZoneId)}</td>
                      <td>{getZoneName(r.toZoneId)}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '250px' }}>{r.actionDescription || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.responseTimeMs ? `${r.responseTimeMs} ms` : '—'}</td>
                      <td>{r.successVerified ? <span className="badge badge-green">✓ Yes</span> : <span className="badge badge-red">✗ No</span>}</td>
                      <td><span className={`badge ${statusBadge[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteReconfig(r.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          ZONE MODAL
         ═══════════════════════════════════════ */}
      {zoneModal && (
        <div className="modal-overlay" onClick={() => setZoneModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{zoneModal === 'new' ? '🔌 Add Power Zone' : '🔌 Edit Power Zone'}</h2>
            <div className="form-group">
              <label>Zone Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. 11kV Bus Section A" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Zone Type</label>
                <select value={form.zoneType} onChange={e => set('zoneType', e.target.value)}>
                  <option value="bus-section">Bus Section</option>
                  <option value="switchgear">Switchgear</option>
                  <option value="mcc">Motor Control Center</option>
                  <option value="distribution-board">Distribution Board</option>
                  <option value="transformer-zone">Transformer Zone</option>
                  <option value="generator-bus">Generator Bus</option>
                  <option value="ups-system">UPS System</option>
                </select>
              </div>
              <div className="form-group">
                <label>Criticality</label>
                <select value={form.criticality} onChange={e => set('criticality', e.target.value)}>
                  {CRITICALITY.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {ZONE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Turbine Hall, Switchroom 1" />
              </div>
              <div className="form-group">
                <label>Linked Asset</label>
                <select value={form.assetId} onChange={e => set('assetId', e.target.value)}>
                  <option value="">None</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Primary Feed Source</label>
                <input value={form.feedSource} onChange={e => set('feedSource', e.target.value)} placeholder="e.g. Transformer T1, Grid Incomer 1" />
              </div>
              <div className="form-group">
                <label>Backup Source</label>
                <input value={form.backupSource} onChange={e => set('backupSource', e.target.value)} placeholder="e.g. Bus-Tie, DG-01" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Max Load (MW)</label>
                <input type="number" step="0.1" value={form.maxLoadMw} onChange={e => set('maxLoadMw', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Current Load (MW)</label>
                <input type="number" step="0.1" value={form.currentLoadMw} onChange={e => set('currentLoadMw', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setZoneModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveZone} disabled={saving || !form.name}>
                {saving ? 'Saving...' : zoneModal === 'new' ? 'Add Zone' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          FAULT MODAL
         ═══════════════════════════════════════ */}
      {faultModal && (
        <div className="modal-overlay" onClick={() => setFaultModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>⚡ Log Fault Event</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Affected Zone *</label>
                <select value={fForm.zoneId} onChange={e => setF('zoneId', e.target.value)}>
                  <option value="">Select zone...</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name} ({z.status})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fault Type</label>
                <select value={fForm.faultType} onChange={e => setF('faultType', e.target.value)}>
                  {FAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Severity</label>
                <select value={fForm.severity} onChange={e => setF('severity', e.target.value)}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fault Current (kA)</label>
                <input type="number" step="0.1" value={fForm.faultCurrentKa} onChange={e => setF('faultCurrentKa', e.target.value)} placeholder="e.g. 25.4" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={fForm.status} onChange={e => setF('status', e.target.value)}>
                  <option value="detected">Detected</option>
                  <option value="isolating">Isolating</option>
                  <option value="isolated">Isolated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={fForm.description} onChange={e => setF('description', e.target.value)} placeholder="Describe the fault event..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Detected By</label>
                <input value={fForm.detectedBy} onChange={e => setF('detectedBy', e.target.value)} placeholder="e.g. Relay SEL-751, Operator" />
              </div>
              <div className="form-group">
                <label>Isolated Within (ms)</label>
                <input type="number" value={fForm.isolatedWithinMs} onChange={e => setF('isolatedWithinMs', e.target.value)} placeholder="e.g. 80" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={fForm.notes} onChange={e => setF('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setFaultModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFault} disabled={saving || !fForm.zoneId || !fForm.description}>
                {saving ? 'Saving...' : 'Log Fault'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          RECONFIGURATION MODAL
         ═══════════════════════════════════════ */}
      {reconfigModal && (
        <div className="modal-overlay" onClick={() => setReconfigModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🔄 Log Reconfiguration</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Reconfiguration Type</label>
                <select value={rForm.reconfigType} onChange={e => setR('reconfigType', e.target.value)}>
                  {RECONFIG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Triggered By Fault</label>
                <select value={rForm.faultEventId} onChange={e => setR('faultEventId', e.target.value)}>
                  <option value="">None / Manual</option>
                  {faults.slice(0, 50).map(f => <option key={f.id} value={f.id}>{f.faultType} — {getZoneName(f.zoneId)} ({f.createdAt ? new Date(f.createdAt).toLocaleDateString() : ''})</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>From Zone</label>
                <select value={rForm.fromZoneId} onChange={e => setR('fromZoneId', e.target.value)}>
                  <option value="">Select...</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>To Zone</label>
                <select value={rForm.toZoneId} onChange={e => setR('toZoneId', e.target.value)}>
                  <option value="">Select...</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Action Description *</label>
              <textarea value={rForm.actionDescription} onChange={e => setR('actionDescription', e.target.value)} placeholder="e.g. Bus-tie breaker closed to restore supply from Bus B to Bus A loads..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Response Time (ms)</label>
                <input type="number" value={rForm.responseTimeMs} onChange={e => setR('responseTimeMs', e.target.value)} placeholder="e.g. 100" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={rForm.status} onChange={e => setR('status', e.target.value)}>
                  {RECONFIG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Success Verified</label>
                <select value={rForm.successVerified ? 'true' : 'false'} onChange={e => setR('successVerified', e.target.value === 'true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={rForm.notes} onChange={e => setR('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReconfigModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReconfig} disabled={saving || !rForm.actionDescription}>
                {saving ? 'Saving...' : 'Save Reconfiguration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
