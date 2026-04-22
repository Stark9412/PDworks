import { getLabelStatus } from "../../../data.js";
import { hasActualSchedule, hasPlannedSchedule, overlaps } from "../../../domain/timelineCore.js";

function statusLabel(status) {
  return getLabelStatus(status);
}

function taskTouchesRange(task, start, end) {
  return overlaps(task.cs, task.ce, start, end) || overlaps(task.ps, task.pe, start, end);
}

function monthTaskPoint(task, dateStr) {
  if (hasActualSchedule(task) && task.cs === dateStr) {
    return { label: "실행", tone: "actual", kind: "actual_start" };
  }
  if (hasActualSchedule(task) && task.ce === dateStr) {
    return { label: "마감", tone: "deadline", kind: "deadline" };
  }
  if (!hasActualSchedule(task) && hasPlannedSchedule(task) && task.ps === dateStr) {
    return { label: "예정", tone: "planned", kind: "planned_start" };
  }
  if (!hasActualSchedule(task) && hasPlannedSchedule(task) && task.pe === dateStr) {
    return { label: "마감", tone: "deadline", kind: "deadline" };
  }
  return null;
}

function monthPointRank(point) {
  if (!point) return 99;
  if (point.kind === "deadline") return 0;
  if (point.kind === "actual_start") return 1;
  if (point.kind === "planned_start") return 2;
  return 99;
}

function monthEventsForDate(tasks, dateStr) {
  return tasks
    .map((task) => ({ task, point: monthTaskPoint(task, dateStr) }))
    .filter((entry) => entry.point)
    .sort(
      (a, b) =>
        monthPointRank(a.point) - monthPointRank(b.point) ||
        String(a.task.episode_no ?? 9999).localeCompare(String(b.task.episode_no ?? 9999)) ||
        String(a.task.ce || a.task.pe || "").localeCompare(String(b.task.ce || b.task.pe || ""))
    );
}

function monthCounts(events) {
  return {
    planned: events.filter((entry) => entry.point.kind === "planned_start").length,
    actual: events.filter((entry) => entry.point.kind === "actual_start").length,
    deadline: events.filter((entry) => entry.point.kind === "deadline").length,
  };
}

export { monthCounts, monthEventsForDate, monthTaskPoint, statusLabel, taskTouchesRange };
