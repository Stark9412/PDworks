import { useMemo, useState } from "react";
import {
  STATUS,
  getLabelStatus,
  getStatusVisualKey,
  isCompletedStatus,
  normalizeTaskStatus,
  todayIso as todayIsoLocal,
} from "../../data";
import Button from "../ui/Button.jsx";
import { overdueDays, deadlineSignal } from "../../utils/workspace";
import { resolveTaskSerializationDate } from "../../utils/serialization.js";
import { buildTaskSummary, formatEpisodeLabel } from "../../utils/taskPresentation.js";

function statusClass(status) {
  const visual = getStatusVisualKey(status);
  if (visual === "in_progress") return "in-progress";
  return visual || "not_started";
}

function progressTone(task, todayIso) {
  const status = normalizeTaskStatus(task.status);
  if (isCompletedStatus(status)) return "done";
  if (status === "feedback_requested") return "hold";
  const end = task.ce || task.pe;
  if (end && end < todayIso) return "overdue";
  if (task.cs && task.ce && task.cs <= todayIso && todayIso <= task.ce) return "in_progress_today";
  if (task.ps && task.pe && task.ps <= todayIso && todayIso <= task.pe) return "in_progress_today";
  if (status === "planned") return "planned";
  const overdue = overdueDays(task);
  if (overdue > 0) return "overdue";
  return "in_progress_today";
}

export default function KanbanView({
  tasks,
  participants,
  writerName,
  serializationMap,
  focusParticipantId,
  dragParticipantId,
  onOpenTask,
  onCreateAtStatus,
  onMoveTaskStatus,
  onClickStatusChange,
  onDropParticipant,
  onArchiveTask,
}) {
  const hiddenSet = new Set(
    participants.filter((participant) => participant.hidden_from_ops).map((participant) => participant.id)
  );
  const [dragTaskId, setDragTaskId] = useState(null);
  const todayIso = todayIsoLocal();

  const sourceTasks = tasks.filter((task) => {
    if (hiddenSet.has(task.participant_id)) return false;
    if (focusParticipantId && task.participant_id !== focusParticipantId) return false;
    return !task.is_archived;
  });

  const startTaskDrag = (event, taskId) => {
    setDragTaskId(taskId);
    if (event.dataTransfer) {
      event.dataTransfer.setData("application/x-task-id", taskId);
      event.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <div className="kanban-v2">
      <div className="kanban-meta-v2">
        <div className="title">운영 칸반</div>
        <div className="desc">전체 작업을 상태 기준으로 확인합니다.</div>
      </div>

      <div className="kanban-board-v2">
        {STATUS.map(([statusKey, label]) => {
          const list = sourceTasks
            .filter((task) => normalizeTaskStatus(task.status) === statusKey)
            .sort((a, b) => String(a.ce || a.pe || "").localeCompare(String(b.ce || b.pe || "")));

          return (
            <section
              key={statusKey}
              className={`kanban-col-v2 status-${statusClass(statusKey)} ${dragParticipantId ? "drop-ready" : ""}`}
              onDragOver={(event) => {
                const taskId = event.dataTransfer?.getData?.("application/x-task-id") || dragTaskId;
                const canTaskDrop = Boolean(taskId);
                const canParticipantDrop = Boolean(dragParticipantId);
                if (!canTaskDrop && !canParticipantDrop) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = taskId ? "move" : "copy";
              }}
              onDrop={(event) => {
                const taskId = event.dataTransfer?.getData?.("application/x-task-id") || dragTaskId;
                if (taskId) {
                  event.preventDefault();
                  onMoveTaskStatus?.(taskId, statusKey);
                  setDragTaskId(null);
                  return;
                }
                const participantId = event.dataTransfer.getData("application/x-participant-id") || dragParticipantId;
                if (!participantId) return;
                event.preventDefault();
                onDropParticipant?.(participantId, statusKey, { x: event.clientX, y: event.clientY });
                setDragTaskId(null);
              }}
            >
              <div className="kanban-col-head-v2">
                <div className="main">
                  <strong>{label}</strong>
                  <span className="count">{list.length}</span>
                </div>
                <Button size="sm" className="col-add-btn" onClick={(event) => onCreateAtStatus?.(statusKey, event)}>
                  + 입력
                </Button>
              </div>

              <div className="kanban-list-v2">
                {sourceTasks.length > 0 && list.length === 0 && <div className="empty-mini">작업 없음</div>}

                {list.map((task) => {
                  const deadline = deadlineSignal(task, todayIso);
                  const scheduleText = `${task.cs || "-"} ~ ${task.ce || "-"}`;
                  const normalizedStatus = normalizeTaskStatus(task.status);
                  const visualStatus = getStatusVisualKey(normalizedStatus);
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => startTaskDrag(event, task.id)}
                      onDragEnd={() => setDragTaskId(null)}
                      className={`kanban-card-v2 status-${statusClass(normalizedStatus)} tone-${progressTone(
                        task,
                        todayIso
                      )} ${focusParticipantId === task.participant_id ? "focus" : ""}`}
                    >
                      {statusKey === "completed" && (
                        <Button
                          size="sm"
                          className="kanban-hover-archive"
                          onClick={(event) => {
                            event.stopPropagation();
                            onArchiveTask?.(task.id);
                          }}
                        >
                          최종보관
                        </Button>
                      )}
                      <button
                        type="button"
                        className="kanban-open-v2"
                        draggable
                        onDragStart={(event) => startTaskDrag(event, task.id)}
                        onDragEnd={() => setDragTaskId(null)}
                        onClick={() => onOpenTask(task.id)}
                      >
                        <div className="head">
                          <span className="episode-text">{formatEpisodeLabel(task.episode_no)}</span>
                          <div className="title">{buildTaskSummary(task)}</div>
                          <span className="spacer" />
                          <span className={`status-chip status-${visualStatus}`}>
                            {getLabelStatus(normalizedStatus)}
                          </span>
                        </div>
                        <div className="meta">
                          <span className="writer">{writerName(task.writer_id)}</span>
                          <span>{resolveTaskSerializationDate(task, serializationMap) || "연재일 미정"}</span>
                          <span>{deadline?.label || "-"}</span>
                        </div>
                        <div className="schedule-row">
                          <span className="label">일정:</span>
                          <span className="value">{scheduleText}</span>
                        </div>
                        <div className="signals status-row">
                          <span className="spacer" />
                          <select
                            className="kanban-inline-status ui-select"
                            value={normalizedStatus}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => onClickStatusChange?.(task.id, event.target.value)}
                          >
                            {STATUS.map(([value, optionLabel]) => (
                              <option key={value} value={value}>
                                {optionLabel}
                              </option>
                            ))}
                          </select>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
