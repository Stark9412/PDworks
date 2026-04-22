export default function FormBlock({ title, className = "", children }) {
  return (
    <section className={`drawer-block${className ? ` ${className}` : ""}`}>
      {title ? <h4>{title}</h4> : null}
      {children}
    </section>
  );
}
