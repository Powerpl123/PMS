import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

/* ── Constants ── */
const PROFILE_TYPES = ['base-load', 'peak-shaving', 'demand-response', 'island-mode', 'economy', 'reliability'];
const RULE_STATUSES = ['active', 'inactive', 'testing'];
const EVENT_STATUSES = ['pending', 'in-progress', 'completed', 'failed', 'overridden'];
const SEVERITY_MAP = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' };

const statusBadge = {
  active: 'badge-green', inactive: 'badge-gray', testing: 'badge-blue',
  pending: 'badge-gray', 'in-progress': 'badge-blue', completed: 'badge-green',
  failed: 'badge-red', overridden: 'badge-orange',
  'base-load': 'badge-green', 'peak-shaving': 'badge-orange', 'demand-response': 'badge-purple',
  'island-mode': 'badge-red', economy: 'badge-blue', reliability: 'badge-yellow',
};

const emptyRule = {
  name: '', profileType: 'base-load', status: 'active',
  minLoadPct: '', maxLoadPct: '', targetLoadPct: '',
  priorityOrder: 1, triggerCondition: '', action: '', notes: '',
};

const emptyEvent = {
  loadSharingRuleId: '', eventType: 'rebalance',
  generatorId: '', previousLoadMw: '', newLoadMw: '',
  reason: '', status: 'completed', notes: '',
};

export default function LoadSharing() {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [ruleModal, setRuleModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [form, setForm] = useState(emptyRule);
  const [eForm, setEForm] = useState(emptyEvent);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setE = (k, v) => setEForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [rRes, eRes, gRes] = await Promise.all([
        api.loadSharingRules.list(500).catch(() => ({ data: [] })),
        api.loadSharingEvents.list(500).catch(() => ({ data: [] })),
        api.generators.list(500).catch(() => ({ data: [] })),
      ]);
      setRules(rRes.data);
      setEvents(eRes.data);
      setGenerators(gRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Calculations ── */
  const runningGens = useMemo(() => generators.filter(g => g.status === 'running' || g.status === 'synchronized'), [generators]);
  const totalCapacity = useMemo(() => runningGens.reduce((s, g) => s + (parseFloat(g.ratedCapacityMw) || 0), 0), [runningGens]);
  const totalLoad = useMemo(() => runningGens.reduce((s, g) => s + (parseFloat(g.currentLoadMw) || 0), 0), [runningGens]);
  const avgLoadPct = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100).toFixed(1) : '0.0';

  const genLoadData = useMemo(() => runningGens.map(g => {
    const cap = parseFloat(g.ratedCapacityMw) || 0;
    const cur = parseFloat(g.currentLoadMw) || 0;
    const pct = cap > 0 ? (cur / cap * 100) : 0;
    const optimalLoad = totalCapacity > 0 ? (cap / totalCapacity) * totalLoad : 0;
    const deviation = cur - optimalLoad;
    return { ...g, cap, cur, pct: pct.toFixed(1), optimalLoad: optimalLoad.toFixed(1), deviation: deviation.toFixed(1) };
  }), [runningGens, totalCapacity, totalLoad]);

  const overloaded = genLoadData.filter(g => parseFloat(g.pct) > 90);
  const underutilized = genLoadData.filter(g => parseFloat(g.pct) < 30 && g.cur > 0);

  const getGenName = (id) => generators.find(g => g.id === id)?.name || '—';

  /* ── Filter ── */
  const q = search.toLowerCase();
  const filteredRules = rules.filter(r => !q || r.name?.toLowerCase().includes(q) || r.profileType?.toLowerCase().includes(q));
  const filteredEvents = events.filter(e => !q || getGenName(e.generatorId).toLowerCase().includes(q) || e.eventType?.toLowerCase().includes(q) || e.reason?.toLowerCase().includes(q));

  /* ── Rule CRUD ── */
  function openNewRule() { setForm({ ...emptyRule }); setRuleModal('new'); }

  function openEditRule(r) {
    setForm({
      name: r.name || '', profileType: r.profileType || 'base-load', status: r.status || 'active',
      minLoadPct: r.minLoadPct ?? '', maxLoadPct: r.maxLoadPct ?? '', targetLoadPct: r.targetLoadPct ?? '',
      priorityOrder: r.priorityOrder ?? 1, triggerCondition: r.triggerCondition || '',
      action: r.action || '', notes: r.notes || '',
    });
    setRuleModal(r);
  }

  async function saveRule() {
    if (!form.name) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (ruleModal === 'new') await api.loadSharingRules.create(form);
      else await api.loadSharingRules.update(ruleModal.id, form);
      setRuleModal(null); await load();
      showToast(ruleModal === 'new' ? 'Rule created' : 'Rule updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteRule(id) {
    if (!confirm('Delete this load sharing rule?')) return;
    try { await api.loadSharingRules.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Event CRUD ── */
  function openNewEvent() { setEForm({ ...emptyEvent }); setEventModal('new'); }

  async function saveEvent() {
    if (!eForm.generatorId) { showToast('Select a generator', 'error'); return; }
    setSaving(true);
    try {
      const body = { ...eForm, initiatedBy: user?.user_metadata?.full_name || user?.email || '' };
      if (eventModal === 'new') await api.loadSharingEvents.create(body);
      else await api.loadSharingEvents.update(eventModal.id, body);
      setEventModal(null); await load();
      showToast('Event logged');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try { await api.loadSharingEvents.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>⚖️ Load Sharing & Optimization</h1>
          <div className="subtitle">Balance electrical load, prevent overloading, peak shaving & demand management</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`btn ${tab === 'rules' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('rules')}>Sharing Rules</button>
          <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('events')}>Events Log</button>
          <button className={`btn ${tab === 'peakshaving' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('peakshaving')}>Peak Shaving</button>
          {tab === 'rules' && <button className="btn btn-primary" onClick={openNewRule}>+ Add Rule</button>}
          {tab === 'events' && <button className="btn btn-primary" onClick={openNewEvent}>+ Log Event</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon blue">⚖️</div>
          <div className="stat-info"><div className="value blue">{runningGens.length}</div><div className="label">Running Generators</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">📊</div>
          <div className="stat-info"><div className="value green">{totalLoad.toFixed(1)}<small style={{ fontSize: '.6em', marginLeft: '.2em' }}>MW</small></div><div className="label">Total Plant Load</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: parseFloat(avgLoadPct) > 85 ? 'rgba(239,68,68,.15)' : 'rgba(249,115,22,.15)' }}>
            {parseFloat(avgLoadPct) > 85 ? '🔴' : '📈'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: parseFloat(avgLoadPct) > 85 ? 'var(--danger)' : 'var(--primary)' }}>{avgLoadPct}%</div>
            <div className="label">Avg Load Factor</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: overloaded.length > 0 ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.15)' }}>
            {overloaded.length > 0 ? '⚠️' : '✅'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: overloaded.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{overloaded.length}</div>
            <div className="label">Overloaded Units</div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search rules, events, generators..."
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
          {/* Generator Load Distribution */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>⚡ Generator Load Distribution</h3>
            {genLoadData.length === 0 ? (
              <div className="empty">No running generators. Add generators in Generator Control module.</div>
            ) : (
              <div className="ls-gen-grid">
                {genLoadData.map(g => (
                  <div key={g.id} className="ls-gen-card">
                    <div className="ls-gen-header">
                      <strong>{g.name}</strong>
                      <span className={`badge ${parseFloat(g.pct) > 90 ? 'badge-red' : parseFloat(g.pct) > 75 ? 'badge-yellow' : parseFloat(g.pct) < 30 && g.cur > 0 ? 'badge-blue' : 'badge-green'}`}>
                        {g.pct}%
                      </span>
                    </div>
                    <div className="ls-bar-track">
                      <div className="ls-bar-fill" style={{
                        width: `${Math.min(parseFloat(g.pct), 100)}%`,
                        background: parseFloat(g.pct) > 90 ? 'var(--danger)' : parseFloat(g.pct) > 75 ? 'var(--warning)' : 'var(--success)',
                      }} />
                      <div className="ls-bar-optimal" style={{ left: `${totalCapacity > 0 ? (g.cap / totalCapacity * 100 * totalLoad / totalCapacity).toFixed(0) : 0}%` }} title="Optimal load line" />
                    </div>
                    <div className="ls-gen-details">
                      <span>{g.cur} / {g.cap} MW</span>
                      <span style={{ color: parseFloat(g.deviation) > 5 ? 'var(--danger)' : parseFloat(g.deviation) < -5 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: Math.abs(parseFloat(g.deviation)) > 5 ? 600 : 400 }}>
                        {parseFloat(g.deviation) > 0 ? '+' : ''}{g.deviation} MW
                      </span>
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                      Optimal: {g.optimalLoad} MW
                      {g.location && <> · {g.location}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {(overloaded.length > 0 || underutilized.length > 0) && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>🚨 Load Balance Alerts</h3>
              <div className="ls-alert-list">
                {overloaded.map(g => (
                  <div key={g.id} className="ls-alert ls-alert-danger">
                    <span className="ls-alert-icon">🔴</span>
                    <div>
                      <strong>{g.name}</strong> is overloaded at <strong>{g.pct}%</strong> ({g.cur} MW / {g.cap} MW).
                      Recommend shedding <strong>{Math.abs(parseFloat(g.deviation)).toFixed(1)} MW</strong> to balanced level.
                    </div>
                  </div>
                ))}
                {underutilized.map(g => (
                  <div key={g.id} className="ls-alert ls-alert-info">
                    <span className="ls-alert-icon">🔵</span>
                    <div>
                      <strong>{g.name}</strong> is underutilized at <strong>{g.pct}%</strong> ({g.cur} MW / {g.cap} MW).
                      Can absorb an additional <strong>{Math.abs(parseFloat(g.deviation)).toFixed(1)} MW</strong>.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Rules Summary */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>📋 Active Load Sharing Rules ({rules.filter(r => r.status === 'active').length})</h3>
            {rules.filter(r => r.status === 'active').length === 0 ? (
              <div className="empty">No active load sharing rules. Go to Sharing Rules tab to create one.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Rule</th><th>Profile</th><th>Load Range</th><th>Target</th><th>Priority</th><th>Condition</th></tr>
                  </thead>
                  <tbody>
                    {rules.filter(r => r.status === 'active').sort((a, b) => (a.priorityOrder || 99) - (b.priorityOrder || 99)).map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.name}</strong></td>
                        <td><span className={`badge ${statusBadge[r.profileType] || 'badge-gray'}`}>{r.profileType}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{r.minLoadPct || 0}% – {r.maxLoadPct || 100}%</td>
                        <td style={{ fontFamily: 'monospace' }}>{r.targetLoadPct ? `${r.targetLoadPct}%` : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.priorityOrder}</td>
                        <td style={{ fontSize: '.82rem' }}>{r.triggerCondition || '—'}</td>
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
          RULES TAB
         ═══════════════════════════════════════ */}
      {tab === 'rules' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredRules.length === 0 ? <div className="empty">No load sharing rules defined.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Profile Type</th>
                    <th>Min Load</th>
                    <th>Max Load</th>
                    <th>Target</th>
                    <th>Priority</th>
                    <th>Trigger Condition</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className={`badge ${statusBadge[r.profileType] || 'badge-gray'}`}>{r.profileType}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{r.minLoadPct ? `${r.minLoadPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.maxLoadPct ? `${r.maxLoadPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.targetLoadPct ? `${r.targetLoadPct}%` : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{r.priorityOrder}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{r.triggerCondition || '—'}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{r.action || '—'}</td>
                      <td><span className={`badge ${statusBadge[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditRule(r)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteRule(r.id)}>Delete</button>
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
          EVENTS TAB
         ═══════════════════════════════════════ */}
      {tab === 'events' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredEvents.length === 0 ? <div className="empty">No load sharing events recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Generator</th>
                    <th>Previous Load</th>
                    <th>New Load</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th>Rule</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(e => {
                    const prev = parseFloat(e.previousLoadMw) || 0;
                    const next = parseFloat(e.newLoadMw) || 0;
                    const diff = next - prev;
                    return (
                      <tr key={e.id}>
                        <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                        <td><span className={`badge ${e.eventType === 'rebalance' ? 'badge-blue' : e.eventType === 'peak-shave' ? 'badge-orange' : e.eventType === 'overload-shed' ? 'badge-red' : 'badge-green'}`}>{e.eventType}</span></td>
                        <td><strong>{getGenName(e.generatorId)}</strong></td>
                        <td style={{ fontFamily: 'monospace' }}>{prev > 0 ? `${prev} MW` : '—'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{next > 0 ? `${next} MW` : '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)} MW
                        </td>
                        <td style={{ fontSize: '.82rem', maxWidth: '180px' }}>{e.reason || '—'}</td>
                        <td style={{ fontSize: '.82rem' }}>{e.loadSharingRuleId ? rules.find(r => r.id === e.loadSharingRuleId)?.name || '—' : '—'}</td>
                        <td><span className={`badge ${statusBadge[e.status] || 'badge-gray'}`}>{e.status}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteEvent(e.id)}>Delete</button></td>
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
          PEAK SHAVING TAB
         ═══════════════════════════════════════ */}
      {tab === 'peakshaving' && (
        <div>
          {/* Concepts */}
          <div className="ls-concept-grid">
            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>⚡ Peak Shaving</h3>
              <div className="ls-concept-list">
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>📈</div>
                  <div>
                    <strong>Peak Detection</strong>
                    <p>Continuously monitors plant demand. When load approaches the contracted peak demand limit, standby generators are brought online to avoid grid demand charges.</p>
                  </div>
                </div>
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>🔋</div>
                  <div>
                    <strong>Load Capping</strong>
                    <p>Caps grid import at a configurable threshold (e.g., 80% of contracted demand). Excess demand served by on-site generators or energy storage.</p>
                  </div>
                </div>
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>💰</div>
                  <div>
                    <strong>Cost Optimization</strong>
                    <p>Reduces maximum demand charges by 15–30%. Generators deployed based on fuel cost vs. grid tariff economics. Time-of-use tariff awareness.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>🏭 Demand-Side Management</h3>
              <div className="ls-concept-list">
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>🔄</div>
                  <div>
                    <strong>Load Scheduling</strong>
                    <p>Non-critical loads (coal handling, water treatment cycles) scheduled during off-peak hours. Reduces simultaneous demand spikes.</p>
                  </div>
                </div>
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>📉</div>
                  <div>
                    <strong>Load Shedding Priority</strong>
                    <p>Pre-defined load shedding tiers: Tier 1 (non-essential lighting/HVAC), Tier 2 (auxiliary cooling), Tier 3 (non-critical process), Tier 4 (critical process last).</p>
                  </div>
                </div>
                <div className="ls-concept-item">
                  <div className="ls-concept-icon" style={{ background: 'rgba(234,179,8,.15)', color: 'var(--warning)' }}>📊</div>
                  <div>
                    <strong>Demand Response</strong>
                    <p>Participation in grid operator demand response programs. Automated curtailment signals reduce plant consumption during grid emergencies for incentive payments.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Load Sharing Strategies */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🔧 Load Sharing Strategies</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Strategy</th><th>Method</th><th>Best For</th><th>Typical Setting</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Proportional (Droop)</strong></td>
                    <td>Each generator shares load proportional to its rated capacity using speed-droop governors (4–5% droop typical).</td>
                    <td>Multiple generators of different sizes on a common bus</td>
                    <td><span className="badge badge-green">4% droop</span></td>
                  </tr>
                  <tr>
                    <td><strong>Isochronous</strong></td>
                    <td>One generator maintains exact frequency (zero droop) while others follow in droop mode.</td>
                    <td>Island-mode operation with a single master generator</td>
                    <td><span className="badge badge-blue">Master/Slave</span></td>
                  </tr>
                  <tr>
                    <td><strong>Equal Load</strong></td>
                    <td>All generators carry the same MW load regardless of capacity. Simple but may overload smaller units.</td>
                    <td>Identical generators</td>
                    <td><span className="badge badge-yellow">Equal MW</span></td>
                  </tr>
                  <tr>
                    <td><strong>Base Load + Peak</strong></td>
                    <td>Base-load units run at optimal efficiency (70–85%). Peaking units start only when demand exceeds base capacity.</td>
                    <td>Mixed fleet with efficient base-load and fast-start peakers</td>
                    <td><span className="badge badge-orange">70–85% base</span></td>
                  </tr>
                  <tr>
                    <td><strong>Economy Dispatch</strong></td>
                    <td>Generators dispatched to minimize total fuel cost. Uses incremental cost curves (heat rate curves) for each unit.</td>
                    <td>Cost-sensitive plants with multiple fuel types</td>
                    <td><span className="badge badge-purple">Min $/MWh</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          RULE MODAL
         ═══════════════════════════════════════ */}
      {ruleModal && (
        <div className="modal-overlay" onClick={() => setRuleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{ruleModal === 'new' ? '⚖️ Add Load Sharing Rule' : '⚖️ Edit Rule'}</h2>
            <div className="form-group">
              <label>Rule Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Base Load Proportional Sharing" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Profile Type</label>
                <select value={form.profileType} onChange={e => set('profileType', e.target.value)}>
                  {PROFILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {RULE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Priority Order</label>
                <input type="number" min="1" max="99" value={form.priorityOrder} onChange={e => set('priorityOrder', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Min Load (%)</label>
                <input type="number" min="0" max="100" value={form.minLoadPct} onChange={e => set('minLoadPct', e.target.value)} placeholder="e.g. 30" />
              </div>
              <div className="form-group">
                <label>Max Load (%)</label>
                <input type="number" min="0" max="100" value={form.maxLoadPct} onChange={e => set('maxLoadPct', e.target.value)} placeholder="e.g. 90" />
              </div>
              <div className="form-group">
                <label>Target Load (%)</label>
                <input type="number" min="0" max="100" value={form.targetLoadPct} onChange={e => set('targetLoadPct', e.target.value)} placeholder="e.g. 75" />
              </div>
            </div>
            <div className="form-group">
              <label>Trigger Condition</label>
              <input value={form.triggerCondition} onChange={e => set('triggerCondition', e.target.value)} placeholder="e.g. Plant load > 80% of total capacity" />
            </div>
            <div className="form-group">
              <label>Action</label>
              <input value={form.action} onChange={e => set('action', e.target.value)} placeholder="e.g. Start standby genset and redistribute load proportionally" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRuleModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRule} disabled={saving || !form.name}>
                {saving ? 'Saving...' : ruleModal === 'new' ? 'Create Rule' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          EVENT MODAL
         ═══════════════════════════════════════ */}
      {eventModal && (
        <div className="modal-overlay" onClick={() => setEventModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📊 {eventModal === 'new' ? 'Log Load Sharing Event' : 'Edit Event'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Generator *</label>
                <select value={eForm.generatorId} onChange={e => setE('generatorId', e.target.value)}>
                  <option value="">Select generator...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name} ({g.status}) — {g.currentLoadMw || 0} MW</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Event Type</label>
                <select value={eForm.eventType} onChange={e => setE('eventType', e.target.value)}>
                  <option value="rebalance">Rebalance</option>
                  <option value="peak-shave">Peak Shave</option>
                  <option value="overload-shed">Overload Shed</option>
                  <option value="demand-response">Demand Response</option>
                  <option value="startup">Generator Startup</option>
                  <option value="shutdown">Generator Shutdown</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Previous Load (MW)</label>
                <input type="number" step="0.1" value={eForm.previousLoadMw} onChange={e => setE('previousLoadMw', e.target.value)} placeholder="e.g. 120" />
              </div>
              <div className="form-group">
                <label>New Load (MW)</label>
                <input type="number" step="0.1" value={eForm.newLoadMw} onChange={e => setE('newLoadMw', e.target.value)} placeholder="e.g. 100" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Linked Rule</label>
                <select value={eForm.loadSharingRuleId} onChange={e => setE('loadSharingRuleId', e.target.value)}>
                  <option value="">None</option>
                  {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={eForm.status} onChange={e => setE('status', e.target.value)}>
                  {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input value={eForm.reason} onChange={e => setE('reason', e.target.value)} placeholder="e.g. Peak demand exceeded threshold" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={eForm.notes} onChange={e => setE('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEventModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEvent} disabled={saving || !eForm.generatorId}>
                {saving ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
