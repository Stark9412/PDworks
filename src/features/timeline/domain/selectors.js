import { actualEnd, actualStart, hasActualSchedule, hasPlannedSchedule, overlaps } from "../../../domain/timelineCore";

function taskAnchorStart(task) {
  return actualStart(task) || task.ps || null;
}

function taskAnchorEnd(task) {
  return actualEnd(task) || task.pe || null;
}

function byTimelineOrder(a, b) {
  const aStart = String(taskAnchorStart(a) || "");
  const bStart = String(taskAnchorStart(b) || "");
  if (aStart !== bStart) return aStart.localeCompare(bStart);
  const aEnd = String(taskAnchorEnd(a) || "");
  const bEnd = String(taskAnchorEnd(b) || "");
  if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function tasksForParticipantInRange(tasks, participantId, rangeStart, rangeEnd) {
  return tasks
    .filter((task) => {
      if (task.participant_id !== participantId) return false;
      const hasActual = hasActualSchedule(task);
      const hasPlanned = hasPlannedSchedule(task);
      if (!hasActual && !hasPlanned) return false;
      const actualHit = hasActual ? overlaps(task.cs, task.ce, rangeStart, rangeEnd) : false;
      const plannedHit = hasPlanned ? overlaps(task.ps, task.pe, rangeStart, rangeEnd) : false;
      return actualHit || plannedHit;
    })
    .sort(byTimelineOrder);
}

export { byTimelineOrder, tasksForParticipantInRange };
