export default function DateInput({ value, onChange, min, max, readOnly = false, disabled = false }) {
  return (
    <input
      className="ui-input ui-input-date"
      type="date"
      value={value || ""}
      min={min}
      max={max}
      readOnly={readOnly}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
