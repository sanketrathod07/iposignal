const COLORS = {
  Official: { bg: "var(--positive-tint)", fg: "var(--positive)" },
  "Verified third-party": { bg: "var(--info-tint)", fg: "var(--info)" },
  Community: { bg: "var(--attention-tint)", fg: "var(--attention)" },
  Unofficial: { bg: "var(--negative-tint)", fg: "var(--negative)" },
  Estimated: { bg: "var(--accent-tint)", fg: "var(--accent-strong)" },
};

export default function ConfidenceBadge({ level }) {
  if (!level) return null;
  const c = COLORS[level] || { bg: "var(--accent-tint)", fg: "var(--text-muted)" };
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        padding: "1px 7px",
        borderRadius: 3,
        background: c.bg,
        color: c.fg,
        letterSpacing: "0.02em",
      }}
    >
      {level}
    </span>
  );
}
