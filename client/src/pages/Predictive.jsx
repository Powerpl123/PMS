import { useState } from 'react';
import { analyzeAssetReadings } from '../utils/predictive';

export default function Predictive() {
  const [readings, setReadings] = useState('58.2, 60.1, 62.9, 63.4, 70.8');
  const [failures, setFailures] = useState('1');
  const [age, setAge] = useState('7');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const riskClass = result ? `risk-${result.riskLevel}` : '';

  return (
    <div>
      <div className="page-header"><div><h1>🧠 Failure Prediction</h1><div className="subtitle">AI-powered asset risk assessment</div></div></div>
      <div className="card">
        <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
          Enter sensor readings and asset info to get a failure risk assessment.
        </p>
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
