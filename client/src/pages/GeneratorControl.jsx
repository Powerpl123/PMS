import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Constants ── */
const GEN_STATUSES = ['stopped', 'starting', 'running', 'synchronizing', 'synchronized', 'stopping', 'tripped', 'maintenance'];
const SYNC_STATUSES = ['pending', 'in-progress', 'completed', 'failed', 'cancelled'];
const TRANSFER_STATUSES = ['pending', 'in-progress', 'completed', 'failed', 'cancelled'];
const TRANSFER_TYPES = ['load-pickup', 'load-shed', 'unit-transfer', 'island-to-grid', 'grid-to-island', 'emergency'];
const SYNC_METHODS = ['manual', 'auto-sync', 'check-sync', 'dead-bus'];

const statusBadge = {
  stopped: 'badge-gray', starting: 'badge-yellow', running: 'badge-green',
  synchronizing: 'badge-blue', synchronized: 'badge-green', stopping: 'badge-yellow',
  tripped: 'badge-red', maintenance: 'badge-orange',
  pending: 'badge-gray', 'in-progress': 'badge-blue', completed: 'badge-green',
  failed: 'badge-red', cancelled: 'badge-orange',
  'load-pickup': 'badge-green', 'load-shed': 'badge-yellow', 'unit-transfer': 'badge-blue',
  'island-to-grid': 'badge-purple', 'grid-to-island': 'badge-orange', emergency: 'badge-red',
};

const emptyGenerator = {
  name: '', assetId: '', location: '', ratedCapacityMw: '', currentLoadMw: '',
  voltagekV: '', frequencyHz: '', powerFactor: '', status: 'stopped',
  fuelType: 'diesel', startMode: 'auto', priority: 1, notes: '',
};

const emptySyncEvent = {
  generatorId: '', targetBus: '', syncMethod: 'auto-sync',
  voltageMatchPct: '', freqMatchHz: '', phaseAngleDeg: '',
  status: 'pending', notes: '',
};

const emptyTransfer = {
  sourceGeneratorId: '', targetGeneratorId: '', transferType: 'unit-transfer',
  loadMw: '', rampRateMwMin: '', status: 'pending',
  reason: '', notes: '',
};

export default function GeneratorControl() {
  const { user } = useAuth();
  const [generators, setGenerators] = useState([]);
  const [syncEvents, setSyncEvents] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('generators');
  const [modal, setModal] = useState(null);   // null | 'new' | generator obj
  const [syncModal, setSyncModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [form, setForm] = useState(emptyGenerator);
  const [syncForm, setSyncForm] = useState(emptySyncEvent);
  const [tForm, setTForm] = useState(emptyTransfer);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setS = (k, v) => setSyncForm(p => ({ ...p, [k]: v }));
  const setT = (k, v) => setTForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [gRes, sRes, tRes, aRes] = await Promise.all([
        api.generators.list(500).catch(() => ({ data: [] })),
        api.syncEvents.list(500).catch(() => ({ data: [] })),
        api.loadTransfers.list(500).catch(() => ({ data: [] })),
        api.assets.list(1000).catch(() => ({ data: [] })),
      ]);
      setGenerators(gRes.data);
      setSyncEvents(sRes.data);
      setTransfers(tRes.data);
      setAssets(aRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Generator CRUD ── */
  function openNewGen() { setForm({ ...emptyGenerator }); setModal('new'); }

  function openEditGen(g) {
    setForm({
      name: g.name || '', assetId: g.assetId || '', location: g.location || '',
      ratedCapacityMw: g.ratedCapacityMw || '', currentLoadMw: g.currentLoadMw || '',
      voltagekV: g.voltagekV || '', frequencyHz: g.frequencyHz || '',
      powerFactor: g.powerFactor || '', status: g.status || 'stopped',
      fuelType: g.fuelType || 'diesel', startMode: g.startMode || 'auto',
      priority: g.priority ?? 1, notes: g.notes || '',
    });
    setModal(g);
  }

  async function saveGenerator() {
    if (!form.name) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (modal === 'new') await api.generators.create(form);
      else await api.generators.update(modal.id, form);
      setModal(null); await load();
      showToast(modal === 'new' ? 'Generator added' : 'Generator updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteGenerator(id) {
    if (!confirm('Delete this generator?')) return;
    try { await api.generators.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* Quick status change */
  async function changeGenStatus(gen, newStatus) {
    try {
      await api.generators.update(gen.id, { status: newStatus });
      load();
      showToast(`${gen.name} → ${newStatus}`);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Sync CRUD ── */
  function openNewSync() { setSyncForm({ ...emptySyncEvent }); setSyncModal('new'); }

  async function saveSync() {
    if (!syncForm.generatorId) { showToast('Select a generator', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...syncForm, initiatedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (syncModal === 'new') await api.syncEvents.create(body);
      else await api.syncEvents.update(syncModal.id, body);
      setSyncModal(null); await load();
      showToast('Sync event saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteSync(id) {
    if (!confirm('Delete this sync event?')) return;
    try { await api.syncEvents.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Transfer CRUD ── */
  function openNewTransfer() { setTForm({ ...emptyTransfer }); setTransferModal('new'); }

  async function saveTransfer() {
    if (!tForm.sourceGeneratorId) { showToast('Select source generator', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...tForm, initiatedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (transferModal === 'new') await api.loadTransfers.create(body);
      else await api.loadTransfers.update(transferModal.id, body);
      setTransferModal(null); await load();
      showToast('Load transfer saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteTransfer(id) {
    if (!confirm('Delete this load transfer?')) return;
    try { await api.loadTransfers.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Computed values ── */
  const totalCapacity = generators.reduce((s, g) => s + (parseFloat(g.ratedCapacityMw) || 0), 0);
  const totalLoad = generators.filter(g => g.status === 'running' || g.status === 'synchronized')
    .reduce((s, g) => s + (parseFloat(g.currentLoadMw) || 0), 0);
  const runningCount = generators.filter(g => g.status === 'running' || g.status === 'synchronized').length;
  const trippedCount = generators.filter(g => g.status === 'tripped').length;
  const loadPct = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100).toFixed(1) : '0.0';

  const getGenName = (id) => generators.find(g => g.id === id)?.name || '—';

  /* ── Filtering ── */
  const q = search.toLowerCase();
  const filteredGens = generators.filter(g => !q || g.name?.toLowerCase().includes(q) || g.status?.toLowerCase().includes(q) || g.location?.toLowerCase().includes(q) || g.fuelType?.toLowerCase().includes(q));
  const filteredSyncs = syncEvents.filter(e => !q || getGenName(e.generatorId).toLowerCase().includes(q) || e.status?.toLowerCase().includes(q) || e.targetBus?.toLowerCase().includes(q));
  const filteredTransfers = transfers.filter(t => !q || getGenName(t.sourceGeneratorId).toLowerCase().includes(q) || getGenName(t.targetGeneratorId).toLowerCase().includes(q) || t.transferType?.toLowerCase().includes(q));

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>🔄 Generator Control & Synchronization</h1>
          <div className="subtitle">Automatic start/stop, grid synchronization & seamless load transfer</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'generators' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('generators')}>Generators</button>
          <button className={`btn ${tab === 'sync' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('sync')}>Synchronization</button>
          <button className={`btn ${tab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('transfers')}>Load Transfers</button>
          {tab === 'generators' && <button className="btn btn-primary" onClick={openNewGen}>+ Add Generator</button>}
          {tab === 'sync' && <button className="btn btn-primary" onClick={openNewSync}>+ New Sync</button>}
          {tab === 'transfers' && <button className="btn btn-primary" onClick={openNewTransfer}>+ New Transfer</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon blue">🔄</div>
          <div className="stat-info"><div className="value blue">{generators.length}</div><div className="label">Total Generators</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">⚡</div>
          <div className="stat-info"><div className="value green">{runningCount}</div><div className="label">Running / Synced</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon orange">📊</div>
          <div className="stat-info">
            <div className="value orange">{totalLoad.toFixed(1)}<small style={{ fontSize: '.6em', marginLeft: '.2em' }}>MW</small></div>
            <div className="label">Total Load ({loadPct}%)</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: trippedCount > 0 ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.15)' }}>
            {trippedCount > 0 ? '🚨' : '✅'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: trippedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{trippedCount}</div>
            <div className="label">Tripped</div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search generators, status, location, fuel type..."
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
          GENERATORS TAB
         ═══════════════════════════════════════ */}
      {tab === 'generators' && (
        <>
          {/* Live capacity bar */}
          {totalCapacity > 0 && (
            <div className="card gc-capacity-bar" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem', fontSize: '.85rem' }}>
                <span>Plant Load: <strong>{totalLoad.toFixed(1)} MW</strong> / {totalCapacity.toFixed(1)} MW</span>
                <span style={{ color: parseFloat(loadPct) > 90 ? 'var(--danger)' : parseFloat(loadPct) > 75 ? 'var(--warning)' : 'var(--success)' }}><strong>{loadPct}%</strong></span>
              </div>
              <div className="gc-bar-track">
                <div className="gc-bar-fill" style={{
                  width: `${Math.min(parseFloat(loadPct), 100)}%`,
                  background: parseFloat(loadPct) > 90 ? 'var(--danger)' : parseFloat(loadPct) > 75 ? 'var(--warning)' : 'var(--success)',
                }} />
              </div>
            </div>
          )}

          <div className="card">
            {loading ? <div className="loading">Loading...</div> :
            filteredGens.length === 0 ? <div className="empty">No generators found.</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Generator</th>
                      <th>Capacity (MW)</th>
                      <th>Current Load</th>
                      <th>Voltage / Freq</th>
                      <th>Mode</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Quick Actions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGens.map(g => {
                      const cap = parseFloat(g.ratedCapacityMw) || 0;
                      const cur = parseFloat(g.currentLoadMw) || 0;
                      const pct = cap > 0 ? ((cur / cap) * 100).toFixed(0) : 0;
                      return (
                        <tr key={g.id}>
                          <td>
                            <strong>{g.name}</strong>
                            {g.location && <><br /><small style={{ color: 'var(--text-muted)' }}>{g.location}</small></>}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{g.ratedCapacityMw || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                              <span style={{ fontFamily: 'monospace' }}>{cur > 0 ? `${cur} MW` : '—'}</span>
                              {cap > 0 && cur > 0 && <span className={`badge ${pct > 90 ? 'badge-red' : pct > 75 ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: '.7rem' }}>{pct}%</span>}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                            {g.voltagekV ? `${g.voltagekV} kV` : '—'}
                            {g.frequencyHz && <><br />{g.frequencyHz} Hz</>}
                            {g.powerFactor && <><br />PF {g.powerFactor}</>}
                          </td>
                          <td><span className={`badge ${g.startMode === 'auto' ? 'badge-green' : 'badge-blue'}`}>{g.startMode || 'auto'}</span></td>
                          <td style={{ textAlign: 'center' }}>{g.priority ?? '—'}</td>
                          <td><span className={`badge ${statusBadge[g.status] || 'badge-gray'}`}>{g.status}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {g.status === 'stopped' && <button className="btn btn-sm btn-success" onClick={() => changeGenStatus(g, 'starting')}>▶ Start</button>}
                            {(g.status === 'running' || g.status === 'synchronized') && <button className="btn btn-sm btn-warning" onClick={() => changeGenStatus(g, 'stopping')}>⏹ Stop</button>}
                            {g.status === 'running' && <button className="btn btn-sm btn-primary" onClick={() => changeGenStatus(g, 'synchronizing')} style={{ marginLeft: '.3rem' }}>⚡ Sync</button>}
                            {g.status === 'tripped' && <button className="btn btn-sm btn-secondary" onClick={() => changeGenStatus(g, 'stopped')}>↩ Reset</button>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => openEditGen(g)}>Edit</button>{' '}
                            <button className="btn btn-sm btn-danger" onClick={() => deleteGenerator(g.id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          SYNCHRONIZATION TAB
         ═══════════════════════════════════════ */}
      {tab === 'sync' && (
        <>
          {/* Sync requirements reference */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '.75rem' }}>⚡ Synchronization Requirements</h3>
            <div className="gc-sync-req-grid">
              <div className="gc-sync-req">
                <div className="gc-req-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>📊</div>
                <div><strong>Voltage Match</strong><p>Generator voltage must be within ±5% of bus voltage before closing the breaker.</p></div>
              </div>
              <div className="gc-sync-req">
                <div className="gc-req-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>🔄</div>
                <div><strong>Frequency Match</strong><p>Speed adjusted until frequency is within ±0.1 Hz of grid frequency (50/60 Hz).</p></div>
              </div>
              <div className="gc-sync-req">
                <div className="gc-req-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>📐</div>
                <div><strong>Phase Angle</strong><p>Phase angle difference must be within ±10° at the moment of breaker closure.</p></div>
              </div>
              <div className="gc-sync-req">
                <div className="gc-req-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>⏱️</div>
                <div><strong>Slip Frequency</strong><p>Slip frequency (incoming − bus) should be 0.05–0.2 Hz for smooth synchronization.</p></div>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div className="loading">Loading...</div> :
            filteredSyncs.length === 0 ? <div className="empty">No synchronization events recorded.</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Generator</th>
                      <th>Target Bus</th>
                      <th>Method</th>
                      <th>V Match</th>
                      <th>F Match (Hz)</th>
                      <th>Phase (°)</th>
                      <th>Status</th>
                      <th>Initiated By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSyncs.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                        <td><strong>{getGenName(e.generatorId)}</strong></td>
                        <td>{e.targetBus || '—'}</td>
                        <td><span className={`badge ${e.syncMethod === 'auto-sync' ? 'badge-green' : e.syncMethod === 'check-sync' ? 'badge-blue' : 'badge-yellow'}`}>{e.syncMethod}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>{e.voltageMatchPct ? `${e.voltageMatchPct}%` : '—'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{e.freqMatchHz || '—'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{e.phaseAngleDeg ? `${e.phaseAngleDeg}°` : '—'}</td>
                        <td><span className={`badge ${statusBadge[e.status] || 'badge-gray'}`}>{e.status}</span></td>
                        <td style={{ fontSize: '.82rem' }}>{e.initiatedBy || '—'}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteSync(e.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          LOAD TRANSFERS TAB
         ═══════════════════════════════════════ */}
      {tab === 'transfers' && (
        <>
          {/* Transfer summary */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '.75rem' }}>🔀 Load Transfer Process</h3>
            <div className="gc-transfer-steps">
              <div className="gc-step"><div className="gc-step-num">1</div><div><strong>Initiate</strong><p>Operator or auto-demand system initiates transfer request between units.</p></div></div>
              <div className="gc-step"><div className="gc-step-num">2</div><div><strong>Ramp Source</strong><p>Source generator reduces load at controlled ramp rate (MW/min).</p></div></div>
              <div className="gc-step"><div className="gc-step-num">3</div><div><strong>Ramp Target</strong><p>Target generator picks up the shed load at matching ramp rate.</p></div></div>
              <div className="gc-step"><div className="gc-step-num">4</div><div><strong>Verify & Complete</strong><p>Load balance verified. Frequency & voltage stable. Transfer marked complete.</p></div></div>
            </div>
          </div>

          <div className="card">
            {loading ? <div className="loading">Loading...</div> :
            filteredTransfers.length === 0 ? <div className="empty">No load transfers recorded.</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Target</th>
                      <th>Load (MW)</th>
                      <th>Ramp Rate</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</td>
                        <td><span className={`badge ${statusBadge[t.transferType] || 'badge-blue'}`}>{t.transferType}</span></td>
                        <td><strong>{getGenName(t.sourceGeneratorId)}</strong></td>
                        <td>{getGenName(t.targetGeneratorId)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{t.loadMw ? `${t.loadMw} MW` : '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{t.rampRateMwMin ? `${t.rampRateMwMin} MW/min` : '—'}</td>
                        <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{t.reason || '—'}</td>
                        <td><span className={`badge ${statusBadge[t.status] || 'badge-gray'}`}>{t.status}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteTransfer(t.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          GENERATOR MODAL
         ═══════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <h2>{modal === 'new' ? '🔄 Add Generator' : '🔄 Edit Generator'}</h2>
            <div className="form-group">
              <label>Generator Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. GTG-01 Gas Turbine Generator" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Linked Asset</label>
                <select value={form.assetId} onChange={e => {
                  set('assetId', e.target.value);
                  const a = assets.find(x => x.id === e.target.value);
                  if (a?.location) set('location', a.location);
                }}>
                  <option value="">Select asset...</option>
                  {assets.filter(a => a.category?.toLowerCase().includes('generator') || a.category?.toLowerCase().includes('turbine') || a.name?.toLowerCase().includes('generator'))
                    .map(a => <option key={a.id} value={a.id}>{a.name}{a.location ? ` — ${a.location}` : ''}</option>)}
                  <option disabled>── All Assets ──</option>
                  {assets.map(a => <option key={'all-' + a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Rated Capacity (MW)</label>
                <input type="number" step="0.1" value={form.ratedCapacityMw} onChange={e => set('ratedCapacityMw', e.target.value)} placeholder="e.g. 150" />
              </div>
              <div className="form-group">
                <label>Current Load (MW)</label>
                <input type="number" step="0.1" value={form.currentLoadMw} onChange={e => set('currentLoadMw', e.target.value)} placeholder="e.g. 120" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Voltage (kV)</label>
                <input type="number" step="0.01" value={form.voltagekV} onChange={e => set('voltagekV', e.target.value)} placeholder="e.g. 11.5" />
              </div>
              <div className="form-group">
                <label>Frequency (Hz)</label>
                <input type="number" step="0.01" value={form.frequencyHz} onChange={e => set('frequencyHz', e.target.value)} placeholder="e.g. 50.00" />
              </div>
              <div className="form-group">
                <label>Power Factor</label>
                <input type="number" step="0.01" min="0" max="1" value={form.powerFactor} onChange={e => set('powerFactor', e.target.value)} placeholder="e.g. 0.85" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fuel Type</label>
                <select value={form.fuelType} onChange={e => set('fuelType', e.target.value)}>
                  <option value="diesel">Diesel</option>
                  <option value="natural-gas">Natural Gas</option>
                  <option value="heavy-fuel-oil">Heavy Fuel Oil (HFO)</option>
                  <option value="dual-fuel">Dual Fuel</option>
                  <option value="steam">Steam</option>
                  <option value="hydro">Hydro</option>
                  <option value="wind">Wind</option>
                  <option value="solar">Solar</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Mode</label>
                <select value={form.startMode} onChange={e => set('startMode', e.target.value)}>
                  <option value="auto">Automatic</option>
                  <option value="manual">Manual</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority (1 = highest)</label>
                <input type="number" min="1" max="99" value={form.priority} onChange={e => set('priority', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {GEN_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGenerator} disabled={saving || !form.name}>
                {saving ? 'Saving...' : modal === 'new' ? 'Add Generator' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          SYNC MODAL
         ═══════════════════════════════════════ */}
      {syncModal && (
        <div className="modal-overlay" onClick={() => setSyncModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>⚡ {syncModal === 'new' ? 'New Synchronization Event' : 'Edit Sync Event'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Generator *</label>
                <select value={syncForm.generatorId} onChange={e => setS('generatorId', e.target.value)}>
                  <option value="">Select generator...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name} ({g.status})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Bus / Busbar</label>
                <input value={syncForm.targetBus} onChange={e => setS('targetBus', e.target.value)} placeholder="e.g. 11kV Bus A" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Sync Method</label>
                <select value={syncForm.syncMethod} onChange={e => setS('syncMethod', e.target.value)}>
                  {SYNC_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={syncForm.status} onChange={e => setS('status', e.target.value)}>
                  {SYNC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Voltage Match (%)</label>
                <input type="number" step="0.1" value={syncForm.voltageMatchPct} onChange={e => setS('voltageMatchPct', e.target.value)} placeholder="e.g. 99.5" />
              </div>
              <div className="form-group">
                <label>Frequency Match (Hz)</label>
                <input type="number" step="0.01" value={syncForm.freqMatchHz} onChange={e => setS('freqMatchHz', e.target.value)} placeholder="e.g. 50.02" />
              </div>
              <div className="form-group">
                <label>Phase Angle (°)</label>
                <input type="number" step="0.1" value={syncForm.phaseAngleDeg} onChange={e => setS('phaseAngleDeg', e.target.value)} placeholder="e.g. 5.2" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={syncForm.notes} onChange={e => setS('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSyncModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSync} disabled={saving || !syncForm.generatorId}>
                {saving ? 'Saving...' : 'Save Sync Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          TRANSFER MODAL
         ═══════════════════════════════════════ */}
      {transferModal && (
        <div className="modal-overlay" onClick={() => setTransferModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🔀 {transferModal === 'new' ? 'New Load Transfer' : 'Edit Load Transfer'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Source Generator *</label>
                <select value={tForm.sourceGeneratorId} onChange={e => setT('sourceGeneratorId', e.target.value)}>
                  <option value="">Select source...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name} — {g.currentLoadMw || 0} MW</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Generator</label>
                <select value={tForm.targetGeneratorId} onChange={e => setT('targetGeneratorId', e.target.value)}>
                  <option value="">Select target...</option>
                  {generators.filter(g => g.id !== tForm.sourceGeneratorId).map(g => <option key={g.id} value={g.id}>{g.name} — {g.currentLoadMw || 0} MW</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Transfer Type</label>
                <select value={tForm.transferType} onChange={e => setT('transferType', e.target.value)}>
                  {TRANSFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={tForm.status} onChange={e => setT('status', e.target.value)}>
                  {TRANSFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Load to Transfer (MW)</label>
                <input type="number" step="0.1" value={tForm.loadMw} onChange={e => setT('loadMw', e.target.value)} placeholder="e.g. 50" />
              </div>
              <div className="form-group">
                <label>Ramp Rate (MW/min)</label>
                <input type="number" step="0.1" value={tForm.rampRateMwMin} onChange={e => setT('rampRateMwMin', e.target.value)} placeholder="e.g. 5.0" />
              </div>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input value={tForm.reason} onChange={e => setT('reason', e.target.value)} placeholder="e.g. Scheduled maintenance on GTG-01" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={tForm.notes} onChange={e => setT('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setTransferModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTransfer} disabled={saving || !tForm.sourceGeneratorId}>
                {saving ? 'Saving...' : 'Save Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
