import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';

/* ── Constants ── */
const FUEL_TYPES = ['diesel', 'natural-gas', 'heavy-fuel-oil', 'coal', 'biomass', 'dual-fuel'];
const LOG_STATUSES = ['recorded', 'reviewed', 'anomaly', 'optimized'];
const COST_CATEGORIES = ['fuel', 'maintenance', 'labor', 'parts', 'emissions-penalty', 'grid-purchase', 'startup-cost', 'other'];
const EMISSION_TYPES = ['CO2', 'NOx', 'SOx', 'PM', 'CO'];
const OPTIMIZATION_STATUSES = ['proposed', 'active', 'paused', 'completed', 'rejected'];

const badgeMap = {
  recorded: 'badge-gray', reviewed: 'badge-blue', anomaly: 'badge-red', optimized: 'badge-green',
  proposed: 'badge-yellow', active: 'badge-green', paused: 'badge-orange', completed: 'badge-blue', rejected: 'badge-red',
  diesel: 'badge-orange', 'natural-gas': 'badge-blue', 'heavy-fuel-oil': 'badge-red',
  coal: 'badge-gray', biomass: 'badge-green', 'dual-fuel': 'badge-purple',
  fuel: 'badge-orange', maintenance: 'badge-blue', labor: 'badge-purple',
  parts: 'badge-gray', 'emissions-penalty': 'badge-red', 'grid-purchase': 'badge-yellow',
  'startup-cost': 'badge-orange', other: 'badge-gray',
};

const emptyFuelLog = {
  generatorId: '', fuelType: 'natural-gas', consumptionLiters: '', consumptionKg: '',
  runHours: '', loadPct: '', heatRateKjKwh: '', efficiencyPct: '',
  costPerUnit: '', totalCost: '', period: '', notes: '',
};

const emptyCostEntry = {
  category: 'fuel', description: '', amount: '', currency: 'USD',
  generatorId: '', period: '', notes: '',
};

const emptyOptimization = {
  title: '', strategy: '', targetSavingPct: '', actualSavingPct: '',
  status: 'proposed', affectedGenerators: '', estimatedCostSaving: '',
  emissionReductionPct: '', implementedAt: '', notes: '',
};

export default function EnergyEfficiency() {
  const [fuelLogs, setFuelLogs] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [optimizations, setOptimizations] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [fuelModal, setFuelModal] = useState(null);
  const [costModal, setCostModal] = useState(null);
  const [optModal, setOptModal] = useState(null);
  const [fForm, setFForm] = useState(emptyFuelLog);
  const [cForm, setCForm] = useState(emptyCostEntry);
  const [oForm, setOForm] = useState(emptyOptimization);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const setF = (k, v) => setFForm(p => ({ ...p, [k]: v }));
  const setC = (k, v) => setCForm(p => ({ ...p, [k]: v }));
  const setO = (k, v) => setOForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [flRes, ceRes, opRes, gRes] = await Promise.all([
        api.fuelLogs.list(500).catch(() => ({ data: [] })),
        api.costEntries.list(500).catch(() => ({ data: [] })),
        api.optimizations.list(500).catch(() => ({ data: [] })),
        api.generators.list(500).catch(() => ({ data: [] })),
      ]);
      setFuelLogs(flRes.data);
      setCostEntries(ceRes.data);
      setOptimizations(opRes.data);
      setGenerators(gRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed Stats ── */
  const genName = (id) => generators.find(g => g.id === id)?.name || '—';

  const totalFuelCost = useMemo(() => fuelLogs.reduce((s, l) => s + (parseFloat(l.totalCost) || 0), 0), [fuelLogs]);
  const totalOpCost = useMemo(() => costEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [costEntries]);
  const avgEfficiency = useMemo(() => {
    const withEff = fuelLogs.filter(l => parseFloat(l.efficiencyPct) > 0);
    return withEff.length > 0 ? (withEff.reduce((s, l) => s + parseFloat(l.efficiencyPct), 0) / withEff.length).toFixed(1) : '—';
  }, [fuelLogs]);
  const avgHeatRate = useMemo(() => {
    const withHr = fuelLogs.filter(l => parseFloat(l.heatRateKjKwh) > 0);
    return withHr.length > 0 ? (withHr.reduce((s, l) => s + parseFloat(l.heatRateKjKwh), 0) / withHr.length).toFixed(0) : '—';
  }, [fuelLogs]);
  const activeOpts = optimizations.filter(o => o.status === 'active').length;
  const totalSavings = useMemo(() => optimizations.filter(o => o.status === 'completed' || o.status === 'active').reduce((s, o) => s + (parseFloat(o.estimatedCostSaving) || 0), 0), [optimizations]);
  const idleCapacity = useMemo(() => {
    const withLoad = fuelLogs.filter(l => parseFloat(l.loadPct) > 0);
    if (withLoad.length === 0) return '—';
    const avgLoad = withLoad.reduce((s, l) => s + parseFloat(l.loadPct), 0) / withLoad.length;
    return (100 - avgLoad).toFixed(1);
  }, [fuelLogs]);

  // Cost breakdown by category
  const costBreakdown = useMemo(() => {
    const map = {};
    costEntries.forEach(e => {
      const cat = e.category || 'other';
      map[cat] = (map[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [costEntries]);

  // Fuel consumption by generator
  const fuelByGen = useMemo(() => {
    const map = {};
    fuelLogs.forEach(l => {
      const n = genName(l.generatorId);
      if (!map[n]) map[n] = { liters: 0, cost: 0, hours: 0 };
      map[n].liters += parseFloat(l.consumptionLiters) || 0;
      map[n].cost += parseFloat(l.totalCost) || 0;
      map[n].hours += parseFloat(l.runHours) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].cost - a[1].cost);
  }, [fuelLogs, generators]);

  const q = search.toLowerCase();
  const filteredFuel = fuelLogs.filter(l => !q || genName(l.generatorId).toLowerCase().includes(q) || l.fuelType?.toLowerCase().includes(q) || l.notes?.toLowerCase().includes(q));
  const filteredCosts = costEntries.filter(e => !q || e.category?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
  const filteredOpts = optimizations.filter(o => !q || o.title?.toLowerCase().includes(q) || o.strategy?.toLowerCase().includes(q) || o.status?.toLowerCase().includes(q));

  /* ── Fuel CRUD ── */
  function openNewFuel() { setFForm({ ...emptyFuelLog }); setFuelModal('new'); }
  function openEditFuel(l) {
    setFForm({
      generatorId: l.generatorId || '', fuelType: l.fuelType || 'natural-gas',
      consumptionLiters: l.consumptionLiters ?? '', consumptionKg: l.consumptionKg ?? '',
      runHours: l.runHours ?? '', loadPct: l.loadPct ?? '',
      heatRateKjKwh: l.heatRateKjKwh ?? '', efficiencyPct: l.efficiencyPct ?? '',
      costPerUnit: l.costPerUnit ?? '', totalCost: l.totalCost ?? '',
      period: l.period || '', notes: l.notes || '',
    });
    setFuelModal(l);
  }
  async function saveFuel() {
    if (!fForm.generatorId) { showToast('Generator is required', 'error'); return; }
    setSaving(true);
    try {
      if (fuelModal === 'new') await api.fuelLogs.create(fForm);
      else await api.fuelLogs.update(fuelModal.id, fForm);
      setFuelModal(null); await load();
      showToast(fuelModal === 'new' ? 'Fuel log added' : 'Fuel log updated');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteFuel(id) {
    if (!confirm('Delete this fuel log?')) return;
    try { await api.fuelLogs.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Cost CRUD ── */
  function openNewCost() { setCForm({ ...emptyCostEntry }); setCostModal('new'); }
  function openEditCost(e) {
    setCForm({
      category: e.category || 'fuel', description: e.description || '',
      amount: e.amount ?? '', currency: e.currency || 'USD',
      generatorId: e.generatorId || '', period: e.period || '', notes: e.notes || '',
    });
    setCostModal(e);
  }
  async function saveCost() {
    if (!cForm.description || !cForm.amount) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    try {
      if (costModal === 'new') await api.costEntries.create(cForm);
      else await api.costEntries.update(costModal.id, cForm);
      setCostModal(null); await load();
      showToast('Cost entry saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteCost(id) {
    if (!confirm('Delete this cost entry?')) return;
    try { await api.costEntries.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  /* ── Optimization CRUD ── */
  function openNewOpt() { setOForm({ ...emptyOptimization }); setOptModal('new'); }
  function openEditOpt(o) {
    setOForm({
      title: o.title || '', strategy: o.strategy || '',
      targetSavingPct: o.targetSavingPct ?? '', actualSavingPct: o.actualSavingPct ?? '',
      status: o.status || 'proposed', affectedGenerators: o.affectedGenerators || '',
      estimatedCostSaving: o.estimatedCostSaving ?? '', emissionReductionPct: o.emissionReductionPct ?? '',
      implementedAt: o.implementedAt ? o.implementedAt.slice(0, 16) : '', notes: o.notes || '',
    });
    setOptModal(o);
  }
  async function saveOpt() {
    if (!oForm.title) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      if (optModal === 'new') await api.optimizations.create(oForm);
      else await api.optimizations.update(optModal.id, oForm);
      setOptModal(null); await load();
      showToast('Optimization saved');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }
  async function deleteOpt(id) {
    if (!confirm('Delete this optimization?')) return;
    try { await api.optimizations.remove(id); load(); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  const fmt = (n) => {
    const v = parseFloat(n);
    if (isNaN(v)) return '—';
    return v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(2);
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1>🌿 Energy Efficiency & Cost Control</h1>
          <div className="subtitle">Fuel optimization, cost tracking & emissions reduction</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`btn ${tab === 'fuel' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('fuel')}>Fuel Logs</button>
          <button className={`btn ${tab === 'costs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('costs')}>Cost Tracking</button>
          <button className={`btn ${tab === 'optimize' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('optimize')}>Optimizations</button>
          {tab === 'fuel' && <button className="btn btn-primary" onClick={openNewFuel}>+ Log Fuel</button>}
          {tab === 'costs' && <button className="btn btn-primary" onClick={openNewCost}>+ Add Cost</button>}
          {tab === 'optimize' && <button className="btn btn-primary" onClick={openNewOpt}>+ New Strategy</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon orange">⛽</div>
          <div className="stat-info"><div className="value orange">${fmt(totalFuelCost)}</div><div className="label">Total Fuel Cost</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">📊</div>
          <div className="stat-info"><div className="value blue">{avgEfficiency}{avgEfficiency !== '—' && '%'}</div><div className="label">Avg Efficiency</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: parseFloat(idleCapacity) > 30 ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.15)' }}>
            {parseFloat(idleCapacity) > 30 ? '⚠️' : '✅'}
          </div>
          <div className="stat-info">
            <div className="value" style={{ color: parseFloat(idleCapacity) > 30 ? 'var(--danger)' : 'var(--success)' }}>{idleCapacity}{idleCapacity !== '—' && '%'}</div>
            <div className="label">Avg Idle Capacity</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">💰</div>
          <div className="stat-info"><div className="value green">${fmt(totalSavings)}</div><div className="label">Est. Savings</div></div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search fuel logs, costs, optimizations..."
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
          {/* Fuel by Generator */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>⛽ Fuel Consumption by Generator</h3>
            {fuelByGen.length === 0 ? (
              <div className="empty">No fuel logs yet. Go to Fuel Logs tab to add records.</div>
            ) : (
              <div className="ee-gen-grid">
                {fuelByGen.map(([name, data]) => {
                  const costPerHr = data.hours > 0 ? (data.cost / data.hours).toFixed(2) : '—';
                  return (
                    <div key={name} className="ee-gen-card">
                      <div className="ee-gen-top">
                        <strong>{name}</strong>
                        <span style={{ fontFamily: 'monospace', fontSize: '.85rem', color: 'var(--primary)', fontWeight: 700 }}>${fmt(data.cost)}</span>
                      </div>
                      <div className="ee-gen-stats">
                        <div><span className="ee-gen-label">Fuel</span><span className="ee-gen-val">{fmt(data.liters)} L</span></div>
                        <div><span className="ee-gen-label">Run Hours</span><span className="ee-gen-val">{fmt(data.hours)} h</span></div>
                        <div><span className="ee-gen-label">Cost/Hour</span><span className="ee-gen-val">${costPerHr}</span></div>
                      </div>
                      {totalFuelCost > 0 && (
                        <div style={{ marginTop: '.6rem' }}>
                          <div className="ee-bar-track">
                            <div className="ee-bar-fill" style={{ width: `${(data.cost / totalFuelCost * 100).toFixed(0)}%` }} />
                          </div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.2rem', textAlign: 'right', fontFamily: 'monospace' }}>
                            {(data.cost / totalFuelCost * 100).toFixed(1)}% of total fuel cost
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="ee-overview-split">
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>💰 Cost Breakdown</h3>
              {costBreakdown.length === 0 ? (
                <div className="empty">No cost entries recorded.</div>
              ) : (
                <div className="ee-cost-list">
                  {costBreakdown.map(([cat, amount]) => (
                    <div key={cat} className="ee-cost-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                        <span className={`badge ${badgeMap[cat] || 'badge-gray'}`}>{cat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <div className="ee-bar-track" style={{ flex: 1 }}>
                          <div className="ee-bar-fill ee-bar-cost" style={{ width: `${totalOpCost > 0 ? (amount / totalOpCost * 100).toFixed(0) : 0}%` }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, minWidth: '90px', textAlign: 'right' }}>${fmt(amount)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="ee-cost-total">
                    <span>Total Operational Cost</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem' }}>${fmt(totalOpCost)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🎯 Active Optimizations</h3>
              {optimizations.filter(o => o.status === 'active' || o.status === 'proposed').length === 0 ? (
                <div className="empty">No active optimization strategies.</div>
              ) : (
                <div className="ee-opt-list">
                  {optimizations.filter(o => o.status === 'active' || o.status === 'proposed').map(o => (
                    <div key={o.id} className="ee-opt-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.3rem' }}>
                        <strong>{o.title}</strong>
                        <span className={`badge ${badgeMap[o.status]}`}>{o.status}</span>
                      </div>
                      <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', margin: '.2rem 0' }}>{o.strategy}</p>
                      <div className="ee-opt-metrics">
                        {o.targetSavingPct && <span>Target: <strong>{o.targetSavingPct}%</strong></span>}
                        {o.estimatedCostSaving && <span>Saving: <strong>${fmt(o.estimatedCostSaving)}</strong></span>}
                        {o.emissionReductionPct && <span>Emissions: <strong>-{o.emissionReductionPct}%</strong></span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sustainability Framework */}
          <div className="ee-framework-grid" style={{ marginTop: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>⛽ Fuel Optimization Strategies</h3>
              <div className="ee-fw-list">
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(249,115,22,.15)', color: 'var(--primary)' }}>📈</div>
                  <div>
                    <strong>Economic Dispatch</strong>
                    <p>Allocate generation to minimize total fuel cost using incremental heat rate curves. Prioritize units with lowest marginal cost per MWh.</p>
                  </div>
                </div>
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(14,165,233,.15)', color: 'var(--accent)' }}>🔋</div>
                  <div>
                    <strong>Optimal Unit Commitment</strong>
                    <p>Schedule minimum generators to meet demand + spinning reserve. Avoid running units below minimum efficient load (typically 40-60% MCR).</p>
                  </div>
                </div>
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>🔄</div>
                  <div>
                    <strong>Heat Rate Optimization</strong>
                    <p>Monitor and reduce specific fuel consumption (SFC). Target heat rate ≤8,500 kJ/kWh for gas turbines, ≤10,000 kJ/kWh for steam units.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🌿 Emissions Reduction</h3>
              <div className="ee-fw-list">
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)' }}>🌍</div>
                  <div>
                    <strong>CO₂ Intensity Tracking</strong>
                    <p>Monitor kg CO₂/MWh per unit and fleet-wide. Target below 400 kg/MWh for CCGT, 800 kg/MWh for coal. Benchmark against IEA standards.</p>
                  </div>
                </div>
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>🔬</div>
                  <div>
                    <strong>Selective Catalytic Reduction (SCR)</strong>
                    <p>NOx removal efficiency ≥90%. Monitor catalyst degradation and ammonia slip. Schedule catalyst replacement at ≥40,000 operating hours.</p>
                  </div>
                </div>
                <div className="ee-fw-item">
                  <div className="ee-fw-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)' }}>📉</div>
                  <div>
                    <strong>Startup Emission Minimization</strong>
                    <p>Reduce cold/warm/hot start cycles. Each cold start ≈ 2-3× emission intensity. Optimize maintenance windows to minimize unnecessary shutdowns.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Table */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>📋 Efficiency Benchmarks</h3>
            <table>
              <thead>
                <tr><th>Metric</th><th>Unit</th><th>Good</th><th>Average</th><th>Poor</th><th>Action if Poor</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Heat Rate</strong></td><td>kJ/kWh</td>
                  <td><span className="badge badge-green">≤8,500</span></td>
                  <td><span className="badge badge-yellow">8,500–10,000</span></td>
                  <td><span className="badge badge-red">&gt;10,000</span></td>
                  <td style={{ fontSize: '.82rem' }}>Check combustion tuning, air-fuel ratio, condenser vacuum</td>
                </tr>
                <tr>
                  <td><strong>Thermal Efficiency</strong></td><td>%</td>
                  <td><span className="badge badge-green">≥42%</span></td>
                  <td><span className="badge badge-yellow">35–42%</span></td>
                  <td><span className="badge badge-red">&lt;35%</span></td>
                  <td style={{ fontSize: '.82rem' }}>Investigate steam cycle losses, boiler fouling, turbine erosion</td>
                </tr>
                <tr>
                  <td><strong>Auxiliary Power</strong></td><td>%</td>
                  <td><span className="badge badge-green">≤6%</span></td>
                  <td><span className="badge badge-yellow">6–9%</span></td>
                  <td><span className="badge badge-red">&gt;9%</span></td>
                  <td style={{ fontSize: '.82rem' }}>Optimize fan/pump VFDs, reduce compressed air leaks</td>
                </tr>
                <tr>
                  <td><strong>Idle Capacity</strong></td><td>%</td>
                  <td><span className="badge badge-green">≤15%</span></td>
                  <td><span className="badge badge-yellow">15–30%</span></td>
                  <td><span className="badge badge-red">&gt;30%</span></td>
                  <td style={{ fontSize: '.82rem' }}>Reduce online units, shift load to efficient generators</td>
                </tr>
                <tr>
                  <td><strong>CO₂ Intensity</strong></td><td>kg/MWh</td>
                  <td><span className="badge badge-green">≤400</span></td>
                  <td><span className="badge badge-yellow">400–700</span></td>
                  <td><span className="badge badge-red">&gt;700</span></td>
                  <td style={{ fontSize: '.82rem' }}>Switch to lower-carbon fuel, optimize combustion, CCS consideration</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          FUEL LOGS TAB
         ═══════════════════════════════════════ */}
      {tab === 'fuel' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredFuel.length === 0 ? <div className="empty">No fuel logs recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Generator</th>
                    <th>Fuel Type</th>
                    <th>Consumption</th>
                    <th>Run Hours</th>
                    <th>Load %</th>
                    <th>Heat Rate</th>
                    <th>Efficiency</th>
                    <th>Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFuel.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{l.period || (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—')}</td>
                      <td><strong>{genName(l.generatorId)}</strong></td>
                      <td><span className={`badge ${badgeMap[l.fuelType] || 'badge-gray'}`}>{l.fuelType}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>
                        {l.consumptionLiters ? `${fmt(l.consumptionLiters)} L` : l.consumptionKg ? `${fmt(l.consumptionKg)} kg` : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{l.runHours ? `${l.runHours} h` : '—'}</td>
                      <td>
                        {l.loadPct ? (
                          <span className={`badge ${parseFloat(l.loadPct) < 40 ? 'badge-red' : parseFloat(l.loadPct) < 70 ? 'badge-yellow' : 'badge-green'}`}>{l.loadPct}%</span>
                        ) : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{l.heatRateKjKwh ? `${fmt(l.heatRateKjKwh)} kJ/kWh` : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{l.efficiencyPct ? `${l.efficiencyPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>${fmt(l.totalCost)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditFuel(l)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteFuel(l.id)}>Del</button>
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
          COST TRACKING TAB
         ═══════════════════════════════════════ */}
      {tab === 'costs' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredCosts.length === 0 ? <div className="empty">No cost entries recorded.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Generator</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCosts.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{e.period || (e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '—')}</td>
                      <td><span className={`badge ${badgeMap[e.category] || 'badge-gray'}`}>{e.category}</span></td>
                      <td style={{ fontSize: '.85rem' }}>{e.description}</td>
                      <td>{e.generatorId ? genName(e.generatorId) : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>${fmt(e.amount)}</td>
                      <td style={{ fontSize: '.82rem' }}>{e.currency || 'USD'}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: '180px' }}>{e.notes || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditCost(e)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteCost(e.id)}>Del</button>
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
          OPTIMIZATIONS TAB
         ═══════════════════════════════════════ */}
      {tab === 'optimize' && (
        <div className="card">
          {loading ? <div className="loading">Loading...</div> :
          filteredOpts.length === 0 ? <div className="empty">No optimization strategies defined.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Strategy</th>
                    <th>Status</th>
                    <th>Target Saving</th>
                    <th>Actual Saving</th>
                    <th>Cost Saving</th>
                    <th>Emission Cut</th>
                    <th>Generators</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpts.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.title}</strong></td>
                      <td style={{ fontSize: '.82rem', maxWidth: '200px' }}>{o.strategy || '—'}</td>
                      <td><span className={`badge ${badgeMap[o.status]}`}>{o.status}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{o.targetSavingPct ? `${o.targetSavingPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.actualSavingPct ? `${o.actualSavingPct}%` : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>{o.estimatedCostSaving ? `$${fmt(o.estimatedCostSaving)}` : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{o.emissionReductionPct ? `-${o.emissionReductionPct}%` : '—'}</td>
                      <td style={{ fontSize: '.82rem' }}>{o.affectedGenerators || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditOpt(o)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteOpt(o.id)}>Del</button>
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
          FUEL MODAL
         ═══════════════════════════════════════ */}
      {fuelModal && (
        <div className="modal-overlay" onClick={() => setFuelModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{fuelModal === 'new' ? '⛽ Log Fuel Consumption' : '⛽ Edit Fuel Log'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Generator *</label>
                <select value={fForm.generatorId} onChange={e => setF('generatorId', e.target.value)}>
                  <option value="">Select generator...</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fuel Type</label>
                <select value={fForm.fuelType} onChange={e => setF('fuelType', e.target.value)}>
                  {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Period</label>
                <input value={fForm.period} onChange={e => setF('period', e.target.value)} placeholder="e.g. 2026-03, Week 10" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Consumption (Liters)</label>
                <input type="number" step="0.1" value={fForm.consumptionLiters} onChange={e => setF('consumptionLiters', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Consumption (kg)</label>
                <input type="number" step="0.1" value={fForm.consumptionKg} onChange={e => setF('consumptionKg', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Run Hours</label>
                <input type="number" step="0.1" value={fForm.runHours} onChange={e => setF('runHours', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Load %</label>
                <input type="number" step="0.1" min="0" max="100" value={fForm.loadPct} onChange={e => setF('loadPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Heat Rate (kJ/kWh)</label>
                <input type="number" step="1" value={fForm.heatRateKjKwh} onChange={e => setF('heatRateKjKwh', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Efficiency %</label>
                <input type="number" step="0.1" min="0" max="100" value={fForm.efficiencyPct} onChange={e => setF('efficiencyPct', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cost per Unit</label>
                <input type="number" step="0.01" value={fForm.costPerUnit} onChange={e => setF('costPerUnit', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Total Cost ($)</label>
                <input type="number" step="0.01" value={fForm.totalCost} onChange={e => setF('totalCost', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={fForm.notes} onChange={e => setF('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setFuelModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFuel} disabled={saving || !fForm.generatorId}>
                {saving ? 'Saving...' : fuelModal === 'new' ? 'Log Fuel' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          COST MODAL
         ═══════════════════════════════════════ */}
      {costModal && (
        <div className="modal-overlay" onClick={() => setCostModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{costModal === 'new' ? '💰 Add Cost Entry' : '💰 Edit Cost Entry'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Category *</label>
                <select value={cForm.category} onChange={e => setC('category', e.target.value)}>
                  {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Generator (optional)</label>
                <select value={cForm.generatorId} onChange={e => setC('generatorId', e.target.value)}>
                  <option value="">General / All</option>
                  {generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Period</label>
                <input value={cForm.period} onChange={e => setC('period', e.target.value)} placeholder="e.g. 2026-03" />
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <input value={cForm.description} onChange={e => setC('description', e.target.value)} placeholder="e.g. Monthly diesel procurement, Turbine blade replacement" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Amount ($) *</label>
                <input type="number" step="0.01" value={cForm.amount} onChange={e => setC('amount', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select value={cForm.currency} onChange={e => setC('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={cForm.notes} onChange={e => setC('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCostModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCost} disabled={saving || !cForm.description || !cForm.amount}>
                {saving ? 'Saving...' : costModal === 'new' ? 'Add Cost' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          OPTIMIZATION MODAL
         ═══════════════════════════════════════ */}
      {optModal && (
        <div className="modal-overlay" onClick={() => setOptModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{optModal === 'new' ? '🎯 New Optimization Strategy' : '🎯 Edit Optimization'}</h2>
            <div className="form-group">
              <label>Title *</label>
              <input value={oForm.title} onChange={e => setO('title', e.target.value)} placeholder="e.g. Night-time unit shutdown, Economizer upgrade" />
            </div>
            <div className="form-group">
              <label>Strategy / Description</label>
              <textarea value={oForm.strategy} onChange={e => setO('strategy', e.target.value)} placeholder="Describe the optimization approach..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select value={oForm.status} onChange={e => setO('status', e.target.value)}>
                  {OPTIMIZATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Affected Generators</label>
                <input value={oForm.affectedGenerators} onChange={e => setO('affectedGenerators', e.target.value)} placeholder="e.g. GT-01, GT-02" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Target Saving %</label>
                <input type="number" step="0.1" value={oForm.targetSavingPct} onChange={e => setO('targetSavingPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Actual Saving %</label>
                <input type="number" step="0.1" value={oForm.actualSavingPct} onChange={e => setO('actualSavingPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Est. Cost Saving ($)</label>
                <input type="number" step="0.01" value={oForm.estimatedCostSaving} onChange={e => setO('estimatedCostSaving', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Emission Reduction %</label>
                <input type="number" step="0.1" value={oForm.emissionReductionPct} onChange={e => setO('emissionReductionPct', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Implemented At</label>
                <input type="datetime-local" value={oForm.implementedAt} onChange={e => setO('implementedAt', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={oForm.notes} onChange={e => setO('notes', e.target.value)} rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOptModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveOpt} disabled={saving || !oForm.title}>
                {saving ? 'Saving...' : optModal === 'new' ? 'Create Strategy' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
