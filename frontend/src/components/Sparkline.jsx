// Minimal dependency-free line chart. Good enough for GMP/sentiment trend
// strips; swap for recharts if you need axes, tooltips, zoom, etc.
export default function Sparkline({ points, width = 280, height = 60, color = "var(--accent)" }) {
  if (!points || points.length < 2) {
    return <div className="section-sub">Not enough history yet to draw a trend.</div>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 6;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  const trendColor = values[values.length - 1] >= values[0] ? "var(--positive)" : "var(--negative)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color || trendColor} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={trendColor} />
    </svg>
  );
}
