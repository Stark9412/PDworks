import {
  inferStageCodeFromType,
  isCompletedStatus,
  normalizeEpisodeNo,
  normalizeTaskStatus,
  normalizeWorkType,
  todayIso,
  uid,
} from "../../../data.js";
import {
  normalizeTaskDates,
  validateTaskConflicts,
  validateTaskDateOrder,
} from "../domain/taskMutationPolicy.js";
import {
  syncProductionDbFromTask,
  recordTaskChangeHistory,
} from "../../../features/production-db/mutations/productionDbCalculations.js";

function findStageDef(projectStageDefs, projectId, type) {
  const stageCode = inferStageCodeFromType(type);
  return (
    projectStageDefs.find(
      (item) => item.project_id === projectId && item.stage_code === stageCode && item.is_active !== false
    ) ||
    projectStageDefs.find(
      (item) => item.project_id === projectId && String(item.stage_name || "").trim() === String(type || "").trim()
    ) ||
    null
  );
}

function findAssignment(stageAssignments, participantId, stageDefId, writerId) {
  return (
    stageAssignments.find(
      (item) =>
        item.participant_id === participantId &&
        item.stage_def_id === stageDefId &&
        item.writer_id === writerId &&
        item.status === "active"
    ) || null
  );
}

function findCurrentContract(rsTerms, assignmentId, writerId, stageDefId) {
  return (
    rsTerms.find(
      (item) =>
        item.is_current &&
        item.assignment_id === assignmentId &&
        item.writer_id === writerId &&
        item.stage_def_id === stageDefId
    ) ||
    rsTerms.find(
      (item) => item.is_current && item.writer_id === writerId && item.stage_def_id === stageDefId
    ) ||
    null
  );
}

function approvalTimestamp() {
  return new Date().toISOString();
}

function alignParticipantOwnership(prev, taskLike) {
  const participantId = String(taskLike.participant_id || "");
  const participant = (prev.participants || []).find((item) => item.id === participantId) || null;
  if (!participant) return null;

  return {
    ...taskLike,
    participant_id: participant.id,
    project_id: participant.project_id,
    writer_id: participant.writer_id,
    team_id: participant.team_id || taskLike.team_id || null,
  };
}

function alignTaskRelations(prev, taskLike) {
  const participantAligned = alignParticipantOwnership(prev, taskLike);
  const projectId = String(participantAligned?.project_id || taskLike.project_id || "");
  const participantId = String(participantAligned?.participant_id || taskLike.participant_id || "");
  const writerId = String(participantAligned?.writer_id || taskLike.writer_id || "");
  const type = String(taskLike.type || "");

  const stageDef = findStageDef(prev.project_stage_defs || [], projectId, type);
  const assignment =
    findAssignment(prev.project_stage_assignments || [], participantId, stageDef?.id || "", writerId) || null;
  const contract =
    findCurrentContract(prev.rs_contract_terms || [], assignment?.id || null, writerId, stageDef?.id || "") || null;

  const normalizedStatus = normalizeTaskStatus(taskLike.status);
  const approvedAt =
    taskLike.approved_at || (isCompletedStatus(normalizedStatus) ? approvalTimestamp() : null);

  return {
    ...taskLike,
    ...(participantAligned || {}),
    episode_no: normalizeEpisodeNo(taskLike.episode_no),
    status: normalizedStatus,
    stage_def_id: stageDef?.id || null,
    assignment_id: assignment?.id || null,
    rs_contract_term_id: contract?.id || null,
    title: String(taskLike.title || "").trim(),
    scope_label: String(taskLike.scope_label || taskLike.title || `${type || "?묒뾽"} 諛곗튂`).trim(),
    planned_memo: String(taskLike.planned_memo || "").trim(),
    serialization_date: taskLike.serialization_date || null,
    feedback_done:
      "feedback_done" in taskLike
        ? Boolean(taskLike.feedback_done)
        : normalizedStatus === "completed",
    approved_at: approvedAt,
  };
}

function buildProductionCostEntry(prev, task) {
  const contract = (prev.rs_contract_terms || []).find((item) => item.id === task.rs_contract_term_id) || null;
  const unitAmount = Number.isFinite(Number(contract?.unit_amount)) ? Number(contract.unit_amount) : 0;

  return {
    id: uid("cost"),
    project_id: task.project_id,
    stage_def_id: task.stage_def_id || null,
    assignment_id: task.assignment_id || null,
    writer_id: task.writer_id,
    work_batch_id: task.id,
    rs_contract_term_id: task.rs_contract_term_id || null,
    amount_basis: contract?.amount_basis || "scope_batch",
    unit_amount_snapshot: unitAmount,
    amount_total: unitAmount,
    scope_label: task.scope_label || task.title || "",
    approved_at: task.approved_at,
  };
}

function syncProductionCostEntries(prev, task) {
  const existing = (prev.production_cost_entries || []).filter((entry) => entry.work_batch_id !== task.id);
  if (!isCompletedStatus(task.status) || !task.approved_at) {
    return existing;
  }

  const preserved =
    (prev.production_cost_entries || []).find((entry) => entry.work_batch_id === task.id) || null;
  if (preserved) {
    return [
      {
        ...preserved,
        project_id: task.project_id,
        stage_def_id: task.stage_def_id || preserved.stage_def_id || null,
        assignment_id: task.assignment_id || preserved.assignment_id || null,
        writer_id: task.writer_id,
        rs_contract_term_id: task.rs_contract_term_id || preserved.rs_contract_term_id || null,
        scope_label: task.scope_label || preserved.scope_label || "",
        approved_at: task.approved_at,
      },
      ...existing,
    ];
  }

  return [buildProductionCostEntry(prev, task), ...existing];
}

export function patchTaskState(prev, taskId, patch, options = {}) {
  const target = prev.tasks.find((task) => task.id === taskId);
  if (!target) return { next: prev, response: { ok: false, reason: "not_found" } };

  const normalizedPatch = normalizeTaskDates(patch || {});
  if ("episode_no" in normalizedPatch) {
    normalizedPatch.episode_no = normalizeEpisodeNo(normalizedPatch.episode_no);
  }
  if ("status" in normalizedPatch) {
    normalizedPatch.status = normalizeTaskStatus(normalizedPatch.status);
  }
  if (normalizedPatch.status === "completed" && !normalizedPatch.approved_at) {
    normalizedPatch.approved_at = approvalTimestamp();
  }
  if (normalizedPatch.status && normalizedPatch.status !== "completed" && !("approved_at" in normalizedPatch)) {
    normalizedPatch.approved_at = null;
  }

  const participantAlignedTask = alignParticipantOwnership(prev, { ...target, ...normalizedPatch });
  if (!participantAlignedTask) {
    return { next: prev, response: { ok: false, reason: "invalid_participant" } };
  }

  const nextEpisodeNo = normalizeEpisodeNo(participantAlignedTask.episode_no);
  if (!nextEpisodeNo) {
    return { next: prev, response: { ok: false, reason: "invalid_episode_no" } };
  }

  const nextTask = alignTaskRelations(
    prev,
    normalizeTaskDates({ ...participantAlignedTask, episode_no: nextEpisodeNo })
  );
  if (!nextTask.stage_def_id) {
    return { next: prev, response: { ok: false, reason: "invalid_stage" } };
  }
  const writerId =
    nextTask.writer_id ||
    prev.participants.find((participant) => participant.id === nextTask.participant_id)?.writer_id ||
    null;

  const dateOrderError = validateTaskDateOrder(nextTask);
  if (dateOrderError) return { next: prev, response: { ok: false, reason: dateOrderError } };

  const conflictError = validateTaskConflicts(
    prev.tasks,
    { ...nextTask, writer_id: writerId || nextTask.writer_id || null },
    taskId
  );
  if (conflictError) return { next: prev, response: conflictError };

  let nextChanges = prev.schedule_changes;
  const mutationSource = String(options?.source || "manual_edit");
  const now = new Date().toISOString();

  const plannedTouched = "ps" in normalizedPatch || "pe" in normalizedPatch;
  const actualTouched = "cs" in normalizedPatch || "ce" in normalizedPatch;

  const beforePlannedStart = target.ps || null;
  const beforePlannedEnd = target.pe || null;
  const afterPlannedStart = nextTask.ps || null;
  const afterPlannedEnd = nextTask.pe || null;

  const beforeActualStart = target.cs || null;
  const beforeActualEnd = target.ce || null;
  const afterActualStart = nextTask.cs || null;
  const afterActualEnd = nextTask.ce || null;

  if (
    plannedTouched &&
    (beforePlannedStart !== afterPlannedStart || beforePlannedEnd !== afterPlannedEnd)
  ) {
    nextChanges = [
      {
        id: uid("sc"),
        task_id: target.id,
        project_id: target.project_id,
        writer_id: writerId || target.writer_id || null,
        old_start: beforePlannedStart,
        old_end: beforePlannedEnd,
        new_start: afterPlannedStart,
        new_end: afterPlannedEnd,
        change_type: "planned_range",
        from_value:
          beforePlannedStart && beforePlannedEnd
            ? `${beforePlannedStart}~${beforePlannedEnd}`
            : beforePlannedStart || beforePlannedEnd || null,
        to_value:
          afterPlannedStart && afterPlannedEnd
            ? `${afterPlannedStart}~${afterPlannedEnd}`
            : afterPlannedStart || afterPlannedEnd || null,
        source: mutationSource,
        changed_at: now,
        is_typo: false,
        typo_marked_at: null,
      },
      ...nextChanges,
    ];
  }

  if (actualTouched && (beforeActualStart !== afterActualStart || beforeActualEnd !== afterActualEnd)) {
    nextChanges = [
      {
        id: uid("sc"),
        task_id: target.id,
        project_id: target.project_id,
        writer_id: writerId || target.writer_id || null,
        old_start: beforeActualStart,
        old_end: beforeActualEnd,
        new_start: afterActualStart,
        new_end: afterActualEnd,
        change_type: "actual_range",
        from_value:
          beforeActualStart && beforeActualEnd
            ? `${beforeActualStart}~${beforeActualEnd}`
            : beforeActualStart || beforeActualEnd || null,
        to_value:
          afterActualStart && afterActualEnd
            ? `${afterActualStart}~${afterActualEnd}`
            : afterActualStart || afterActualEnd || null,
        source: mutationSource,
        changed_at: now,
        is_typo: false,
        typo_marked_at: null,
      },
      ...nextChanges,
    ];
  }

  // Sync ProductionDB when task is updated
  const teamId = nextTask.team_id || "team_1";
  const updatedTasks = prev.tasks.map((task) =>
    task.id === taskId ? { ...nextTask, writer_id: writerId || task.writer_id } : task
  );

  const dbWithProductionSync = syncProductionDbFromTask(
    { ...prev, tasks: updatedTasks },
    nextTask.project_id,
    teamId,
    taskId,
    "update"
  );

  // Record change history for status changes
  let updatedHistories = dbWithProductionSync.change_histories;
  if ("status" in normalizedPatch && normalizedPatch.status !== target.status) {
    updatedHistories = recordTaskChangeHistory(
      { ...dbWithProductionSync, tasks: updatedTasks },
      nextTask.project_id,
      taskId,
      "상태변경",
      target.status,
      nextTask.status,
      nextTask.participant_id
    );
  }

  return {
    next: {
      ...dbWithProductionSync,
      tasks: updatedTasks,
      production_cost_entries: syncProductionCostEntries(prev, nextTask),
      schedule_changes: nextChanges,
      change_histories: updatedHistories,
    },
    response: { ok: true, task: nextTask },
  };
}

export function createTaskState(prev, taskPayload) {
  const payload = normalizeTaskDates(taskPayload || {});
  if (!payload.participant_id) {
    return { next: prev, response: { ok: false, reason: "invalid" } };
  }

  const participantAlignedPayload = alignParticipantOwnership(prev, payload);
  if (!participantAlignedPayload) {
    return { next: prev, response: { ok: false, reason: "invalid_participant" } };
  }

  const normalizedEpisodeNo = normalizeEpisodeNo(participantAlignedPayload.episode_no);
  if (!normalizedEpisodeNo) {
    return { next: prev, response: { ok: false, reason: "invalid_episode_no" } };
  }

  participantAlignedPayload.status = normalizeTaskStatus(
    participantAlignedPayload.status ||
      (participantAlignedPayload.cs && participantAlignedPayload.ce ? "in_progress" : "planned")
  );
  participantAlignedPayload.type = normalizeWorkType(participantAlignedPayload.type, "글");
  participantAlignedPayload.episode_no = normalizedEpisodeNo;
  if (participantAlignedPayload.status === "completed" && !participantAlignedPayload.approved_at) {
    participantAlignedPayload.approved_at = approvalTimestamp();
  }

  const dateOrderError = validateTaskDateOrder(participantAlignedPayload);
  if (dateOrderError) return { next: prev, response: { ok: false, reason: dateOrderError } };

  const conflictError = validateTaskConflicts(prev.tasks, participantAlignedPayload, null);
  if (conflictError) return { next: prev, response: conflictError };

  const created = alignTaskRelations(prev, {
    id: uid("t"),
    ...participantAlignedPayload,
    feedback_done: Boolean(participantAlignedPayload.feedback_done),
    planned_memo: String(participantAlignedPayload.planned_memo || "").trim(),
    scope_label: String(
      participantAlignedPayload.scope_label ||
        participantAlignedPayload.title ||
        `${participantAlignedPayload.type || "?묒뾽"} 諛곗튂`
    ).trim(),
  });
  if (!created.stage_def_id) {
    return { next: prev, response: { ok: false, reason: "invalid_stage" } };
  }

  // Sync ProductionDB when task is created
  const teamId = created.team_id || "team_1";
  const dbWithProductionSync = syncProductionDbFromTask(
    prev,
    created.project_id,
    teamId,
    created.id,
    "create"
  );

  // Record change history
  const updatedHistories = recordTaskChangeHistory(
    { ...dbWithProductionSync, tasks: [created, ...prev.tasks] },
    created.project_id,
    created.id,
    "상태변경",
    null,
    created.status,
    created.participant_id
  );

  return {
    next: {
      ...dbWithProductionSync,
      tasks: [created, ...prev.tasks],
      production_cost_entries: syncProductionCostEntries(prev, created),
      change_histories: updatedHistories,
    },
    response: { ok: true, task: created },
  };
}

export function deleteTaskState(prev, taskId) {
  const taskToDelete = prev.tasks.find((task) => task.id === taskId);
  const updatedTasks = prev.tasks.filter((task) => task.id !== taskId);

  // Sync ProductionDB when task is deleted
  let nextState = { ...prev, tasks: updatedTasks };
  if (taskToDelete) {
    const teamId = taskToDelete.team_id || "team_1";
    nextState = syncProductionDbFromTask(
      nextState,
      taskToDelete.project_id,
      teamId,
      taskId,
      "delete"
    );

    // Record deletion in change history
    nextState.change_histories = recordTaskChangeHistory(
      nextState,
      taskToDelete.project_id,
      taskId,
      "삭제",
      taskToDelete.status,
      null,
      taskToDelete.participant_id
    );
  }

  return {
    ...nextState,
    records: prev.records.filter((record) => record.task_id !== taskId),
    schedule_changes: prev.schedule_changes.filter((change) => change.task_id !== taskId),
    work_submission_cycles: prev.work_submission_cycles.filter((cycle) => cycle.work_batch_id !== taskId),
    production_cost_entries: prev.production_cost_entries.filter((entry) => entry.work_batch_id !== taskId),
  };
}

export function toggleScheduleChangeTypoState(prev, changeId) {
  return {
    ...prev,
    schedule_changes: prev.schedule_changes.map((change) =>
      change.id === changeId
        ? {
            ...change,
            is_typo: !change.is_typo,
            typo_marked_at: !change.is_typo ? new Date().toISOString() : null,
          }
        : change
    ),
  };
}

export function upsertWeeklyReportState(prev, { weekStart, weekEnd, projectId = "all", writerId, patch }) {
  const idx = prev.weekly_reports.findIndex(
    (report) =>
      report.week_start === weekStart &&
      report.project_id === projectId &&
      report.writer_id === writerId
  );

  if (idx < 0) {
    return {
      ...prev,
      weekly_reports: [
        {
          id: uid("wr"),
          week_start: weekStart,
          week_end: weekEnd,
          project_id: projectId,
          writer_id: writerId,
          recommendation: "maintain",
          score: 3,
          weekly_note: "",
          quality_grade: "",
          deadline_grade: "",
          communication_grade: "",
          quality_note: "",
          deadline_note: "",
          communication_note: "",
          project_issue_note: "",
          next_week_note: "",
          strengths: "",
          risks: "",
          response_notes: "",
          submitted_at: new Date().toISOString(),
          ...patch,
        },
        ...prev.weekly_reports,
      ],
    };
  }

  const nextReports = [...prev.weekly_reports];
  nextReports[idx] = { ...nextReports[idx], ...patch, submitted_at: new Date().toISOString() };
  return { ...prev, weekly_reports: nextReports };
}

export function buildNewParticipant({ projectId, writerId, role, startedAt, sortOrder }) {
  return {
    id: uid("pt"),
    project_id: projectId,
    writer_id: writerId,
    role,
    status: "active",
    started_at: startedAt || todayIso(),
    ended_at: null,
    end_reason: null,
    sort_order: sortOrder,
    hidden_from_ops: false,
  };
}



