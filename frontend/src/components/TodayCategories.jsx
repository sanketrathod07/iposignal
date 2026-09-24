const CATEGORIES = [
  { key: "all", label: "All Activity", icon: "📊" },
  { key: "openNow", label: "Open Now", icon: "⚡" },
  { key: "openingToday", label: "Opening Today", icon: "🎯" },
  { key: "closingToday", label: "Closing Today", icon: "⏳" },
  { key: "closingTomorrow", label: "Closing Tomorrow", icon: "⌛" },
  { key: "listingToday", label: "Listing Today", icon: "🚀" },
  { key: "allotmentToday", label: "Allotment Today", icon: "💎" },
  { key: "startingTomorrow", label: "Starting Soon", icon: "📅" },
  { key: "newlyAnnounced", label: "Announced", icon: "📢" },
];

export default function TodayCategories({ counts = {}, active, onSelect }) {
  const total = (counts.openNow || 0) + (counts.openingToday || 0) + (counts.closingToday || 0);

  return (
    <div className="today-bar-container">
      <div className="today-row">
        {CATEGORIES.map(({ key, label, icon }) => {
          const count = key === "all" ? (total > 0 ? total : Object.values(counts).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0)) : counts[key] || 0;
          const isActive = active === key;
          return (
            <button
              key={key}
              className={`today-pill ${isActive ? "active" : ""} ${count === 0 ? "zero" : ""}`}
              onClick={() => onSelect?.(key)}
            >
              <div className="label">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
              <div className="value">{count}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
