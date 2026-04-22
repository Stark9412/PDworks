import Field from "./Field.jsx";
import DateInput from "./DateInput.jsx";

export default function DateRangeFields({
  startLabel,
  endLabel,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}) {
  return (
    <div className="split-2">
      <Field label={startLabel}>
        <DateInput value={startValue} onChange={onStartChange} />
      </Field>
      <Field label={endLabel}>
        <DateInput value={endValue} onChange={onEndChange} />
      </Field>
    </div>
  );
}
