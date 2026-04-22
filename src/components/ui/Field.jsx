export default function Field({ label, children, className = "", required = false }) {
  return (
    <label className={`ui-field${className ? ` ${className}` : ""}`}>
      <span className="ui-field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

