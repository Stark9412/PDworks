import Panel from "./Panel.jsx";

export default function MetricCard({ label, value, className = "" }) {
  return (
    <Panel className={`metric-card${className ? ` ${className}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </Panel>
  );
}

