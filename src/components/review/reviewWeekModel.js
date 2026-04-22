import { D } from "../../utils/workspace.js";

export function getWeeklyTaskRange(task) {
  if (task?.cs && task?.ce) {
    return { start: task.cs, end: task.ce };
  }
  if (task?.ps && task?.pe) {
    return { start: task.ps, end: task.pe };
  }
  return null;
}

export function isTaskInWeek(task, weekStart, weekEnd) {
  const range = getWeeklyTaskRange(task);
  if (!range) return false;
  return D(range.start) <= D(weekEnd) && D(range.end) >= D(weekStart);
}

export function getWeekTasks(tasks, weekStart, weekEnd) {
  return (tasks || []).filter((task) => !task?.is_archived && isTaskInWeek(task, weekStart, weekEnd));
}

export function buildWeeklyProjectWriterGroups({ projects, weekTasks, writerName, filterPdId = "" }) {
  return (projects || [])
    .filter((project) => !filterPdId || project.pd_id === filterPdId)
    .map((project) => {
      const writerIds = [
        ...new Set(
          (weekTasks || [])
            .filter((task) => task.project_id === project.id && task.writer_id)
            .map((task) => task.writer_id)
        ),
      ];

      const writers = writerIds
        .map((writerId) => ({
          id: writerId,
          name: writerName(writerId),
        }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));

      return { project, writers };
    })
    .filter((item) => item.writers.length > 0);
}
