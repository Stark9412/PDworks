export default function Button({
  children,
  variant = "default",
  size = "md",
  active = false,
  className = "",
  ...props
}) {
  const cls = [
    "ui-btn",
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    active ? "is-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={cls}>
      {children}
    </button>
  );
}
