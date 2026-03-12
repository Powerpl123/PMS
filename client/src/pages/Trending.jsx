import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

/* Simple inline SVG line chart - no external dependency */
function MiniChart({ points, width = 500, height = 150, color = 'var(--accent)' }) {
  if (!points || points.length < 2) {
    return <div className="empty" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Not enough data</div>;
  }
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 8;

  const pathD = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
      {/* axis labels */}
      <text x={pad} y={height - 2} fontSize="10" fill="var(--text-muted)">
        {points[0]?.ts ? new Date(points[0].ts).toLocaleTimeString() : ''}
      </text>
      <text x={width - pad} y={height - 2} fontSize="10" fill="var(--text-muted)" textAnchor="end">
        {points[points.length - 1]?.ts ? new Date(points[points.length - 1].ts).toLocaleTimeString() : ''}
      </text>
      <text x={2} y={pad + 4} fontSize="10" fill="var(--text-muted)">{max.toFixed(1)}</text>
      <text x={2} y={height - pad - 2} fontSize="10" fill="var(--text-muted)">{min.toFixed(1)}</text>
    </svg>
  );
}

const TIME_RANGES = [
  { label: '1 H',  value: 1 },
  { label: '6 H',  value: 6 },
  { label: '24 H', value: 24 },
  { label: '7 D',  value: 168 },
];

export default function Trending() {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [rangeHours, setRangeHours] = useState(6);
  const [chartData, setChartData] = useState({}); // { tagId: [{value, ts}...] }
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const unsubRef = useRef(null);

  const [refreshKey, setRefreshKey] = useState(0);

  /* Load available tags */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.sensorTags.list(500);
        const active = (res.data || []).filter(t => t.active !== false);
        setTags(active);
        // auto-select first 4
        setSelectedTags(active.slice(0, 4).map(t => t.id));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  /* Fetch history when tags or range change */
  useEffect(() => {
    if (selectedTags.length === 0) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const from = new Date(Date.now() - rangeHours * 3600 * 1000).toISOString();
      const results = {};
      await Promise.all(selectedTags.map(async (tagId) => {
        try {
          const rows = await api.sensorReadings.history(tagId, from, null, 1000);
          results[tagId] = rows.map(r => ({ value: r.value, ts: r.timestamp }));
        } catch { results[tagId] = []; }
      }));
      if (!cancelled) {
        setChartData(results);
        setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTags, rangeHours, refreshKey]);

  /* Subscribe to live updates for selected tags */
  useEffect(() => {
    if (selectedTags.length === 0) return;
    if (unsubRef.current) unsubRef.current();

    unsubRef.current = api.sensorReadings.subscribe(selectedTags, (reading) => {
      setChartData(prev => {
        const existing = prev[reading.tagId] || [];
        return {
          ...prev,
          [reading.tagId]: [...existing, { value: reading.value, ts: reading.timestamp }].slice(-1000),
        };
      });
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [selectedTags]);

  function toggleTag(tagId) {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }

  const tagMap = {};
  tags.forEach(t => { tagMap[t.id] = t; });

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div className="trending-page">
      <div className="page-header">
        <div>
          <h1>📈 Sensor Trending</h1>
          <div className="subtitle">Historical data &amp; live trend charts</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              className={`btn btn-sm ${rangeHours === r.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRangeHours(r.value)}
            >
              {r.label}
            </button>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => setRefreshKey(k => k + 1)} disabled={fetching}>
            {fetching ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Tag selector */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <strong>Select Tags: </strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.5rem' }}>
          {tags.map(t => (
            <button
              key={t.id}
              className={`badge ${selectedTags.includes(t.id) ? 'badge-blue' : 'badge-gray'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '.35rem .7rem' }}
              onClick={() => toggleTag(t.id)}
            >
              {t.tagName} ({t.parameter})
            </button>
          ))}
          {tags.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>No sensor tags configured. Go to Sensor Config to add tags.</span>
          )}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1rem' }}>
        {selectedTags.map(tagId => {
          const tag = tagMap[tagId];
          const points = chartData[tagId] || [];
          if (!tag) return null;
          return (
            <div key={tagId} className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                <div>
                  <strong>{tag.tagName}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '.5rem', fontSize: '.85rem' }}>
                    {tag.parameter} · Unit {tag.generationUnit}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {points.length > 0 && (
                    <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                      {points[points.length - 1].value.toFixed(1)}
                      <small style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}> {tag.unit}</small>
                    </span>
                  )}
                </div>
              </div>
              <MiniChart points={points} color="var(--accent)" />
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                {points.length} data points · Last {rangeHours}h
              </div>
            </div>
          );
        })}
      </div>

      {selectedTags.length === 0 && tags.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>Select tags above to view trends</h3>
        </div>
      )}
    </div>
  );
}
