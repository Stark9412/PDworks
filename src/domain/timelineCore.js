const DAY_MS = 86400000;

const D = (value) =>
  value instanceof Date
    ? new Date(value.getTime())
    : new Date(`${String(value).slice(0, 10)}T00:00:00`);

const ISO = (value) => {
  const date = D(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const ADD = (value, days) => {
  const date = D(value);
  date.setDate(date.getDate() + days);
  return date;
};

const DIFF = (a, b) => Math.round((D(b) - D(a)) / DAY_MS);

const hasPlannedSchedule = (task) => Boolean(task?.ps && task?.pe);
const hasActualSchedule = (task) => Boolean(task?.cs && task?.ce);

const actualStart = (task) =>
  hasActualSchedule(task) ? task.cs : hasPlannedSchedule(task) ? task.ps : null;
const actualEnd = (task) =>
  hasActualSchedule(task) ? task.ce : hasPlannedSchedule(task) ? task.pe : null;

const overlaps = (aStart, aEnd, bStart, bEnd) => {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return D(aStart) <= D(bEnd) && D(aEnd) >= D(bStart);
};

const clampDragRange = (nextRange, originalRange, mode, limitStart, limitEnd) => {
  if (!nextRange?.start || !nextRange?.end) return nextRange;
  let start = nextRange.start;
  let end = nextRange.end;

  if (mode === "move") {
    const length = DIFF(originalRange.start, originalRange.end);
    if (start < limitStart) {
      start = limitStart;
      end = ISO(ADD(start, length));
    }
    if (end > limitEnd) {
      end = limitEnd;
      start = ISO(ADD(end, -length));
    }
    return { start, end };
  }

  if (mode === "start") {
    if (start < limitStart) start = limitStart;
    if (start > end) start = end;
    return { start, end };
  }

  if (mode === "end") {
    if (end > limitEnd) end = limitEnd;
    if (end < start) end = start;
    return { start, end };
  }

  return { start, end };
};

const applyDragRange = (range, mode, deltaDays) => {
  const { start, end } = range || {};
  if (!start || !end || !deltaDays) return range;

  if (mode === "move") {
    return { start: ISO(ADD(start, deltaDays)), end: ISO(ADD(end, deltaDays)) };
  }
  if (mode === "start") {
    const nextStart = ISO(ADD(start, deltaDays));
    return { start: nextStart <= end ? nextStart : end, end };
  }
  if (mode === "end") {
    const nextEnd = ISO(ADD(end, deltaDays));
    return { start, end: nextEnd >= start ? nextEnd : start };
  }
  return range;
};

const findOverlapTask = (tasks, { writerId, start, end, exceptTaskId, usePlanned }) => {
  if (!writerId || !start || !end) return null;
  const startKey = usePlanned ? "ps" : "cs";
  const endKey = usePlanned ? "pe" : "ce";
  return (
    tasks.find((task) => {
      if (task.id === exceptTaskId) return false;
      if (task.writer_id !== writerId) return false;
      return overlaps(task[startKey], task[endKey], start, end);
    }) || null
  );
};

export {
  D,
  ISO,
  ADD,
  DIFF,
  hasPlannedSchedule,
  hasActualSchedule,
  actualStart,
  actualEnd,
  overlaps,
  applyDragRange,
  clampDragRange,
  findOverlapTask,
};
