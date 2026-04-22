import { useRef } from "react";
import Button from "./Button.jsx";

export default function ModalShell({
  open,
  title,
  closeLabel = "닫기",
  onClose,
  footer = null,
  className = "",
  backdrop = true,
  panelStyle = null,
  panelRef = null,
  children,
}) {
  const backdropPressStarted = useRef(false);

  if (!open) return null;

  const content = (
    <section
      ref={panelRef}
      className={`create-modal ${className}`.trim()}
      style={panelStyle || undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="create-modal-head">
        <h3>{title}</h3>
        <Button onClick={onClose}>{closeLabel}</Button>
      </header>

      <div className="create-modal-body">{children}</div>

      {footer ? <footer className="create-modal-foot">{footer}</footer> : null}
    </section>
  );

  if (!backdrop) return content;

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        backdropPressStarted.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        const shouldClose =
          backdropPressStarted.current && event.target === event.currentTarget;
        backdropPressStarted.current = false;
        if (shouldClose) onClose?.();
      }}
      onPointerCancel={() => {
        backdropPressStarted.current = false;
      }}
    >
      {content}
    </div>
  );
}
