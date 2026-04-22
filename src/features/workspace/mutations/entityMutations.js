import { inferStageCodeFromType, normalizeWorkType, normalizeWorkTypeList, uid } from "../../../data.js";
import { buildNewParticipant } from "./taskMutations.js";

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmploymentTypeValue(value) {
  const text = String(value || "").trim();
  if (!text) return "미지정";
  if (text === "내부") return "내부";
  if (text === "테스트") return "테스트";
  if (text === "퇴사") return "퇴사";
  if (text === "업체") return "업체";
  if (["외부", "외주", "?몄＜", "몄＜", "?몄<"].includes(text)) return "외주";
  if (text === "미지정" || text === "미정") return "미지정";
  return text;
}

function normalizeParticipantFeeLabel(value) {
  return String(value || "").trim();
}

function normalizeParticipantRsRatio(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function findStageDef(stageDefs, projectId, role) {
  const stageCode = inferStageCodeFromType(role);
  return (
    stageDefs.find(
      (item) => item.project_id === projectId && item.stage_code === stageCode && item.is_active !== false
    ) ||
    stageDefs.find(
      (item) => item.project_id === projectId && String(item.stage_name || "").trim() === String(role || "").trim()
    ) ||
    null
  );
}

function buildStageAssignment({ participant, role, stageDefId, note = "" }) {
  return {
    id: uid("psa"),
    project_id: participant.project_id,
    stage_def_id: stageDefId,
    participant_id: participant.id,
    writer_id: participant.writer_id,
    status: "active",
    started_at: participant.started_at,
    ended_at: null,
    replacement_reason: "",
    note,
  };
}

export function toggleVisibilityState(prev, participantId) {
  return {
    ...prev,
    participants: prev.participants.map((participant) =>
      participant.id === participantId
        ? { ...participant, hidden_from_ops: !participant.hidden_from_ops }
        : participant
    ),
  };
}

export function reorderParticipantsState(prev, projectId, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return prev;
  const orderedIds = prev.participants
    .filter((participant) => participant.project_id === projectId && participant.status === "active")
    .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999))
    .map((participant) => participant.id);

  const from = orderedIds.indexOf(sourceId);
  const to = orderedIds.indexOf(targetId);
  if (from < 0 || to < 0) return prev;

  orderedIds.splice(from, 1);
  orderedIds.splice(to, 0, sourceId);

  return {
    ...prev,
    participants: prev.participants.map((participant) => {
      if (participant.project_id !== projectId || participant.status !== "active") return participant;
      const idx = orderedIds.indexOf(participant.id);
      return idx < 0 ? participant : { ...participant, sort_order: idx + 1 };
    }),
  };
}

export function patchWriterState(prev, writerId, patch) {
  return {
    ...prev,
    writers: prev.writers.map((writer) => {
      if (writer.id !== writerId) return writer;
      const nextEmploymentType =
        typeof patch?.employment_type === "undefined"
          ? writer.employment_type
          : normalizeEmploymentTypeValue(patch.employment_type);
      return { ...writer, ...patch, employment_type: nextEmploymentType };
    }),
  };
}

export function deleteWriterState(prev, writerId) {
  const participantIds = new Set(
    prev.participants
      .filter((participant) => participant.writer_id === writerId)
      .map((participant) => participant.id)
  );

  const taskIds = new Set(
    prev.tasks
      .filter(
        (task) => task.writer_id === writerId || (task.participant_id && participantIds.has(task.participant_id))
      )
      .map((task) => task.id)
  );

  const assignmentIds = new Set(
    prev.project_stage_assignments
      .filter(
        (assignment) =>
          assignment.writer_id === writerId ||
          (assignment.participant_id && participantIds.has(assignment.participant_id))
      )
      .map((assignment) => assignment.id)
  );

  const remainingWriters = prev.writers.filter((writer) => writer.id !== writerId);
  if (remainingWriters.length === prev.writers.length) {
    return { next: prev, response: { ok: false, reason: "not_found" } };
  }

  return {
    next: {
      ...prev,
      writers: remainingWriters,
      participants: prev.participants.filter((participant) => participant.writer_id !== writerId),
      tasks: prev.tasks.filter(
        (task) => task.writer_id !== writerId && !(task.participant_id && participantIds.has(task.participant_id))
      ),
      schedule_changes: prev.schedule_changes.filter(
        (change) => change.writer_id !== writerId && !taskIds.has(change.task_id)
      ),
      weekly_reports: prev.weekly_reports.filter((report) => report.writer_id !== writerId),
      project_stage_assignments: prev.project_stage_assignments.filter(
        (assignment) =>
          assignment.writer_id !== writerId &&
          !(assignment.participant_id && participantIds.has(assignment.participant_id))
      ),
      rs_contract_terms: prev.rs_contract_terms.filter(
        (term) => term.writer_id !== writerId && !(term.assignment_id && assignmentIds.has(term.assignment_id))
      ),
      work_submission_cycles: prev.work_submission_cycles.filter(
        (cycle) => !cycle.work_batch_id || !taskIds.has(cycle.work_batch_id)
      ),
      production_cost_entries: prev.production_cost_entries.filter(
        (entry) => entry.writer_id !== writerId && !taskIds.has(entry.work_batch_id)
      ),
      change_histories: prev.change_histories.filter(
        (history) => !history.task_id || !taskIds.has(history.task_id)
      ),
      writer_evaluations: prev.writer_evaluations.filter((item) => item.writer_id !== writerId),
    },
    response: { ok: true },
  };
}

export function createWriterState(prev, payload) {
  const name = String(payload?.name || "").trim();
  if (!name) return { next: prev, response: { ok: false, reason: "invalid_name" } };

  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const penNames = Array.isArray(payload?.pen_names)
    ? payload.pen_names.map((item) => String(item || "").trim()).filter(Boolean)
    : String(payload?.pen_names || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const duplicate = prev.writers.find((writer) => {
    const sameName = String(writer.name || "").trim() === name;
    const samePhone = phone && String(writer.phone || "").trim() === phone;
    const sameEmail = email && String(writer.email || "").trim().toLowerCase() === email;
    return samePhone || sameEmail || (sameName && (samePhone || sameEmail));
  });

  if (duplicate) {
    return { next: prev, response: { ok: false, reason: "duplicate", writer: duplicate } };
  }

  const writer = {
    id: uid("w"),
    name,
    pen_names: penNames,
    profile_link: String(payload?.profile_link || "").trim(),
    career_note: String(payload?.career_note || "").trim(),
    primary_genres: normalizeList(payload?.primary_genres),
    phone,
    email,
    employment_type: normalizeEmploymentTypeValue(payload?.employment_type || "외주"),
    overall_grade: payload?.overall_grade || "B",
    work_grade: payload?.work_grade || "B",
    deadline_grade: payload?.deadline_grade || "B",
    communication_grade: payload?.communication_grade || "B",
    main_work_types: normalizeWorkTypeList(normalizeList(payload?.main_work_types)),
    contract_link: String(payload?.contract_link || "").trim(),
    fee_label: payload?.fee_label || "",
    rs_ratio: Number.isFinite(Number(payload?.rs_ratio)) ? Number(payload.rs_ratio) : null,
    fit_genres: normalizeList(payload?.fit_genres),
    legacy_note: payload?.legacy_note || "",
    work_note: payload?.work_note || "",
  };

  return {
    next: { ...prev, writers: [writer, ...prev.writers] },
    response: { ok: true, writer },
  };
}

export function createProjectState(prev, payload) {
  const title = String(payload?.title || "").trim();
  if (!title) return { next: prev, project: null };

  const project = {
    id: uid("p"),
    title,
    start_date: payload?.start_date || null,
    end_date: payload?.end_date || null,
    genre: payload?.genre || null,
    team_id: payload?.team_id || null,
    team_label: payload?.team_label || null,
    pd_id: payload?.pd_id || "pd_unknown",
    pd_name: payload?.pd_name || "미지정 PD",
    total_episodes: Number.isFinite(Number(payload?.total_episodes)) ? Number(payload.total_episodes) : null,
    production_mode: payload?.production_mode || null,
    co_production: payload?.co_production || null,
    co_production_partners: Array.isArray(payload?.co_production_partners)
      ? payload.co_production_partners
      : [],
    serialization_start_date: payload?.serialization_start_date || null,
    serialization_end_date: payload?.serialization_end_date || null,
    serialization_start_episode: Number.isFinite(Number(payload?.serialization_start_episode))
      ? Number(payload.serialization_start_episode)
      : 1,
    serialization_weekdays: Array.isArray(payload?.serialization_weekdays)
      ? payload.serialization_weekdays
      : [],
    serialization_hiatus_ranges: Array.isArray(payload?.serialization_hiatus_ranges)
      ? payload.serialization_hiatus_ranges
      : [],
    derivative_memo: payload?.derivative_memo || null,
    episode_tracking_types: normalizeWorkTypeList(payload?.episode_tracking_types),
    updated_at: new Date().toISOString(),
  };

  return {
    next: {
      ...prev,
      projects: [project, ...prev.projects],
    },
    project,
  };
}

export function patchProjectState(prev, projectId, patch) {
  const targetProject = prev.projects.find((project) => project.id === projectId);
  if (!targetProject) return prev;

  const nextProjects = prev.projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          ...patch,
          actor_id: undefined,
          updated_at: new Date().toISOString(),
          episode_tracking_types: normalizeWorkTypeList(
            Array.isArray(patch?.episode_tracking_types)
              ? patch.episode_tracking_types
              : project.episode_tracking_types
          ),
        }
      : project
  );

  const nextHistories = [...(prev.change_histories || [])];
  if (
    typeof patch?.pd_id !== "undefined" &&
    (patch.pd_id !== targetProject.pd_id || patch?.pd_name !== targetProject.pd_name)
  ) {
    nextHistories.push({
      id: `history_${projectId}_manual_${Date.now()}`,
      project_id: projectId,
      task_id: "manual",
      changed_by: patch?.actor_id || targetProject.pd_id || "system",
      changed_date: new Date().toISOString().slice(0, 10),
      change_type: "담당자변경",
      old_value: targetProject.pd_name || targetProject.pd_id || "미지정",
      new_value: patch?.pd_name || patch?.pd_id || "미지정",
      reason: "",
      notes: "작품 담당자 변경",
      created_at: new Date().toISOString(),
    });
  }

  return {
    ...prev,
    projects: nextProjects,
    change_histories: nextHistories,
  };
}

export function deleteProjectState(prev, projectId) {
  const existed = prev.projects.some((project) => project.id === projectId);
  if (!existed) return { next: prev, existed: false };

  const taskIds = prev.tasks.filter((task) => task.project_id === projectId).map((task) => task.id);
  const assignmentIds = (prev.project_stage_assignments || [])
    .filter((assignment) => assignment.project_id === projectId)
    .map((assignment) => assignment.id);
  const stageDefIds = (prev.project_stage_defs || [])
    .filter((stage) => stage.project_id === projectId)
    .map((stage) => stage.id);

  return {
    existed: true,
    next: {
      ...prev,
      projects: prev.projects.filter((project) => project.id !== projectId),
      participants: prev.participants.filter((participant) => participant.project_id !== projectId),
      tasks: prev.tasks.filter((task) => task.project_id !== projectId),
      records: prev.records.filter(
        (record) => record.project_id !== projectId && !taskIds.includes(record.task_id)
      ),
      schedule_changes: prev.schedule_changes.filter(
        (change) => change.project_id !== projectId && !taskIds.includes(change.task_id)
      ),
      weekly_reports: prev.weekly_reports.filter((report) => report.project_id !== projectId),
      project_stage_defs: prev.project_stage_defs.filter((stage) => stage.project_id !== projectId),
      project_stage_assignments: prev.project_stage_assignments.filter(
        (assignment) => assignment.project_id !== projectId
      ),
      rs_contract_terms: prev.rs_contract_terms.filter(
        (term) => term.project_id !== projectId && !assignmentIds.includes(term.assignment_id)
      ),
      work_submission_cycles: prev.work_submission_cycles.filter(
        (cycle) => !taskIds.includes(cycle.work_batch_id)
      ),
      production_cost_entries: prev.production_cost_entries.filter(
        (entry) =>
          entry.project_id !== projectId &&
          !taskIds.includes(entry.work_batch_id) &&
          !stageDefIds.includes(entry.stage_def_id)
      ),
    },
  };
}

export function createParticipantState(prev, payload) {
  const projectId = payload?.project_id;
  const writerId = payload?.writer_id;
  const role = normalizeWorkType(payload?.role, "");
  if (!projectId || !writerId || !role) {
    return { next: prev, response: { ok: false, reason: "invalid" } };
  }

  const duplicated = prev.participants.some(
    (participant) =>
      participant.project_id === projectId &&
      participant.writer_id === writerId &&
      normalizeWorkType(participant.role, "") === role &&
      participant.status === "active"
  );
  if (duplicated) return { next: prev, response: { ok: false, reason: "duplicate_role" } };

  const stageDef = findStageDef(prev.project_stage_defs || [], projectId, role);
  const hasParallelConflict =
    stageDef &&
    !stageDef.allow_parallel_workers &&
    (prev.project_stage_assignments || []).some(
      (assignment) =>
        assignment.project_id === projectId &&
        assignment.stage_def_id === stageDef.id &&
        assignment.status === "active"
    );
  if (hasParallelConflict) {
    return { next: prev, response: { ok: false, reason: "parallel_blocked" } };
  }

  const sortOrder =
    prev.participants.filter(
      (participant) => participant.project_id === projectId && participant.status === "active"
    ).length + 1;

  const participant = buildNewParticipant({
    projectId,
    writerId,
    role,
    startedAt: payload?.started_at,
    sortOrder,
  });
  participant.fee_label = normalizeParticipantFeeLabel(payload?.fee_label);
  participant.rs_ratio = normalizeParticipantRsRatio(payload?.rs_ratio);

  const stageAssignment =
    stageDef ? buildStageAssignment({ participant, role, stageDefId: stageDef.id }) : null;

  return {
    next: {
      ...prev,
      participants: [...prev.participants, participant],
      project_stage_assignments: stageAssignment
        ? [...prev.project_stage_assignments, stageAssignment]
        : prev.project_stage_assignments,
    },
    response: { ok: true, participant },
  };
}

export function patchParticipantState(prev, participantId, patch) {
  const target = prev.participants.find((participant) => participant.id === participantId);
  if (!target) return { next: prev, response: { ok: false, reason: "not_found" } };

  const nextRole =
    typeof patch?.role === "undefined" ? target.role : normalizeWorkType(patch.role, "");
  const nextStartedAt =
    typeof patch?.started_at === "undefined" ? target.started_at : patch.started_at || null;

  if (!nextRole) {
    return { next: prev, response: { ok: false, reason: "invalid" } };
  }

  const duplicatedRole = prev.participants.some(
    (participant) =>
      participant.id !== participantId &&
      participant.project_id === target.project_id &&
      participant.writer_id === target.writer_id &&
      participant.status === "active" &&
      normalizeWorkType(participant.role, "") === nextRole
  );
  if (duplicatedRole) {
    return { next: prev, response: { ok: false, reason: "duplicate_role" } };
  }

  const stageDef = findStageDef(prev.project_stage_defs || [], target.project_id, nextRole);
  const hasParallelConflict =
    stageDef &&
    !stageDef.allow_parallel_workers &&
    (prev.project_stage_assignments || []).some(
      (assignment) =>
        assignment.project_id === target.project_id &&
        assignment.stage_def_id === stageDef.id &&
        assignment.status === "active" &&
        assignment.participant_id !== participantId
    );
  if (hasParallelConflict) {
    return { next: prev, response: { ok: false, reason: "parallel_blocked" } };
  }

  const nextParticipants = prev.participants.map((participant) =>
    participant.id === participantId
      ? {
          ...participant,
          role: nextRole,
          started_at: nextStartedAt,
          fee_label:
            typeof patch?.fee_label === "undefined"
              ? normalizeParticipantFeeLabel(participant.fee_label)
              : normalizeParticipantFeeLabel(patch.fee_label),
          rs_ratio:
            typeof patch?.rs_ratio === "undefined"
              ? normalizeParticipantRsRatio(participant.rs_ratio)
              : normalizeParticipantRsRatio(patch.rs_ratio),
        }
      : participant
  );

  const nextAssignments = prev.project_stage_assignments.map((assignment) => {
    if (assignment.participant_id !== participantId || assignment.status !== "active") return assignment;
    return {
      ...assignment,
      stage_def_id: stageDef?.id || assignment.stage_def_id,
      started_at: nextStartedAt,
    };
  });

  return {
    next: {
      ...prev,
      participants: nextParticipants,
      project_stage_assignments: nextAssignments,
    },
    response: { ok: true },
  };
}

export function endParticipantState(prev, participantId, endedAt, reason) {
  if (!participantId || !endedAt || !String(reason || "").trim()) {
    return { next: prev, response: { ok: false, reason: "invalid" } };
  }

  const target = prev.participants.find((participant) => participant.id === participantId);
  if (!target || target.status !== "active") {
    return { next: prev, response: { ok: false, reason: "not_found" } };
  }

  return {
    next: {
      ...prev,
      participants: prev.participants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              status: "ended",
              ended_at: endedAt,
              end_reason: String(reason).trim(),
            }
          : participant
      ),
      project_stage_assignments: prev.project_stage_assignments.map((assignment) =>
        assignment.participant_id === participantId && assignment.status === "active"
          ? {
              ...assignment,
              status: "ended",
              ended_at: endedAt,
              replacement_reason: String(reason).trim(),
            }
          : assignment
      ),
    },
    response: { ok: true },
  };
}

export function replaceParticipantState(prev, { participantId, replacedAt, nextWriterId, reason = "援먯껜" }) {
  if (!participantId || !replacedAt || !nextWriterId) {
    return { next: prev, response: { ok: false, reason: "invalid" } };
  }

  const outgoing = prev.participants.find((participant) => participant.id === participantId);
  if (!outgoing || outgoing.status !== "active") {
    return { next: prev, response: { ok: false, reason: "not_found" } };
  }
  if (outgoing.writer_id === nextWriterId) {
    return { next: prev, response: { ok: false, reason: "same_writer" } };
  }

  const toDate = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null);
  const overlaps = (aStart, aEnd, bStart, bEnd) =>
    toDate(aStart) &&
    toDate(aEnd) &&
    toDate(bStart) &&
    toDate(bEnd) &&
    toDate(aStart) <= toDate(bEnd) &&
    toDate(aEnd) >= toDate(bStart);

  const activeEnd = (task) => task.ce || task.pe || task.cs || task.ps || null;

  const transferTaskIds = prev.tasks
    .filter(
      (task) =>
        task.participant_id === outgoing.id &&
        activeEnd(task) &&
        toDate(activeEnd(task)) >= toDate(replacedAt)
    )
    .map((task) => task.id);

  const conflict = prev.tasks.find((task) => {
    if (!task.cs || !task.ce) return false;
    if (task.writer_id !== nextWriterId) return false;
    if (transferTaskIds.includes(task.id)) return false;

    return prev.tasks.some(
      (moving) =>
        transferTaskIds.includes(moving.id) &&
        moving.cs &&
        moving.ce &&
        overlaps(task.cs, task.ce, moving.cs, moving.ce)
    );
  });

  if (conflict) {
    return { next: prev, response: { ok: false, reason: "schedule_conflict" } };
  }

  const sortOrder =
    prev.participants.filter(
      (participant) => participant.project_id === outgoing.project_id && participant.status === "active"
    ).length + 1;

  const incoming = buildNewParticipant({
    projectId: outgoing.project_id,
    writerId: nextWriterId,
    role: outgoing.role,
    startedAt: replacedAt,
    sortOrder,
  });
  incoming.fee_label = normalizeParticipantFeeLabel(outgoing.fee_label);
  incoming.rs_ratio = normalizeParticipantRsRatio(outgoing.rs_ratio);

  const outgoingAssignments = prev.project_stage_assignments.filter(
    (assignment) => assignment.participant_id === outgoing.id && assignment.status === "active"
  );
  const incomingAssignments = outgoingAssignments.map((assignment) => ({
    ...buildStageAssignment({
      participant: incoming,
      role: outgoing.role,
      stageDefId: assignment.stage_def_id,
      note: assignment.note || "",
    }),
    started_at: replacedAt,
  }));
  const incomingAssignmentMap = new Map(
    incomingAssignments.map((assignment) => [assignment.stage_def_id, assignment.id])
  );

  return {
    next: {
      ...prev,
      participants: [
        ...prev.participants.map((participant) =>
          participant.id === outgoing.id
            ? {
                ...participant,
                status: "replaced",
                ended_at: replacedAt,
                end_reason: String(reason).trim() || "援먯껜",
              }
            : participant
        ),
        incoming,
      ],
      project_stage_assignments: [
        ...prev.project_stage_assignments.map((assignment) =>
          assignment.participant_id === outgoing.id && assignment.status === "active"
            ? {
                ...assignment,
                status: "replaced",
                ended_at: replacedAt,
                replacement_reason: String(reason).trim() || "援먯껜",
              }
            : assignment
        ),
        ...incomingAssignments,
      ],
      tasks: prev.tasks.map((task) =>
        transferTaskIds.includes(task.id)
          ? {
              ...task,
              participant_id: incoming.id,
              writer_id: incoming.writer_id,
              assignment_id: task.stage_def_id
                ? incomingAssignmentMap.get(task.stage_def_id) || task.assignment_id
                : task.assignment_id,
            }
          : task
      ),
    },
    response: {
      ok: true,
      participant: incoming,
      transferredCount: transferTaskIds.length,
    },
  };
}
