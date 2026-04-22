import { getLabelStatus, needsTaskFeedback, normalizeTaskStatus } from "../../data.js";

export function statusLabel(status) {
  return getLabelStatus(status);
}

export function cursorMonthLabel(cursor) {
  if (!cursor) return "";
  const d = cursor instanceof Date ? cursor : new Date(cursor);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function buildWorkspaceTaskOps({ derived, actions }) {
  const taskById = (id) => derived.tasks.find((task) => task.id === id) || null;

  const updateStatus = (taskId, status, source = "status_inline") => {
    void actions.applyTaskPatch(taskId, { status: normalizeTaskStatus(status) }, "", source);
  };

  const toggleFeedback = (taskId) => {
    const current = taskById(taskId);
    if (!current) return;
    const nextStatus = needsTaskFeedback(current) ? "submitted" : "feedback_requested";
    void actions.applyTaskPatch(
      taskId,
      { status: nextStatus, feedback_done: false },
      "",
      "feedback_toggle"
    );
  };

  const markDone = (taskId) => {
    void actions.applyTaskPatch(
      taskId,
      { status: "completed", feedback_done: true, approved_at: new Date().toISOString() },
      "",
      "mark_done"
    );
  };

  return {
    updateStatus,
    toggleFeedback,
    markDone,
  };
}
