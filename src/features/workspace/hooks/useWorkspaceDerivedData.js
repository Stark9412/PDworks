import { useEffect, useMemo } from "react";
import {
  STATUS,
  WORK_TYPE_OPTIONS,
  buildRange,
  isCompletedStatus,
  needsTaskFeedback,
} from "../../../data";
import { monthKey, overdueDays, ISO } from "../../../utils/workspace";
import { buildSerializationMap } from "../../../utils/serialization";
import {
  addMonthsIso,
  buildRangeFromWindow,
  buildTimelineRange,
  monthEndIso,
  monthStartIso,
} from "../domain/workspaceWindowCore";

export default function useWorkspaceDerivedData({
  db,
  projectId,
  taskId,
  cursor,
  timelineWindow,
  setTimelineWindow,
  writerName,
}) {
  const project = useMemo(
    () => db.projects.find((item) => item.id === projectId) || null,
    [db.projects, projectId]
  );

  const participants = useMemo(
    () =>
      db.participants
        .filter((item) => item.project_id === projectId)
        .sort((a, b) => {
          const activeA = a.status === "active";
          const activeB = b.status === "active";
          if (activeA !== activeB) return activeA ? -1 : 1;
          if (activeA && activeB) {
            return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
          }
          return String(b.ended_at || "").localeCompare(String(a.ended_at || ""));
        }),
    [db.participants, projectId]
  );

  const activeParticipants = useMemo(
    () =>
      participants
        .filter((item) => item.status === "active")
        .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999)),
    [participants]
  );

  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants]
  );

  const activeParticipantSet = useMemo(
    () => new Set(activeParticipants.map((item) => item.id)),
    [activeParticipants]
  );

  const visibleParticipants = useMemo(
    () => activeParticipants.filter((item) => !item.hidden_from_ops),
    [activeParticipants]
  );

  const visibleParticipantSet = useMemo(
    () => new Set(visibleParticipants.map((item) => item.id)),
    [visibleParticipants]
  );

  const tasks = useMemo(
    () => db.tasks.filter((item) => item.project_id === projectId),
    [db.tasks, projectId]
  );

  const maxEpisodeNo = useMemo(
    () =>
      tasks.reduce((acc, task) => {
        const value = Number(task.episode_no);
        if (!Number.isFinite(value)) return acc;
        return Math.max(acc, value);
      }, 1),
    [tasks]
  );

  const serializationMap = useMemo(
    () => buildSerializationMap(project, maxEpisodeNo),
    [project, maxEpisodeNo]
  );

  const workspaceTasks = useMemo(
    () => tasks.filter((task) => activeParticipantSet.has(task.participant_id)),
    [tasks, activeParticipantSet]
  );

  const visibleTasks = useMemo(
    () => workspaceTasks.filter((task) => visibleParticipantSet.has(task.participant_id)),
    [workspaceTasks, visibleParticipantSet]
  );

  const typeOptions = useMemo(
    () => WORK_TYPE_OPTIONS,
    []
  );

  const selectedTask = useMemo(
    () => db.tasks.find((item) => item.id === taskId) || null,
    [db.tasks, taskId]
  );

  const selectedTaskChanges = useMemo(
    () =>
      db.schedule_changes
        .filter((item) => item.task_id === taskId)
        .sort((a, b) => String(b.changed_at || "").localeCompare(String(a.changed_at || ""))),
    [db.schedule_changes, taskId]
  );

  const week = useMemo(() => buildRange(cursor), [cursor]);

  const fullTimelineRange = useMemo(
    () => buildTimelineRange(visibleTasks, week, project?.start_date, project?.end_date),
    [visibleTasks, week, project?.start_date, project?.end_date]
  );

  useEffect(() => {
    setTimelineWindow((prev) => {
      if (prev) return prev;
      const today = ISO(new Date());
      const start = monthStartIso(addMonthsIso(today, -1));
      const end = monthEndIso(addMonthsIso(today, 1));
      return { start, end };
    });
  }, [setTimelineWindow]);

  const windowRange = useMemo(() => {
    if (!timelineWindow?.start || !timelineWindow?.end) return null;
    return buildRangeFromWindow(timelineWindow.start, timelineWindow.end);
  }, [timelineWindow]);

  const timelineRange = windowRange || fullTimelineRange;
  const statusLabelMap = useMemo(() => Object.fromEntries(STATUS), []);

  const metrics = useMemo(() => {
    const scoped = db.tasks.filter((item) => item.project_id === projectId || !projectId);
    const delayed = scoped.filter((item) => overdueDays(item) > 0).length;
    const feedback = scoped.filter((item) => needsTaskFeedback(item)).length;
    const done = scoped.filter((item) => isCompletedStatus(item.status)).length;
    return { delayed, feedback, done, total: scoped.length };
  }, [db.tasks, projectId]);

  const homeQuickSteps = useMemo(() => {
    const activeProject = db.projects.find((item) => item.id === projectId) || db.projects[0] || null;
    const participantCount = db.participants.filter(
      (item) => item.project_id === activeProject?.id && item.status === "active"
    ).length;
    const taskCount = db.tasks.filter((item) => item.project_id === activeProject?.id).length;
    const currentWeek = week.start;
    const weeklySaved = db.weekly_reports.filter((report) => report.week_start === currentWeek).length;
    return [
      {
        key: "project",
        title: "1. 작품 선택/등록",
        done: Boolean(activeProject),
        description: `현재 기준 작품: ${activeProject?.title || "없음"}`,
        actionLabel: "작품 등록",
      },
      {
        key: "participant",
        title: "2. 참여 작가 등록",
        done: participantCount > 0,
        description: `참여중 작가 ${participantCount}명`,
        actionLabel: "참여 작가 등록",
      },
      {
        key: "timeline",
        title: "3. 타임라인 작업 배치",
        done: taskCount > 0,
        description: `등록 작업 ${taskCount}건`,
        actionLabel: "타임라인 열기",
      },
      {
        key: "review",
        title: "4. 주간 보고서 저장",
        done: weeklySaved > 0,
        description: `이번 주 저장 ${weeklySaved}건`,
        actionLabel: "주간 보고서 이동",
      },
    ];
  }, [db.projects, db.participants, db.tasks, db.weekly_reports, projectId, week.start]);

  const homeQueue = useMemo(() => {
    const scoped = db.tasks
      .filter((task) => (projectId ? task.project_id === projectId : true))
      .map((task) => {
        const overdue = overdueDays(task);
        if (overdue > 0) {
          return {
            id: `delay_${task.id}`,
            taskId: task.id,
            title: task.title || `${task.type || "작업"} 작업`,
            meta: `${writerName(task.writer_id)} · +${overdue}일 지연`,
            badge: "지연",
            type: "delay",
            rank: 0,
          };
        }
        if (needsTaskFeedback(task)) {
          return {
            id: `feedback_${task.id}`,
            taskId: task.id,
            title: task.title || `${task.type || "작업"} 작업`,
            meta: `${writerName(task.writer_id)} · 피드백 대응 필요`,
            badge: "피드백",
            type: "feedback",
            rank: 1,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
    return scoped;
  }, [db.tasks, projectId, writerName]);

  return {
    project,
    participants,
    activeParticipants,
    participantMap,
    visibleParticipants,
    tasks,
    serializationMap,
    visibleTasks,
    typeOptions,
    selectedTask,
    selectedTaskChanges,
    week,
    timelineRange,
    statusLabelMap,
    metrics,
    homeQuickSteps,
    homeQueue,
    monthKeyCursor: monthKey(cursor),
  };
}
