import {
  getLabelStatus,
  isCompletedStatus,
  normalizeTaskStatus,
  normalizeWorkType,
} from "../../data";
import { diffDays } from "../../data";
import { overdueDays } from "../../utils/workspace";

export const DAY_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

export function resolveCellWidth() {
  if (typeof window === "undefined") return 82;
  if (window.innerWidth <= 900) return 68;
  if (window.innerWidth <= 1200) return 74;
  return 82;
}

export function resolveLabelWidth() {
  if (typeof window === "undefined") return 180;
  if (window.innerWidth <= 900) return 132;
  if (window.innerWidth <= 1200) return 156;
  return 180;
}

export function inRange(start, end, rangeStart, rangeEnd) {
  if (!start || !end) return false;
  return start <= rangeEnd && end >= rangeStart;
}

export function placeStyle(start, end, rangeStart, days, cellWidth) {
  const startIdx = diffDays(rangeStart, start);
  const endIdx = diffDays(rangeStart, end);
  const from = Math.max(0, startIdx);
  const to = Math.min(days - 1, endIdx);
  if (to < from) return null;
  return {
    left: `${from * cellWidth + 2}px`,
    width: `${(to - from + 1) * cellWidth - 4}px`,
  };
}

export function dayCaption(iso) {
  const date = new Date(`${iso}T00:00:00`);
  const day = DAY_LABEL[(date.getDay() + 6) % 7] || "-";
  return `${iso.slice(5)} (${day})`;
}

export function laneFromOffset(track, offsetY) {
  const styles = getComputedStyle(track);
  const actualTop = Number.parseFloat(styles.getPropertyValue("--actual-lane-top")) || 36;
  return offsetY < actualTop ? "planned" : "actual";
}

export function laneMetrics(track, lane) {
  const styles = getComputedStyle(track);
  if (lane === "planned") {
    return {
      top: (Number.parseFloat(styles.getPropertyValue("--planned-lane-top")) || 6) + 1,
      height: (Number.parseFloat(styles.getPropertyValue("--planned-lane-height")) || 24) - 2,
    };
  }
  return {
    top: (Number.parseFloat(styles.getPropertyValue("--actual-lane-top")) || 36) + 1,
    height: (Number.parseFloat(styles.getPropertyValue("--actual-lane-height")) || 58) - 2,
  };
}

export function roleToType(role) {
  return normalizeWorkType(role, "글");
}

export function statusLabel(status) {
  return getLabelStatus(status);
}

export function taskTone(task, today) {
  const status = normalizeTaskStatus(task.status);
  if (status === "planned") return "planned";
  if (isCompletedStatus(status)) return "done";
  if (status === "feedback_requested") return "hold";
  if (overdueDays(task) > 0) return "in_progress_overdue";
  if (task.cs && task.ce && task.cs <= today && today <= task.ce) return "in_progress_today";
  return "in_progress_today";
}
