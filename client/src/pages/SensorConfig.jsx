import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const PARAMETERS = [
  'steam_temp', 'steam_pressure', 'cond_vacuum', 'vibration',
  'bearing_temp', 'exhaust_temp', 'load', 'frequency',
];

const EMPTY_TAG = {
  tagName: '', parameter: 'steam_temp', unit: '°C', assetId: '',
  generationUnit: 1, minRange: 0, maxRange: 100,
  warnLow: null, warnHigh: null, critLow: null, critHigh: null,
  protocol: 'opc-ua', address: '', active: true,
};

export default function SensorConfig() {
  const [tags, setTags] = useState([]);
  const [assets, setAssets] = useState([]);
  const [genUnits, setGenUnits] = useState([]);
  const [editing, setEditing] = useState(null); // tag being edited or 'new'
  const [form, setForm] = useState({ ...EMPTY_TAG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tagsRes, assetsRes, units] = await Promise.all([
        api.sensorTags.list(500),
        api.assets.list(500),
        api.generationUnits.list(),
      ]);
      setTags(tagsRes.data || []);
      setAssets(assetsRes.data || []);
      setGenUnits(units || []);
    } catch (err) {
      console.error('Failed to load sensor config:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ ...EMPTY_TAG });
    setEditing('new');
  }

  function openEdit(tag) {
    setForm({ ...tag });
    setEditing(tag.id);
  }

  function closeForm() {
    setEditing(null);
    setForm({ ...EMPTY_TAG });
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.sensorTags.create(form);
      } else {
        await api.sensorTags.update(editing, form);
      }
      closeForm();
      await load();
    } catch (err) {
      alert('Error saving tag: ' + err.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this sensor tag?')) return;
    try {
      await api.sensorTags.remove(id);
      await load();
    } catch (err) {
      alert('Error deleting tag: ' + err.message);
    }
  }

  async function handleToggleActive(tag) {
    try {
      await api.sensorTags.update(tag.id, { active: !tag.active });
      await load();
    } catch (err) {
      alert('Error toggling tag: ' + err.message);
    }
  }

  const byUnit = {};
  tags.forEach(t => {
    const key = t.generationUnit || 'unassigned';
    if (!byUnit[key]) byUnit[key] = [];
    byUnit[key].push(t);
  });

  if (loading) return <div className="page-loading">Loading sensor configuration…</div>;

  return (
    <div className="sensor-config">
      <div className="page-header">
        <div>
          <h1>🔗 Sensor Tag Configuration</h1>
          <div className="subtitle">Map DCS tags to parameters for live monitoring</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Tag</button>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{tags.length}</div>
          <div className="stat-label">Total Tags</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tags.filter(t => t.active).length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tags.filter(t => t.protocol === 'opc-ua').length}</div>
          <div className="stat-label">OPC-UA</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tags.filter(t => t.protocol === 'modbus').length}</div>
          <div className="stat-label">Modbus</div>
        </div>
      </div>

      {/* Tags grouped by unit */}
      {Object.entries(byUnit).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([unitNum, unitTags]) => {
        const unitInfo = genUnits.find(u => u.unitNumber === Number(unitNum));
        return (
          <div key={unitNum} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '.75rem' }}>
              ⚙️ {unitInfo ? unitInfo.name : `Unit ${unitNum}`}
              <span className="badge badge-blue" style={{ marginLeft: '.5rem' }}>{unitTags.length} tags</span>
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tag Name</th>
                    <th>Parameter</th>
                    <th>Protocol</th>
                    <th>Address</th>
                    <th>Range</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unitTags.map(tag => (
                    <tr key={tag.id} style={{ opacity: tag.active ? 1 : 0.5 }}>
                      <td><strong>{tag.tagName}</strong></td>
                      <td>{tag.parameter}</td>
                      <td><span className="badge badge-gray">{tag.protocol || 'opc-ua'}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{tag.address || '—'}</td>
                      <td>{tag.minRange} – {tag.maxRange}</td>
                      <td>{tag.unit}</td>
                      <td>
                        <button
                          className={`badge ${tag.active ? 'badge-green' : 'badge-red'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => handleToggleActive(tag)}
                        >
                          {tag.active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(tag)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tag.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {tags.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>No sensor tags configured</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Add sensor tags to connect to your DCS (OPC-UA / Modbus) for live plant data.
          </p>
          <button className="btn btn-primary" onClick={openNew}>+ Add First Tag</button>
        </div>
      )}

      {/* Edit / New Modal */}
      {editing !== null && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>{editing === 'new' ? '➕ New Sensor Tag' : '✏️ Edit Sensor Tag'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="form-group">
                <label>Tag Name (DCS ID)</label>
                <input value={form.tagName} onChange={e => updateField('tagName', e.target.value)} placeholder="e.g. U1_STEAM_TEMP" />
              </div>
              <div className="form-group">
                <label>Parameter</label>
                <select value={form.parameter} onChange={e => updateField('parameter', e.target.value)}>
                  {PARAMETERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Protocol</label>
                <select value={form.protocol || 'opc-ua'} onChange={e => updateField('protocol', e.target.value)}>
                  <option value="opc-ua">OPC-UA</option>
                  <option value="modbus">Modbus</option>
                  <option value="csv">CSV Import</option>
                </select>
              </div>
              <div className="form-group">
                <label>Address / Node ID</label>
                <input value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="ns=2;s=U1.SteamTemp" />
              </div>
              <div className="form-group">
                <label>Engineering Unit</label>
                <input value={form.unit} onChange={e => updateField('unit', e.target.value)} placeholder="°C, bar, MW…" />
              </div>
              <div className="form-group">
                <label>Generation Unit</label>
                <select value={form.generationUnit} onChange={e => updateField('generationUnit', Number(e.target.value))}>
                  {genUnits.map(u => <option key={u.id} value={u.unitNumber}>{u.name}</option>)}
                  {genUnits.length === 0 && <>
                    <option value={1}>Unit 1</option>
                    <option value={2}>Unit 2</option>
                  </>}
                </select>
              </div>
              <div className="form-group">
                <label>Linked Asset</label>
                <select value={form.assetId || ''} onChange={e => updateField('assetId', e.target.value || null)}>
                  <option value="">— None —</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Active</label>
                <select value={form.active ? 'true' : 'false'} onChange={e => updateField('active', e.target.value === 'true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <h4 style={{ marginTop: '1rem', marginBottom: '.5rem' }}>Range & Alarm Thresholds</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
              <div className="form-group">
                <label>Min Range</label>
                <input type="number" value={form.minRange ?? ''} onChange={e => updateField('minRange', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Max Range</label>
                <input type="number" value={form.maxRange ?? ''} onChange={e => updateField('maxRange', Number(e.target.value))} />
              </div>
              <div />
              <div className="form-group">
                <label>Warn Low</label>
                <input type="number" value={form.warnLow ?? ''} onChange={e => updateField('warnLow', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-group">
                <label>Warn High</label>
                <input type="number" value={form.warnHigh ?? ''} onChange={e => updateField('warnHigh', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div />
              <div className="form-group">
                <label>Critical Low</label>
                <input type="number" value={form.critLow ?? ''} onChange={e => updateField('critLow', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-group">
                <label>Critical High</label>
                <input type="number" value={form.critHigh ?? ''} onChange={e => updateField('critHigh', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.tagName}>
                {saving ? 'Saving…' : 'Save Tag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
