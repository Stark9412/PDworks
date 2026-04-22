import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import ModalShell from "../ui/ModalShell.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { getLabelStatus } from "../../data";
import { resolveTaskSerializationDate } from "../../utils/serialization.js";
import { buildTaskSummary, formatEpisodeLabel } from "../../utils/taskPresentation.js";

function matchesArchiveRange(task, fromDate, toDate) {
  const points = [task.approved_at, task.ce, task.cs, task.pe, task.ps].filter(Boolean).sort();
  if (!points.length) return false;
  const start = points[0];
  const end = points[points.length - 1];
  if (fromDate && end < fromDate) return false;
  if (toDate && start > toDate) return false;
  return true;
}

function buildInitialRange(tasks) {
  const archived = tasks.filter((task) => task.is_archived);
  if (!archived.length) return { from: "", to: "" };
  const points = archived
    .flatMap((task) => [task.approved_at, task.ce, task.cs, task.pe, task.ps])
    .filter(Boolean)
    .sort();
  return {
    from: points[0] || "",
    to: points[points.length - 1] || "",
  };
}

export default function KanbanArchiveOverlay({
  open,
  tasks,
  writerName,
  serializationMap,
  onClose,
  onOpenTask,
  onRestoreTask,
}) {
  const [range, setRange] = useState(() => buildInitialRange(tasks));

  useEffect(() => {
    if (!open) return;
    setRange(buildInitialRange(tasks));
  }, [open, tasks]);

  const archivedTasks = useMemo(
    () => tasks.filter((task) => task.is_archived),
    [tasks]
  );

  const filteredTasks = useMemo(
    () =>
      archivedTasks
        .filter((task) => matchesArchiveRange(task, range.from, range.to))
        .sort((a, b) =>
          String(b.approved_at || b.ce || b.pe || "").localeCompare(String(a.approved_at || a.ce || a.pe || ""))
        ),
    [archivedTasks, range.from, range.to]
  );

  return (
    <ModalShell
      open={open}
      title="최종보관"
      onClose={onClose}
      className="kanban-archive-modal"
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      <div className="kanban-archive-toolbar">
        <div className="kanban-archive-range">
          <Field label="시작일">
            <input
              className="ui-input"
              type="date"
              value={range.from}
              onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
            />
          </Field>
          <div className="kanban-archive-tilde">~</div>
          <Field label="종료일">
            <input
              className="ui-input"
              type="date"
              value={range.to}
              onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
            />
          </Field>
        </div>
        <div className="kanban-archive-count">{filteredTasks.length}건</div>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState>조건에 맞는 최종보관 작업이 없습니다.</EmptyState>
      ) : (
        <div className="kanban-archive-list">
          {filteredTasks.map((task) => (
            <article key={task.id} className="kanban-archive-card">
              <button type="button" className="kanban-archive-open" onClick={() => onOpenTask(task.id)}>
                <div className="kanban-archive-head">
                  <strong>{buildTaskSummary(task)}</strong>
                  <span>{getLabelStatus(task.status)}</span>
                </div>
                <div className="kanban-archive-meta">
                  <span>{formatEpisodeLabel(task.episode_no)}</span>
                  <span>{task.type || "-"}</span>
                  <span>{writerName(task.writer_id)}</span>
                </div>
                <div className="kanban-archive-meta">
                  <span>{task.cs || task.ps || "-"} ~ {task.ce || task.pe || "-"}</span>
                  <span>{resolveTaskSerializationDate(task, serializationMap) || "연재일 미정"}</span>
                </div>
              </button>
              <div className="kanban-archive-actions">
                <Button size="sm" onClick={() => onRestoreTask?.(task.id)}>복원</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
