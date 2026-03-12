import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Constants ── */
const REG_MODES = ['droop', 'isochronous', 'AGC', 'manual', 'off'];
const SIGNAL_TYPES = ['frequency', 'voltage', 'active-power', 'reactive-power', 'power-factor', 'tie-line-flow', 'ace', 'reserve-margin'];
const EMS_CMD_TYPES = ['setpoint-change', 'unit-start', 'unit-stop', 'ramp-up', 'ramp-down', 'voltage-raise', 'voltage-lower', 'tap-change', 'capacitor-switch', 'load-curtail', 'reserve-call'];
const EMS_STATUSES = ['received', 'acknowledged', 'executing', 'completed', 'failed', 'rejected'];
const EVENT_TYPES = ['frequency-deviation', 'voltage-deviation', 'overload', 'under-generation', 'over-generation', 'tie-line-error', 'reserve-low', 'load-forecast-miss', 'agc-correction'];
const SEVERITIES = ['info', 'warning', 'critical'];

const badgeMap = {
  droop: 'badge-blue', isochronous: 'badge-green', AGC: 'badge-purple', manual: 'badge-yellow', off: 'badge-gray',
  received: 'badge-gray', acknowledged: 'badge-blue', executing: 'badge-orange', completed: 'badge-green', failed: 'badge-red', rejected: 'badge-red',
  info: 'badge-blue', warning: 'badge-yellow', critical: 'badge-red',
  frequency: 'badge-blue', voltage: 'badge-orange', 'active-power': 'badge-green', 'reactive-power': 'badge-purple',
  'power-factor': 'badge-yellow', 'tie-line-flow': 'badge-blue', ace: 'badge-orange', 'reserve-margin': 'badge-green',
};

const emptyRegulator = {
  generatorId: '', regulationType: 'frequency', mode: 'droop',
  droopPct: '5', setpoint: '', currentOutput: '',
  deadbandPct: '', responseTimeMs: '', maxRampRate: '',
  enabled: true, notes: '',
};

const emptyEmsCommand = {
  commandType: 'setpoint-change', targetGeneratorId: '', targetValue: '',
  status: 'received', sourceSystem: '', priority: 'normal',
  responseDeadlineSec: '', executedValue: '', notes: '',
};

const emptyEvent = {
  eventType: 'frequency-deviation', severity: 'warning',
  measuredValue: '', expectedValue: '', deviationPct: '',
  affectedZone: '', description: '', correctionAction: '',
  autoResolved: false, notes: '',
};

export default function GridStability() {
  const { user } = useAuth();
  const [regulators, setRegulators] = useState([]);
  const [emsCommands, setEmsCommands] = useState([]);
  const [events, setEvents] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [regModal, setRegModal] = useState(null);
  const [emsModal, setEmsModal] = useState(null);
  const [evtModal, setEvtModal] = useState(null);
  const [form, setForm] = useState(emptyRegulator);
  const [eForm, setEForm] = useState(emptyEmsCommand);
  const [vForm, setVForm] = useState(emptyEvent);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setE = (k, v) => setEForm(p => ({ ...p, [k]: v }));
  const setV = (k, v) => setVForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [rRes, cRes, eRes, gRes] = await Promise.all([
        api.gridRegulators.list(500).catch(() => ({ data: [] })),
        api.emsCommands.list(500).catch(() => ({ data: [] })),
        api.gridEvents.list(500).catch(() => ({ data: [] })),
        api.generators.list(500).catch(() => ({ data: [] })),
      ]);
      setRegulators(rRes.data);
      setEmsCommands(cRes.data);
      setEvents(eRes.data);
      setGenerators(gRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed ── */
  const genName = (id) => generators.find(g => g.id === id)?.name || '—';
  const activeRegs = regulators.filter(r => r.enabled).length;
  const agcCount = regulators.filter(r => r.mode === 'AGC').length;
  const pendingCmds = emsCommands.filter(c => c.status === 'received' || c.status === 'acknowledged' || c.status === 'executing').length;
  const criticalEvts = events.filter(e => e.severity === 'critical' && !e.autoResolved).length;
  const recentEvents = events.filter(e => (Date.now() - new Date(e.createdAt).getTime()) < 24 * 3600 * 1000);

  const q = search.toLowerCase();
  const filteredRegs = regulators.filter(r => !q || genName(r.generatorId).toLowerCase().includes(q) || r.regulationType?.toLowerCase().includes(q) || r.mode?.toLowerCase().includes(q));
  const filteredCmds = emsCommands.filter(c => !q || c.commandType?.toLowerCase().includes(q) || genName(c.targetGeneratorId).toLowerCase().includes(q) || c.sourceSystem?.toLowerCase().includes(q));
  const filteredEvts = events.filter(e => !q || e.eventType?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.affectedZone?.toLowerCase().includes(q));

  // Supply/demand balance from regulators
  const supplyDemand = useMemo(() => {
    const totalOutput = regulators.reduce((s, r) => s + (parseFloat(r.currentOutput) || 0), 0);
    const totalSetpoint = regulators.reduce((s, r) => s + (parseFloat(r.setpoint) || 0), 0);
    return { totalOutput, totalSetpoint, balance: totalOutput - totalSetpoint };
  }, [regulators]);

  /* ── Regulator CRUD ── */
  function openNewReg() { setForm({ ...emptyRegulator }); setRegModal('new'); }
  function openEditReg(r) {
    setForm({
      generatorId: r.generatorId || '', regulationType: r.regulationType || 'frequency',
      mode: r.mode || 'droop', droopPct: r.droopPct ?? '5',
      setpoint: r.setpoint ?? '', currentOutput: r.currentOutput ?? '',
      deadbandPct: r.deadbandPct ?? '', responseTimeMs: r.responseTimeMs ?? '',
      maxRampRate: r.maxRampRate ?? '', enabled: r.enabled ?? true, notes: r.notes || '',
    });
    setRegModal(r);
  }
  async function saveReg() {
    if (!form.generatorId) { showToast('Generator required', 'error'); return; }
    setSaving(true);
    try {
      if (regModal === 'new') await api.gridRegulators.create(form);
      else await api.gridRegulators.update(regModal.id, form);
      setRegModal(null); await load();
      showToast(regModal === 'new' ? 'Regulator added' : 'Regulator updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteReg(id) {
    if (!confirm('Delete this regulator config?')) return;
    try { await api.gridRegulators.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── EMS Command CRUD ── */
  function openNewEms() { setEForm({ ...emptyEmsCommand }); setEmsModal('new'); }
  async function saveEms() {
    if (!eForm.commandType) { showToast('Command type required', 'error'); return; }
    setSaving(true);
    try {
      if (emsModal === 'new') await api.emsCommands.create(eForm);
      else await api.emsCommands.update(emsModal.id, eForm);
      setEmsModal(null); await load();
      showToast('EMS command saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteEms(id) {
    if (!confirm('Delete this EMS command?')) return;
    try { await api.emsCommands.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Grid Event CRUD ── */
  function openNewEvt() { setVForm({ ...emptyEvent }); setEvtModal('new'); }
  async function saveEvt() {
    if (!vForm.eventType || !vForm.description) { showToast('Event type and description required', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...vForm, reportedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (evtModal === 'new') await api.gridEvents.create(body);
      else await api.gridEvents.update(evtModal.id, body);
      setEvtModal(null); await load();
      showToast('Grid event saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteEvt(id) {
    if (!confirm('Delete this grid event?')) return;
    try { await api.gridEvents.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  const fmt = (n) => { const v = parseFloat(n); return isNaN(v) ? '—' : v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(2); };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>🔗 Grid Stability & Integration</h1>
          <div className="subtitle">Supply-demand balance, frequency/voltage regulation & EMS interface</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`btn ${tab === 'regulators' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('regulators')}>Regulators</button>
          <button className={`btn ${tab === 'ems' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('ems')}>EMS Commands</button>
          <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('events')}>Grid Events</button>
          {tab === 'regulators' && <button className="btn btn-primary" onClick={openNewReg}>+ Add Regulator</button>}
          {tab === 'ems' && <button className="btn btn-primary" onClick={openNewEms}>+ New Command</button>}
          {tab === 'events' && <button className="btn btn-primary" onClick={openNewEvt}>+ Log Event</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info"><div className="value green">{activeRegs}</div><div className="label">Active Regulators</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: supplyDemand.balance >= 0 ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)' }}>
            {supplyDemand.balance >= 0 ? '⚖️' : '⚠️'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: supplyDemand.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {supplyDemand.balance >= 0 ? '+' : ''}{fmt(supplyDemand.balance)} <small style={{ fontSize: '.55em' }}>MW</small>
            </div>
            <div className="label">Supply Balance</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">📨</div>
          <div className="stat-info"><div className="value blue">{pendingCmds}</div><div className="label">Pending EMS Cmds</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: criticalEvts > 0 ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.15)' }}>
            {criticalEvts > 0 ? '🚨' : '✅'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: criticalEvts > 0 ? 'var(--danger)' : 'var(--success)' }}>{criticalEvts}</div>
            <div className="label">Critical Events</div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search regulators, commands, events..."
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
          {/* Supply / Demand Balance */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>⚖️ Supply & Demand Balance</h3>
            <div className="gs-balance-row">
              <div className="gs-balance-block">
                <div className="gs-balance-label">Total Generation</div>
                <div className="gs-balance-value" style={{ color: 'var(--success)' }}>{fmt(supplyDemand.totalOutput)} MW</div>
              </div>
              <div className="gs-balance-sep">
                <span style={{ fontSize: '1.5rem' }}>{supplyDemand.balance >= 0 ? '≥' : '<'}</span>
              </div>
              <div className="gs-balance-block">
                <div className="gs-balance-label">Total Demand (Setpoint)</div>
                <div className="gs-balance-value" style={{ color: 'var(--primary)' }}>{fmt(supplyDemand.totalSetpoint)} MW</div>
              </div>
              <div className="gs-balance-sep"><span style={{ fontSize: '1.5rem' }}>=</span></div>
              <div className="gs-balance-block">
                <div className="gs-balance-label">Balance / Reserve</div>
                <div className="gs-balance-value" style={{ color: supplyDemand.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {supplyDemand.balance >= 0 ? '+' : ''}{fmt(supplyDemand.balance)} MW
                </div>
              </div>
            </div>
          </div>

          {/* Regulator Cards */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🎛️ Active Regulation Units</h3>
            {regulators.length === 0 ? (
              <div className="empty">No regulators configured. Go to Regulators tab to add units.</div>
            ) : (
              <div className="gs-reg-grid">
                {regulators.map(r => {
                  const sp = parseFloat(r.setpoint) || 0;
                  const cur = parseFloat(r.currentOutput) || 0;
                  const pct = sp > 0 ? ((cur / sp) * 100).toFixed(0) : 0;
                  return (
                    <div key={r.id} className={`gs-reg-card ${!r.enabled ? 'gs-reg-disabled' : ''}`}>
                      <div className="gs-reg-top">
                        <strong>{genName(r.generatorId)}</strong>
                        <span className={`badge ${badgeMap[r.mode]}`}>{r.mode}</span>
                      </div>
                      <div className="gs-reg-meta">
                        <span className={`badge ${badgeMap[r.regulationType] || 'badge-gray'}`} style={{ fontSize: '.68rem' }}>{r.regulationType}</span>
                        {r.droopPct && <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Droop: {r.droopPct}%</span>}
                        {!r.enabled && <span className="badge badge-red" style={{ fontSize: '.68rem' }}>DISABLED</span>}
                      </div>
                      {sp > 0 && (
                        <div style={{ marginTop: '.5rem' }}>
                          <div className="gs-bar-track">
                            <div className="gs-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 95 ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--success)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', marginTop: '.2rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            <span>{cur} / {sp} MW</span><span>{pct}%</span>
                          </div>
                        </div>
                      )}
                      {r.responseTimeMs && <div style={{ fontSize: '.74rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>Response: {r.responseTimeMs}ms · Ramp: {r.maxRampRate || '—'} MW/min</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Critical Events */}
          {recentEvents.filter(e => e.severity !== 'info').length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>🚨 Recent Grid Events (24h)</h3>
              <div className="gs-event-list">
                {recentEvents.filter(e => e.severity !== 'info').slice(0, 10).map(e => (
                  <div key={e.id} className={`gs-event-item ${e.severity === 'critical' ? 'gs-event-critical' : 'gs-event-warning'}`}>
                    <span className="gs-event-icon">{e.severity === 'critical' ? '🚨' : '⚠️'}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{e.eventType}</strong>
                      {e.affectedZone && <> — <span style={{ color: 'var(--text-muted)' }}>{e.affectedZone}</span></>}
                      <br /><span style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>{e.description}</span>
                      {e.measuredValue && (
                        <span style={{ fontSize: '.82rem', fontFamily: 'monospace', marginLeft: '.5rem' }}>
                          Measured: {e.measuredValue} (Expected: {e.expectedValue || '—'})
                        </span>
                      )}
                    </div>
                    <span className={`badge ${badgeMap[e.severity]}`}>{e.severity}</span>
                    {e.autoResolved && <span className="badge badge-green" style={{ fontSize: '.65rem' }}>Auto-resolved</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Framework Panels */}
          <div className="gs-framework-grid">
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>〰️ Frequency Regulation</h3>
              <div className="gs-fw-list">
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>🎛️</div>
                  <div>
                    <strong>Primary Response (Governor)</strong>
                    <p>Automatic governor action within 0–30 seconds. Droop setting (typically 4–5%) determines MW response per Hz deviation. Proportional response only — does not restore frequency to nominal.</p>
                  </div>
                </div>
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>⏱️</div>
                  <div>
                    <strong>Secondary Response (AGC / LFC)</strong>
                    <p>Automatic Generation Control corrects frequency within 30s–15min. Adjusts unit setpoints to eliminate Area Control Error (ACE). Restores frequency to 50.00 Hz and scheduled tie-line flows.</p>
                  </div>
                </div>
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>📊</div>
                  <div>
                    <strong>Tertiary / Economic Dispatch</strong>
                    <p>15min–1hr timeframe. Re-optimizes generation stack for economics while maintaining reserves. Coordinates unit commitment, startup/shutdown decisions, and inter-area transfers.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>⚡ Voltage Regulation</h3>
              <div className="gs-fw-list">
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>🔋</div>
                  <div>
                    <strong>AVR (Automatic Voltage Regulator)</strong>
                    <p>Controls generator excitation to maintain terminal voltage within ±0.5%. Response time ≤200ms. Operates in voltage control or reactive power (VAr) control mode.</p>
                  </div>
                </div>
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(234,179,8,.15)', color: '#eab308' }}>🔀</div>
                  <div>
                    <strong>OLTC (On-Load Tap Changer)</strong>
                    <p>Transformer tap adjustment under load. ±10% voltage range in 1.25–1.67% steps. 3–10 second tap change time. Automatic Voltage Relay (AVRy) controls target bus voltage.</p>
                  </div>
                </div>
                <div className="gs-fw-item">
                  <div className="gs-fw-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>💡</div>
                  <div>
                    <strong>Reactive Power Compensation</strong>
                    <p>Capacitor banks for lagging PF correction, reactors for leading PF. SVCs / STATCOMs for dynamic ±MVAr support. Target power factor ≥0.95 at point of common coupling.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* EMS Integration */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🏢 EMS Integration Standards</h3>
            <table>
              <thead>
                <tr><th>Standard</th><th>Protocol</th><th>Function</th><th>Typical Latency</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>IEC 61970 (CIM)</strong></td>
                  <td>Common Information Model</td>
                  <td>Data exchange between EMS, SCADA, GIS. Defines power system object model.</td>
                  <td style={{ fontFamily: 'monospace' }}>N/A (data model)</td>
                </tr>
                <tr>
                  <td><strong>IEC 61968</strong></td>
                  <td>CIM for DMS</td>
                  <td>Distribution Management System interface. Outage management, asset data, metering.</td>
                  <td style={{ fontFamily: 'monospace' }}>1–5 s</td>
                </tr>
                <tr>
                  <td><strong>ICCP / TASE.2</strong></td>
                  <td>IEC 60870-6</td>
                  <td>Inter-control center communications. Real-time data exchange between utilities.</td>
                  <td style={{ fontFamily: 'monospace' }}>100–500 ms</td>
                </tr>
                <tr>
                  <td><strong>DNP3</strong></td>
                  <td>IEEE 1815</td>
                  <td>SCADA to RTU/IED communication. Telemetry, commands, event reporting.</td>
                  <td style={{ fontFamily: 'monospace' }}>50–200 ms</td>
                </tr>
                <tr>
                  <td><strong>IEC 61850</strong></td>
                  <td>GOOSE / MMS</td>
                  <td>Substation automation. High-speed peer-to-peer protection messaging.</td>
                  <td style={{ fontFamily: 'monospace' }}>≤4 ms (GOOSE)</td>
                </tr>
                <tr>
                  <td><strong>OpenADR 2.0</strong></td>
                  <td>REST / XMPP</td>
                  <td>Automated Demand Response signaling. Load curtailment, pricing signals.</td>
                  <td style={{ fontFamily: 'monospace' }}>1–10 s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          REGULATORS TAB
         ═══════════════════════════════════════ */}
      {tab === 'regulators' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredRegs.length === 0 ? <div className="empty">No regulator configurations.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Generator</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Droop</th>
                    <th>Setpoint</th>
                    <th>Output</th>
                    <th>Deadband</th>
                    <th>Response</th>
                    <th>Ramp Rate</th>
                    <th>Enabled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegs.map(r => (
                    <tr key={r.id} style={!r.enabled ? { opacity: .55 } : {}}>
                      <td><strong>{genName(r.generatorId)}</strong></td>
                      <td><span className={`badge ${badgeMap[r.regulationType] || 'badge-gray'}`}>{r.regulationType}</span></td>
                      <td><span className={`badge ${badgeMap[r.mode]}`}>{r.mode}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{r.droopPct ? `${r.droopPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.setpoint ?? '—'} MW</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>{r.currentOutput ?? '—'} MW</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.deadbandPct ? `±${r.deadbandPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.responseTimeMs ? `${r.responseTimeMs}ms` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.maxRampRate ? `${r.maxRampRate} MW/min` : '—'}</td>
                      <td>{r.enabled ? <span className="badge badge-green">ON</span> : <span className="badge badge-red">OFF</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditReg(r)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteReg(r.id)}>Del</button>
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
          EMS COMMANDS TAB
         ═══════════════════════════════════════ */}
      {tab === 'ems' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredCmds.length === 0 ? <div className="empty">No EMS commands recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Command</th>
                    <th>Target</th>
                    <th>Target Value</th>
                    <th>Executed Value</th>
                    <th>Source</th>
                    <th>Priority</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCmds.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
                      <td><span className="badge badge-blue">{c.commandType}</span></td>
                      <td><strong>{genName(c.targetGeneratorId)}</strong></td>
                      <td style={{ fontFamily: 'monospace' }}>{c.targetValue || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>{c.executedValue || '—'}</td>
                      <td style={{ fontSize: '.82rem' }}>{c.sourceSystem || '—'}</td>
                      <td><span className={`badge ${c.priority === 'high' ? 'badge-red' : c.priority === 'normal' ? 'badge-blue' : 'badge-gray'}`}>{c.priority}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{c.responseDeadlineSec ? `${c.responseDeadlineSec}s` : '—'}</td>
                      <td><span className={`badge ${badgeMap[c.status]}`}>{c.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteEms(c.id)}>Del</button>
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
          GRID EVENTS TAB
         ═══════════════════════════════════════ */}
      {tab === 'events' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredEvts.length === 0 ? <div className="empty">No grid events recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event Type</th>
                    <th>Severity</th>
                    <th>Measured</th>
                    <th>Expected</th>
                    <th>Deviation</th>
                    <th>Zone</th>
                    <th>Description</th>
                    <th>Auto-Resolved</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvts.map(e => (
                    <tr key={e.id} style={e.severity === 'critical' ? { background: 'rgba(239,68,68,.05)' } : {}}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                      <td><span className="badge badge-blue">{e.eventType}</span></td>
                      <td><span className={`badge ${badgeMap[e.severity]}`}>{e.severity}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{e.measuredValue || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{e.expectedValue || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: e.deviationPct && parseFloat(e.deviationPct) > 5 ? 'var(--danger)' : 'var(--text)' }}>
                        {e.deviationPct ? `${e.deviationPct}%` : '—'}
                      </td>
                      <td style={{ fontSize: '.82rem' }}>{e.affectedZone || '—'}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{e.description}</td>
                      <td>{e.autoResolved ? <span className="badge badge-green">✓ Yes</span> : <span className="badge badge-gray">No</span>}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteEvt(e.id)}>Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          REGULATOR MODAL
         ═══════════════════════════════════════ */}
      {regModal && (
        <div className="modal-overlay" onClick={() => setRegModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{regModal === 'new' ? '🎛️ Add Regulator Config' : '🎛️ Edit Regulator'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Generator *</label>
                <select value={form.generatorId} onChange={e => set('generatorId', e.target.value)}>
                  <option value="">Select generator...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Regulation Type</label>
                <select value={form.regulationType} onChange={e => set('regulationType', e.target.value)}>
                  {SIGNAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Mode</label>
                <select value={form.mode} onChange={e => set('mode', e.target.value)}>
                  {REG_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Droop %</label>
                <input type="number" step="0.1" value={form.droopPct} onChange={e => set('droopPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Setpoint (MW)</label>
                <input type="number" step="0.1" value={form.setpoint} onChange={e => set('setpoint', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Current Output (MW)</label>
                <input type="number" step="0.1" value={form.currentOutput} onChange={e => set('currentOutput', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Deadband %</label>
                <input type="number" step="0.01" value={form.deadbandPct} onChange={e => set('deadbandPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Response Time (ms)</label>
                <input type="number" value={form.responseTimeMs} onChange={e => set('responseTimeMs', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Max Ramp Rate (MW/min)</label>
                <input type="number" step="0.1" value={form.maxRampRate} onChange={e => set('maxRampRate', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
                Enabled
              </label>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRegModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReg} disabled={saving || !form.generatorId}>
                {saving ? 'Saving...' : regModal === 'new' ? 'Add Regulator' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          EMS COMMAND MODAL
         ═══════════════════════════════════════ */}
      {emsModal && (
        <div className="modal-overlay" onClick={() => setEmsModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📨 {emsModal === 'new' ? 'New EMS Command' : 'Edit EMS Command'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Command Type *</label>
                <select value={eForm.commandType} onChange={e => setE('commandType', e.target.value)}>
                  {EMS_CMD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Generator</label>
                <select value={eForm.targetGeneratorId} onChange={e => setE('targetGeneratorId', e.target.value)}>
                  <option value="">Select...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={eForm.status} onChange={e => setE('status', e.target.value)}>
                  {EMS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Target Value</label>
                <input value={eForm.targetValue} onChange={e => setE('targetValue', e.target.value)} placeholder="e.g. 120 MW, 50.02 Hz" />
              </div>
              <div className="form-group">
                <label>Executed Value</label>
                <input value={eForm.executedValue} onChange={e => setE('executedValue', e.target.value)} placeholder="Actual achieved value" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Source System</label>
                <input value={eForm.sourceSystem} onChange={e => setE('sourceSystem', e.target.value)} placeholder="e.g. National Grid EMS, ISO dispatch" />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={eForm.priority} onChange={e => setE('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label>Response Deadline (sec)</label>
                <input type="number" value={eForm.responseDeadlineSec} onChange={e => setE('responseDeadlineSec', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={eForm.notes} onChange={e => setE('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEmsModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEms} disabled={saving}>
                {saving ? 'Saving...' : emsModal === 'new' ? 'Create Command' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          GRID EVENT MODAL
         ═══════════════════════════════════════ */}
      {evtModal && (
        <div className="modal-overlay" onClick={() => setEvtModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🚨 {evtModal === 'new' ? 'Log Grid Event' : 'Edit Grid Event'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Event Type *</label>
                <select value={vForm.eventType} onChange={e => setV('eventType', e.target.value)}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={vForm.severity} onChange={e => setV('severity', e.target.value)}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Affected Zone</label>
                <input value={vForm.affectedZone} onChange={e => setV('affectedZone', e.target.value)} placeholder="e.g. Bus A, Feeder 3, Tie-Line N-S" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Measured Value</label>
                <input value={vForm.measuredValue} onChange={e => setV('measuredValue', e.target.value)} placeholder="e.g. 49.3 Hz, 10.2 kV" />
              </div>
              <div className="form-group">
                <label>Expected Value</label>
                <input value={vForm.expectedValue} onChange={e => setV('expectedValue', e.target.value)} placeholder="e.g. 50.0 Hz, 11.0 kV" />
              </div>
              <div className="form-group">
                <label>Deviation %</label>
                <input type="number" step="0.1" value={vForm.deviationPct} onChange={e => setV('deviationPct', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={vForm.description} onChange={e => setV('description', e.target.value)} placeholder="Describe the grid event..." />
            </div>
            <div className="form-group">
              <label>Correction Action Taken</label>
              <textarea value={vForm.correctionAction} onChange={e => setV('correctionAction', e.target.value)} rows={2} placeholder="e.g. AGC increased GT-01 setpoint by 5 MW..." />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <input type="checkbox" checked={vForm.autoResolved} onChange={e => setV('autoResolved', e.target.checked)} />
                Auto-resolved by control system
              </label>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={vForm.notes} onChange={e => setV('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEvtModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEvt} disabled={saving || !vForm.eventType || !vForm.description}>
                {saving ? 'Saving...' : evtModal === 'new' ? 'Log Event' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
