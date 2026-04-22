import { findOverlapTask as findOverlapTaskByWriter } from "../../../domain/timelineCore.js";

const DATE_KEYS = ["ps", "pe", "cs", "ce", "serialization_date"];

const toIso = (value) => (value ? String(value).slice(0, 10) : null);
const toDate = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null);

function normalizeTaskDates(taskLike) {
  const next = { ...taskLike };
  DATE_KEYS.forEach((key) => {
    if (!(key in next)) return;
    next[key] = toIso(next[key]);
  });
  if (next.ps && !next.pe) next.pe = next.ps;
  if (next.pe && !next.ps) next.ps = next.pe;
  if (next.cs && !next.ce) next.ce = next.cs;
  if (next.ce && !next.cs) next.cs = next.ce;
  return next;
}

function validateTaskDateOrder(task) {
  if (task.cs && task.ce && toDate(task.cs) > toDate(task.ce)) return "invalid_actual_range";
  return null;
}

function findPlannedConflict(tasks, taskLike, exceptTaskId = null) {
  return null;
}

function findActualConflict(tasks, taskLike, exceptTaskId = null) {
  const writerId = taskLike.writer_id;
  if (!writerId || !taskLike.project_id || !taskLike.cs || !taskLike.ce) return null;
  const sameProjectTasks = tasks.filter((task) => task.project_id === taskLike.project_id);
  return findOverlapTaskByWriter(sameProjectTasks, {
    writerId,
    start: taskLike.cs,
    end: taskLike.ce,
    exceptTaskId,
    usePlanned: false,
  });
}

function toConflictResponse(mode, conflict, writerId) {
  if (!conflict) return null;
  return {
    ok: false,
    reason: "schedule_conflict",
    mode,
    conflict: {
      taskId: conflict.id,
      title: conflict.title || "",
      writerId,
      start: mode === "planned" ? conflict.ps : conflict.cs,
      end: mode === "planned" ? conflict.pe : conflict.ce,
    },
  };
}

function validateTaskConflicts(tasks, taskLike, exceptTaskId = null) {
  const plannedConflict = findPlannedConflict(tasks, taskLike, exceptTaskId);
  if (plannedConflict) {
    return toConflictResponse("planned", plannedConflict, taskLike.writer_id || null);
  }
  const actualConflict = findActualConflict(tasks, taskLike, exceptTaskId);
  if (actualConflict) {
    return toConflictResponse("actual", actualConflict, taskLike.writer_id || null);
  }
  return null;
}

export { normalizeTaskDates, validateTaskDateOrder, validateTaskConflicts };

