import MetricCard from "../ui/MetricCard.jsx";
import Button from "../ui/Button.jsx";

function queueTone(type) {
  if (type === "delay") return "tone-yellow";
  if (type === "feedback") return "tone-red";
  if (type === "hold") return "tone-blue";
  return "";
}

export default function HomeDashboard({
  metrics,
  quick,
  queue,
  onQuickAction,
  onOpenTask,
}) {
  return (
    <section className="home-dashboard-v2">
      <h2>운영 요약</h2>
      <div className="cards">
        <MetricCard label="전체 작업" value={metrics.total} />
        <MetricCard label="완료" value={metrics.done} />
        <MetricCard label="지연" value={metrics.delayed} />
        <MetricCard label="피드백 건수" value={metrics.feedback} />
      </div>

      <div className="home-grid-v2">
        <article className="panel quickstart-v2">
          <h3>빠른 시작</h3>
          <div className="quick-steps-v2">
            {quick.map((item) => (
              <div key={item.key} className={`quick-step-v2 ${item.done ? "done" : "pending"}`}>
                <div className="head">
                  <strong>{item.title}</strong>
                  <span className={`chip ${item.done ? "tone-green" : "tone-yellow"}`}>
                    {item.done ? "완료" : "점검"}
                  </span>
                </div>
                <div className="sub">{item.description}</div>
                <Button size="sm" onClick={() => onQuickAction?.(item.key)}>
                  {item.actionLabel}
                </Button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel queue-v2">
          <h3>운영 우선 큐</h3>
          {queue.length === 0 && <div className="helper-text">현재 즉시 대응 항목이 없습니다.</div>}
          {queue.map((item) => (
            <button key={item.id} type="button" className="queue-item-v2" onClick={() => onOpenTask?.(item.taskId)}>
              <div className="top">
                <strong>{item.title}</strong>
                <span className={`chip ${queueTone(item.type)}`}>{item.badge}</span>
              </div>
              <div className="meta">{item.meta}</div>
            </button>
          ))}
        </article>
      </div>
    </section>
  );
}
