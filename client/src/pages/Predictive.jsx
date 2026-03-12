import { useState, useEffect, useCallback } from 'react';
import { analyzeAssetReadings } from '../utils/predictive';
import { api } from '../api';

export default function Predictive() {
  const [readings, setReadings] = useState('58.2, 60.1, 62.9, 63.4, 70.8');
  const [failures, setFailures] = useState('1');
  const [age, setAge] = useState('7');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  /* Sensor-auto-feed state */
  const [tags, setTags] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [autoResults, setAutoResults] = useState([]); // per-tag batch results
  const [batchRunning, setBatchRunning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tagsRes, assetsRes] = await Promise.all([
          api.sensorTags.list(500),
          api.assets.list(500),
        ]);
        setTags((tagsRes.data || []).filter(t => t.active !== false));
        setAssets(assetsRes.data || []);
      } catch { /* tags not available yet */ }
    })();
  }, []);

  /* Auto-load readings from a selected sensor tag */
  const loadFromTag = useCallback(async (tagId) => {
    if (!tagId) return;
    try {
      const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); // last 24h
      const rows = await api.sensorReadings.history(tagId, from, null, 200);
      if (rows.length > 0) {
        setReadings(rows.map(r => r.value.toFixed(2)).join(', '));
      }
    } catch { /* no readings */ }
  }, []);

  /* Auto-load age from a selected asset */
  const loadFromAsset = useCallback(async (assetId) => {
    if (!assetId) return;
    const asset = assets.find(a => a.id === assetId);
    if (asset?.installDate) {
      const years = ((Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 86400000)).toFixed(1);
      setAge(years);
    }
    // Count recent failures (completed critical work orders in last 90 days)
    try {
      const ordersRes = await api.workOrders.list(200);
      const recent = (ordersRes.data || []).filter(o =>
        o.assetId === assetId && o.priority === 'critical' &&
        o.status === 'completed' && o.completedAt &&
        (Date.now() - new Date(o.completedAt).getTime()) < 90 * 86400000
      );
      setFailures(String(recent.length));
    } catch { /* ignore */ }
  }, [assets]);

  function analyze() {
    setLoading(true);
    setResult(null);
    try {
      const parsed = readings.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const res = analyzeAssetReadings({
        readings: parsed,
        recentFailures: Number(failures),
        ageYears: Number(age),
      });
      setResult(res);
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  /* Run batch analysis across all active sensor tags */
  async function runBatchAnalysis() {
    setBatchRunning(true);
    const results = [];
    const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    for (const tag of tags) {
      try {
        const rows = await api.sensorReadings.history(tag.id, from, null, 200);
        if (rows.length >= 3) {
          const values = rows.map(r => r.value);
          const asset = tag.assetId ? assets.find(a => a.id === tag.assetId) : null;
          const ageYears = asset?.installDate
            ? (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 86400000)
            : 0;
          const res = analyzeAssetReadings({ readings: values, recentFailures: 0, ageYears });
          results.push({ tag, asset, ...res, dataPoints: values.length });
        }
      } catch { /* skip */ }
    }
    results.sort((a, b) => (b.failureProbability || 0) - (a.failureProbability || 0));
    setAutoResults(results);
    setBatchRunning(false);
  }

  const riskClass = result ? `risk-${result.riskLevel}` : '';
  const riskColors = { critical: 'var(--danger)', high: '#e67e22', medium: 'var(--warning)', low: 'var(--success)', unknown: 'var(--text-muted)' };

  return (
    <div>
      <div className="page-header"><div><h1>🧠 Failure Prediction</h1><div className="subtitle">AI-powered asset risk assessment — auto-fed from live sensors</div></div></div>

      {/* Batch analysis from live data */}
      {tags.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>🔄 Auto-Analysis (Live Sensor Data)</h3>
            <button className="btn btn-primary" onClick={runBatchAnalysis} disabled={batchRunning}>
              {batchRunning ? '⏳ Analyzing…' : '▶ Run Batch Analysis'}
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Automatically analyzes the last 24 hours of readings from all {tags.length} active sensor tags.
          </p>

          {autoResults.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Parameter</th>
                    <th>Unit</th>
                    <th>Asset</th>
                    <th>Data Points</th>
                    <th>Risk</th>
                    <th>Failure Prob.</th>
                    <th>Anomalies</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {autoResults.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.tag.tagName}</strong></td>
                      <td>{r.tag.parameter}</td>
                      <td>Unit {r.tag.generationUnit}</td>
                      <td>{r.asset?.name || '—'}</td>
                      <td>{r.dataPoints}</td>
                      <td>
                        <span className={`badge`} style={{ background: riskColors[r.riskLevel], color: '#fff' }}>
                          {r.riskLevel}
                        </span>
                      </td>
                      <td>{r.failureProbability !== null ? `${(r.failureProbability * 100).toFixed(1)}%` : '—'}</td>
                      <td>{r.anomalyCount}</td>
                      <td style={{ fontSize: '.85rem', maxWidth: '250px' }}>{r.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual analysis */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>📝 Manual Analysis</h3>
        <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
          Enter sensor readings manually, or auto-fill from a sensor tag.
        </p>

        {/* Auto-fill selectors */}
        {tags.length > 0 && (
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Auto-fill from Sensor Tag</label>
              <select value={selectedTag} onChange={e => { setSelectedTag(e.target.value); loadFromTag(e.target.value); }}>
                <option value="">— Select tag —</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.tagName} ({t.parameter}, Unit {t.generationUnit})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Auto-fill from Asset</label>
              <select value={selectedAsset} onChange={e => { setSelectedAsset(e.target.value); loadFromAsset(e.target.value); }}>
                <option value="">— Select asset —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Sensor Readings (comma-separated numbers)</label>
          <textarea value={readings} onChange={e => setReadings(e.target.value)} rows={2} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Recent Failures (last 90 days)</label>
            <input type="number" min="0" value={failures} onChange={e => setFailures(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Asset Age (years)</label>
            <input type="number" min="0" value={age} onChange={e => setAge(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          {loading ? 'Analyzing...' : '🔍 Run Analysis'}
        </button>

        {result && (
          <div className="predict-result">
            <h3>Analysis Results</h3>
            <div className="metric">
              <span>Risk Level</span>
              <strong className={riskClass} style={{ fontSize: '1.1rem', textTransform: 'uppercase' }}>{result.riskLevel}</strong>
            </div>
            <div className="metric">
              <span>Failure Probability</span>
              <strong>{result.failureProbability !== null ? `${(result.failureProbability * 100).toFixed(1)}%` : 'N/A'}</strong>
            </div>
            <div className="metric">
              <span>Anomalies Detected</span>
              <strong>{result.anomalyCount}</strong>
            </div>
            {result.trendSlope !== undefined && (
              <div className="metric">
                <span>Trend Slope</span>
                <strong>{result.trendSlope > 0 ? '📈' : '📉'} {result.trendSlope?.toFixed(2)}</strong>
              </div>
            )}
            <div className="recommendation">
              💡 {result.recommendation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
