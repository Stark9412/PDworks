import { diffDays } from "../../../data.js";

function iso(value) {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysIso(anchorDate, days) {
  const next = new Date(anchorDate);
  next.setDate(next.getDate() + Number(days || 0));
  return iso(next);
}

function monthStartIso(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return iso(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEndIso(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return iso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addMonthsIso(value, months) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return iso(new Date(date.getFullYear(), date.getMonth() + Number(months || 0), date.getDate()));
}

export function timelineBoundsIso(anchorDate = new Date()) {
  const min = monthStartIso(addDaysIso(anchorDate, -365 * 2));
  const max = monthEndIso(addDaysIso(anchorDate, 365 * 2));
  return { min, max };
}

export function clampIso(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function ensureTimelineWindow(prevWindow, targetIso, bounds = timelineBoundsIso()) {
  const targetStart = clampIso(monthStartIso(targetIso), bounds.min, bounds.max);
  const targetEnd = clampIso(monthEndIso(targetIso), bounds.min, bounds.max);

  if (!prevWindow) {
    return {
      window: { start: targetStart, end: targetEnd },
      changed: true,
    };
  }

  let nextStart = prevWindow.start;
  let nextEnd = prevWindow.end;

  while (targetStart < nextStart && nextStart > bounds.min) {
    nextStart = monthStartIso(addMonthsIso(nextStart, -1));
  }

  while (targetEnd > nextEnd && nextEnd < bounds.max) {
    nextEnd = monthEndIso(addMonthsIso(nextEnd, 1));
  }

  nextStart = clampIso(nextStart, bounds.min, bounds.max);
  nextEnd = clampIso(nextEnd, bounds.min, bounds.max);

  if (nextStart === prevWindow.start && nextEnd === prevWindow.end) {
    return { window: prevWindow, changed: false };
  }

  return {
    window: { start: nextStart, end: nextEnd },
    changed: true,
  };
}

export function extendTimelineWindow(prevWindow, direction, bounds = timelineBoundsIso()) {
  if (!prevWindow) return { window: prevWindow, changed: false, adjustDays: 0 };

  if (direction === "left") {
    const nextStart = clampIso(monthStartIso(addMonthsIso(prevWindow.start, -1)), bounds.min, bounds.max);
    if (nextStart === prevWindow.start) return { window: prevWindow, changed: false, adjustDays: 0 };
    const adjustDays = diffDays(nextStart, prevWindow.start);
    return {
      window: { ...prevWindow, start: nextStart },
      changed: true,
      adjustDays: Number.isFinite(adjustDays) ? adjustDays : 0,
    };
  }

  const nextEnd = clampIso(monthEndIso(addMonthsIso(prevWindow.end, 1)), bounds.min, bounds.max);
  if (nextEnd === prevWindow.end) return { window: prevWindow, changed: false, adjustDays: 0 };
  return {
    window: { ...prevWindow, end: nextEnd },
    changed: true,
    adjustDays: 0,
  };
}
