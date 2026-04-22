export default function ClickableCard({
  children,
  className = "",
  onClick,
  title,
}) {
  const interactive = typeof onClick === "function";

  const handleKeyDown = (event) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className={["entity-card", className].filter(Boolean).join(" ")}
      title={title}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
    >
      {children}
    </article>
  );
}
