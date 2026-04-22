export default function Panel({ title, className = "", actions = null, children }) {
  return (
    <section className={`ui-panel${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <header className="ui-panel-head">
          {title && <h3>{title}</h3>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

