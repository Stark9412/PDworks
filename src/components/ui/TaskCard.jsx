import Button from "./Button.jsx";

export default function TaskCard({
  title,
  subtitle = "",
  overdue = 0,
  variant = "chip",
  className = "",
  stopPropagation = false,
  onClick,
}) {
  const handleClick = (event) => {
    if (stopPropagation) event.stopPropagation();
    onClick?.(event);
  };

  return (
    <Button
      className={`task-card task-card-${variant}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
    >
      <div className="task-card-title">{title}</div>
      {subtitle ? <div className="task-card-sub">{subtitle}</div> : null}
      {overdue > 0 ? <span className="overdue">+{overdue}일</span> : null}
    </Button>
  );
}
