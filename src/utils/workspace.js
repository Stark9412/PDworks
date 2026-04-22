import { diffDays, isCompletedStatus, todayIso } from "../data.js";

const D = (v) => (v instanceof Date ? new Date(v.getTime()) : new Date(`${String(v).slice(0, 10)}T00:00:00`));

const ISO = (v) => {
  const d = D(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDays = (v, n) => {
  const d = D(v);
  d.setDate(d.getDate() + n);
  return d;
};

const monthStart = (v) => {
  const d = D(v);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const monthKey = (v) => ISO(monthStart(v)).slice(0, 7);

const overdueDays = (task) => {
  if (isCompletedStatus(task.status)) return 0;
  const end = task.ce || task.pe;
  if (!end) return 0;
  const delta = diffDays(end, todayIso());
  return delta > 0 ? delta : 0;
};

const deadlineSignal = (task, baseTodayIso = todayIso()) => {
  const deadline = task?.ce || task?.pe;
  if (!deadline) return null;
  const delta = diffDays(baseTodayIso, deadline);
  return {
    date: String(deadline).slice(0, 10),
    delta,
    label: delta > 0 ? `D-${delta}` : delta < 0 ? `D+${Math.abs(delta)}` : "D-Day",
    tone: delta > 0 ? "tone-blue" : delta < 0 ? "tone-red" : "tone-yellow",
  };
};

export { D, ISO, addDays, monthStart, monthKey, overdueDays, deadlineSignal };
