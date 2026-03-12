import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Protection types & categories ── */
const PROTECTION_TYPES = ['overload', 'short-circuit', 'voltage', 'frequency', 'differential', 'earth-fault', 'thermal', 'diesel-safety', 'fire', 'gas-detection'];
const CATEGORIES = ['Electrical Protection', 'Mechanical Safety', 'Diesel Engine Safety', 'Fire & Gas Detection', 'Compliance & Standards'];
const STATUSES = ['active', 'tripped', 'bypassed', 'faulty', 'testing', 'maintenance'];
const STANDARDS = ['IEC 61850', 'IEC 60255', 'IEEE C37', 'NFPA 70E', 'OSHA 1910', 'ISO 45001', 'IEC 61511 (SIL)', 'NFPA 850', 'API 670'];

const statusBadge = {
  active: 'badge-green', tripped: 'badge-red', bypassed: 'badge-yellow',
  faulty: 'badge-red', testing: 'badge-blue', maintenance: 'badge-orange',
};
const typeBadge = {
  overload: 'badge-yellow', 'short-circuit': 'badge-red', voltage: 'badge-blue',
  frequency: 'badge-purple', differential: 'badge-orange', 'earth-fault': 'badge-red',
  thermal: 'badge-yellow', 'diesel-safety': 'badge-orange', fire: 'badge-red', 'gas-detection': 'badge-purple',
};

const emptyDevice = {
  name: '', protectionType: 'overload', category: 'Electrical Protection',
  assetId: '', location: '', status: 'active', setPoint: '',
  tripValue: '', standard: '', lastTestedDate: '', nextTestDate: '',
  manufacturer: '', model: '', notes: '',
};

const emptyIncident = {
  protectionDeviceId: '', incidentType: 'trip',
  description: '', severity: 'medium', actionTaken: '', resolvedBy: '',
};

export default function ProtectionSafety() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('devices');
  const [modal, setModal] = useState(null);
  const [incidentModal, setIncidentModal] = useState(null);
  const [form, setForm] = useState(emptyDevice);
  const [incForm, setIncForm] = useState(emptyIncident);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    try {
      const [devRes, incRes, assetsRes] = await Promise.all([
        api.protectionDevices.list(500).catch(() => ({ data: [] })),
        api.safetyIncidents.list(500).catch(() => ({ data: [] })),
        api.assets.list(1000).catch(() => ({ data: [] })),
      ]);
      setDevices(devRes.data);
      setIncidents(incRes.data);
      setAssets(assetsRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setI = (k, v) => setIncForm(prev => ({ ...prev, [k]: v }));

  /* ── Device CRUD ── */
  function openNewDevice() { setForm(emptyDevice); setModal('new'); }

  function openEditDevice(d) {
    setForm({
      name: d.name || '', protectionType: d.protectionType || 'overload',
      category: d.category || 'Electrical Protection', assetId: d.assetId || '',
      location: d.location || '', status: d.status || 'active',
      setPoint: d.setPoint || '', tripValue: d.tripValue || '',
      standard: d.standard || '', lastTestedDate: d.lastTestedDate ? d.lastTestedDate.slice(0, 10) : '',
      nextTestDate: d.nextTestDate ? d.nextTestDate.slice(0, 10) : '',
      manufacturer: d.manufacturer || '', model: d.model || '', notes: d.notes || '',
    });
    setModal(d);
  }

  async function saveDevice() {
    if (!form.name) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...form };
      if (body.lastTestedDate) body.lastTestedDate = new Date(body.lastTestedDate).toISOString();
      if (body.nextTestDate) body.nextTestDate = new Date(body.nextTestDate).toISOString();
      if (modal === 'new') await api.protectionDevices.create(body);
      else await api.protectionDevices.update(modal.id, body);
      setModal(null); await load();
      showToast(modal === 'new' ? 'Protection device added' : 'Device updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteDevice(id) {
    if (!confirm('Delete this protection device?')) return;
    try { await api.protectionDevices.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Incident CRUD ── */
  function openNewIncident() { setIncForm({ ...emptyIncident }); setIncidentModal('new'); }

  async function saveIncident() {
    if (!incForm.protectionDeviceId || !incForm.description) { showToast('Device and description are required', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...incForm, reportedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (incidentModal === 'new') await api.safetyIncidents.create(body);
      else await api.safetyIncidents.update(incidentModal.id, body);
      setIncidentModal(null); await load();
      showToast('Incident logged');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteIncident(id) {
    if (!confirm('Delete this incident record?')) return;
    try { await api.safetyIncidents.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Counts ── */
  const counts = {
    total: devices.length,
    active: devices.filter(d => d.status === 'active').length,
    tripped: devices.filter(d => d.status === 'tripped').length,
    bypassed: devices.filter(d => d.status === 'bypassed').length,
    faulty: devices.filter(d => d.status === 'faulty').length,
  };

  const filteredDevices = devices.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name?.toLowerCase().includes(q) || d.protectionType?.toLowerCase().includes(q) ||
      d.category?.toLowerCase().includes(q) || d.location?.toLowerCase().includes(q) || d.standard?.toLowerCase().includes(q);
  });

  const filteredIncidents = incidents.filter(i => {
    const q = search.toLowerCase();
    const dev = devices.find(d => d.id === i.protectionDeviceId);
    return !q || i.description?.toLowerCase().includes(q) || i.severity?.toLowerCase().includes(q) ||
      dev?.name?.toLowerCase().includes(q);
  });

  const getDeviceName = (id) => devices.find(d => d.id === id)?.name || '—';

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>🛡️ Protection & Safety</h1>
          <div className="subtitle">Overload, short-circuit, voltage/frequency protection & safety compliance</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className={`btn ${tab === 'devices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('devices')}>
            Protection Devices
          </button>
          <button className={`btn ${tab === 'incidents' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('incidents')}>
            Safety Incidents
          </button>
          <button className={`btn ${tab === 'compliance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('compliance')}>
            Compliance
          </button>
          {tab === 'devices' && <button className="btn btn-primary" onClick={openNewDevice}>+ Add Device</button>}
          {tab === 'incidents' && <button className="btn btn-primary" onClick={openNewIncident}>+ Log Incident</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon blue">🛡️</div>
          <div className="stat-info"><div className="value blue">{counts.total}</div><div className="label">Total Devices</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info"><div className="value green">{counts.active}</div><div className="label">Active / Normal</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,.15)' }}>⚡</div>
          <div className="stat-info"><div className="value" style={{ color: 'var(--danger)' }}>{counts.tripped}</div><div className="label">Tripped</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon orange">⚠️</div>
          <div className="stat-info"><div className="value orange">{counts.bypassed + counts.faulty}</div><div className="label">Bypassed / Faulty</div></div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search by name, type, category, location, standard..."
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
          DEVICES TAB
         ═══════════════════════════════════════ */}
      {tab === 'devices' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredDevices.length === 0 ? <div className="empty">No protection devices found.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Asset</th>
                    <th>Location</th>
                    <th>Set Point</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map(d => {
                    const asset = assets.find(a => a.id === d.assetId);
                    return (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.name}</strong>
                          {d.manufacturer && <br />}
                          {d.manufacturer && <small style={{ color: 'var(--text-muted)' }}>{d.manufacturer}{d.model ? ` — ${d.model}` : ''}</small>}
                        </td>
                        <td><span className={`badge ${typeBadge[d.protectionType] || 'badge-gray'}`}>{d.protectionType}</span></td>
                        <td style={{ fontSize: '.82rem' }}>{d.category || '—'}</td>
                        <td style={{ fontSize: '.82rem' }}>{asset?.name || '—'}</td>
                        <td style={{ fontSize: '.82rem' }}>{d.location || '—'}</td>
                        <td style={{ fontSize: '.82rem', fontFamily: 'monospace' }}>
                          {d.setPoint || '—'}
                          {d.tripValue && <><br /><small style={{ color: 'var(--text-muted)' }}>Trip: {d.tripValue}</small></>}
                        </td>
                        <td><span className="badge badge-blue" style={{ fontSize: '.7rem' }}>{d.standard || '—'}</span></td>
                        <td><span className={`badge ${statusBadge[d.status]}`}>{d.status}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => openEditDevice(d)}>Edit</button>{' '}
                          <button className="btn btn-sm btn-danger" onClick={() => deleteDevice(d.id)}>Delete</button>
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
          INCIDENTS TAB
         ═══════════════════════════════════════ */}
      {tab === 'incidents' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredIncidents.length === 0 ? <div className="empty">No safety incidents recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Severity</th>
                    <th>Action Taken</th>
                    <th>Resolved By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '—'}</td>
                      <td><strong>{getDeviceName(i.protectionDeviceId)}</strong></td>
                      <td><span className={`badge ${i.incidentType === 'trip' ? 'badge-red' : i.incidentType === 'alarm' ? 'badge-yellow' : 'badge-blue'}`}>{i.incidentType}</span></td>
                      <td style={{ fontSize: '.85rem', maxWidth: '280px' }}>{i.description}</td>
                      <td><span className={`badge ${i.severity === 'critical' ? 'badge-red' : i.severity === 'high' ? 'badge-orange' : i.severity === 'medium' ? 'badge-yellow' : 'badge-green'}`}>{i.severity}</span></td>
                      <td style={{ fontSize: '.82rem' }}>{i.actionTaken || '—'}</td>
                      <td style={{ fontSize: '.82rem' }}>{i.resolvedBy || '—'}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteIncident(i.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          COMPLIANCE TAB
         ═══════════════════════════════════════ */}
      {tab === 'compliance' && (
        <div>
          {/* Compliance overview */}
          <div className="ps-compliance-grid">
            {/* Electrical Protection Standards */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>⚡ Electrical Protection</h3>
              <div className="ps-std-list">
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>🔌</div>
                  <div>
                    <strong>Overload Protection</strong>
                    <p>Thermal overload relays (ANSI 49), inverse-time overcurrent relays (ANSI 51) on all motors, generators, and transformers. Settings based on equipment rated current with coordination studies.</p>
                    <span className="badge badge-blue">IEC 60255 / IEEE C37.112</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>⚡</div>
                  <div>
                    <strong>Short-Circuit Protection</strong>
                    <p>Instantaneous overcurrent relays (ANSI 50), differential protection (ANSI 87) for generators and transformers. Fault current calculations per IEC 60909. Circuit breaker ratings verified against prospective fault levels.</p>
                    <span className="badge badge-red">IEC 60909 / IEEE C37</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>📊</div>
                  <div>
                    <strong>Voltage Protection</strong>
                    <p>Under/over voltage relays (ANSI 27/59) on all bus sections. Generator voltage regulator protection. Transformer tap changer protection. Settings: ±10% of nominal voltage.</p>
                    <span className="badge badge-purple">IEC 60255-27 / IEEE C37.102</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>🔄</div>
                  <div>
                    <strong>Frequency Protection</strong>
                    <p>Under/over frequency relays (ANSI 81U/81O) for generator and grid protection. Rate-of-change-of-frequency (ROCOF) protection. Trip settings: 47.5 Hz (under) / 51.5 Hz (over) with time delays per grid code.</p>
                    <span className="badge badge-orange">IEC 60255 / Grid Code Requirements</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diesel Engine Safety */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>🛢️ Diesel Engine Safety</h3>
              <div className="ps-std-list">
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(234,179,8,.15)', color: 'var(--warning)' }}>🌡️</div>
                  <div>
                    <strong>Engine Overspeed Protection</strong>
                    <p>Mechanical and electronic overspeed trip — activates at 110% rated RPM. Spring-loaded fuel cutoff mechanism as primary shutdown. Electronic backup via speed sensor.</p>
                    <span className="badge badge-yellow">ISO 3046 / NFPA 110</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>🛢️</div>
                  <div>
                    <strong>Low Oil Pressure Shutdown</strong>
                    <p>Pressure switch on lube oil main header. Alarm at 2.0 bar, trip at 1.5 bar. Pre-lube system ensures adequate pressure before engine start. Oil temperature monitoring included.</p>
                    <span className="badge badge-red">API 670 / ISO 7-1</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>🔥</div>
                  <div>
                    <strong>High Coolant Temperature</strong>
                    <p>RTD sensors on engine block and coolant outlet. Alarm at 95°C, trip at 105°C. Redundant sensors with 2-out-of-3 voting logic for trip reliability.</p>
                    <span className="badge badge-orange">ISO 8528-12</span>
                  </div>
                </div>
                <div className="ps-std-item">
                  <div className="ps-std-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>💨</div>
                  <div>
                    <strong>Exhaust Temperature Monitoring</strong>
                    <p>Thermocouple on each exhaust manifold port. High exhaust temp alarm per cylinder for early detection of injection or valve issues. Differential temperature alarm between cylinders.</p>
                    <span className="badge badge-blue">ISO 8528 / API 670</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Industrial Safety Compliance */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>📋 Industrial Safety Standards & Compliance</h3>
              <div className="ps-compliance-table">
                <table>
                  <thead>
                    <tr>
                      <th>Standard</th>
                      <th>Title</th>
                      <th>Scope / Application</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="badge badge-blue">IEC 61850</span></td>
                      <td>Communication Networks & Systems in Substations</td>
                      <td>Substation automation, protection relay communication, GOOSE messaging</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">IEC 60255</span></td>
                      <td>Measuring Relays and Protection Equipment</td>
                      <td>All numerical protection relays — overcurrent, voltage, frequency, differential</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">IEEE C37</span></td>
                      <td>Power System Relaying & Circuit Breakers</td>
                      <td>Circuit breaker ratings, relay coordination studies, protection schemes</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">NFPA 70E</span></td>
                      <td>Standard for Electrical Safety in the Workplace</td>
                      <td>Arc flash hazard analysis, PPE requirements, energized work permits, LOTO procedures</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">OSHA 1910</span></td>
                      <td>General Industry Safety Standards</td>
                      <td>Lockout/tagout (1910.147), electrical safety (1910.303-399), machine guarding</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">ISO 45001</span></td>
                      <td>Occupational Health & Safety Management</td>
                      <td>Safety management system, risk assessment, incident investigation, worker participation</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">IEC 61511</span></td>
                      <td>Safety Instrumented Systems (SIS) — SIL</td>
                      <td>SIL assessment for critical protective functions (BMS, ESD, fire & gas systems)</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">NFPA 850</span></td>
                      <td>Fire Protection for Electric Generating Plants</td>
                      <td>Fire detection & suppression, hydrogen sealing, transformer deluge, cable tray protection</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                    <tr>
                      <td><span className="badge badge-blue">API 670</span></td>
                      <td>Machinery Protection Systems</td>
                      <td>Vibration monitoring, bearing temperature, axial displacement for rotating machinery</td>
                      <td><span className="badge badge-green">Compliant</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Test Schedule */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>📅 Protection Device Test Schedule</h3>
            {devices.filter(d => d.nextTestDate).length === 0 ? (
              <div className="empty">No test dates scheduled. Add protection devices with test dates to see them here.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Device</th><th>Type</th><th>Last Tested</th><th>Next Test Due</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {devices.filter(d => d.nextTestDate).sort((a, b) => new Date(a.nextTestDate) - new Date(b.nextTestDate)).map(d => {
                    const due = new Date(d.nextTestDate);
                    const overdue = due < new Date();
                    return (
                      <tr key={d.id}>
                        <td><strong>{d.name}</strong></td>
                        <td><span className={`badge ${typeBadge[d.protectionType] || 'badge-gray'}`}>{d.protectionType}</span></td>
                        <td>{d.lastTestedDate ? new Date(d.lastTestedDate).toLocaleDateString() : '—'}</td>
                        <td style={{ color: overdue ? 'var(--danger)' : 'inherit', fontWeight: overdue ? 700 : 400 }}>
                          {due.toLocaleDateString()} {overdue && <span className="badge badge-red">OVERDUE</span>}
                        </td>
                        <td><span className={`badge ${statusBadge[d.status]}`}>{d.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          DEVICE MODAL
         ═══════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <h2>{modal === 'new' ? '🛡️ Add Protection Device' : '🛡️ Edit Protection Device'}</h2>
            <div className="form-group">
              <label>Device Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Overcurrent Relay 51-1A" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Protection Type *</label>
                <select value={form.protectionType} onChange={e => set('protectionType', e.target.value)}>
                  {PROTECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Protected Asset</label>
                <select value={form.assetId} onChange={e => {
                  set('assetId', e.target.value);
                  const a = assets.find(x => x.id === e.target.value);
                  if (a?.location) set('location', a.location);
                }}>
                  <option value="">Select asset...</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.location ? ` — ${a.location}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Set Point / Setting</label>
                <input value={form.setPoint} onChange={e => set('setPoint', e.target.value)} placeholder="e.g. 1.2 × In, 120% rated" />
              </div>
              <div className="form-group">
                <label>Trip Value</label>
                <input value={form.tripValue} onChange={e => set('tripValue', e.target.value)} placeholder="e.g. 1500A @ 0.3s" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Applicable Standard</label>
                <select value={form.standard} onChange={e => set('standard', e.target.value)}>
                  <option value="">Select standard...</option>
                  {STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Last Tested</label>
                <input type="date" value={form.lastTestedDate} onChange={e => set('lastTestedDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Next Test Date</label>
                <input type="date" value={form.nextTestDate} onChange={e => set('nextTestDate', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Manufacturer</label>
                <input value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. ABB, Siemens, SEL" />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. REF615, 7SJ82" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDevice} disabled={saving || !form.name}>
                {saving ? 'Saving...' : modal === 'new' ? 'Add Device' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          INCIDENT MODAL
         ═══════════════════════════════════════ */}
      {incidentModal && (
        <div className="modal-overlay" onClick={() => setIncidentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🚨 Log Safety Incident</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Protection Device *</label>
                <select value={incForm.protectionDeviceId} onChange={e => setI('protectionDeviceId', e.target.value)}>
                  <option value="">Select device...</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.protectionType})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Incident Type</label>
                <select value={incForm.incidentType} onChange={e => setI('incidentType', e.target.value)}>
                  <option value="trip">Trip / Shutdown</option>
                  <option value="alarm">Alarm</option>
                  <option value="bypass">Bypass Event</option>
                  <option value="failure">Device Failure</option>
                  <option value="test">Test Result</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={incForm.description} onChange={e => setI('description', e.target.value)} placeholder="Describe what happened..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Severity</label>
                <select value={incForm.severity} onChange={e => setI('severity', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Resolved By</label>
                <input value={incForm.resolvedBy} onChange={e => setI('resolvedBy', e.target.value)} placeholder="Technician name" />
              </div>
            </div>
            <div className="form-group">
              <label>Action Taken</label>
              <textarea value={incForm.actionTaken} onChange={e => setI('actionTaken', e.target.value)} rows={2} placeholder="Describe corrective action..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIncidentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveIncident} disabled={saving || !incForm.protectionDeviceId || !incForm.description}>
                {saving ? 'Saving...' : 'Log Incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
