const DAY = 86400000;

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

const addDays = (value, offset) => {
  const date = D(value);
  date.setDate(date.getDate() + offset);
  return date;
};

const weekStart = (value) => {
  const date = D(value);
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
};

const TYPE_STORY = "\uAE00";
const TYPE_CONTI = "\uCF58\uD2F0";
const TYPE_LINE = "\uC120\uD654";
const TYPE_FLAT = "\uBC11\uC0C9";
const TYPE_SHADE = "\uBA85\uC554";
const TYPE_BG = "\uBC30\uACBD";
const TYPE_RETOUCH = "\uD6C4\uBCF4\uC815";
const TYPE_EDIT = "\uD3B8\uC9D1";
const TYPE_OTHER = "\uC791\uC5C5";

const parseEpisodeNo = (value) => {
  const match = String(value || "").match(/(\d{1,3})\s*(?:\uD68C)?/);
  return match ? Number(match[1]) : null;
};

export const STATUS = [
  ["planned", "\uC608\uC815"],
  ["in_progress", "\uC9C4\uD589"],
  ["submitted", "\uC81C\uCD9C"],
  ["feedback_requested", "\uD53C\uB4DC\uBC31"],
  ["completed", "\uC644\uB8CC"],
];

export const WORK_TYPE_OPTIONS = [
  TYPE_STORY,
  TYPE_CONTI,
  TYPE_LINE,
  TYPE_FLAT,
  TYPE_SHADE,
  TYPE_BG,
  TYPE_RETOUCH,
  TYPE_EDIT,
];
export const TASK_TYPES = WORK_TYPE_OPTIONS;
export const MODE = ["timeline", "month", "kanban", "episode"];

const WORK_TYPE_ALIASES = [
  [TYPE_STORY, [TYPE_STORY, "\uC791\uAC00", "\uC2A4\uD1A0\uB9AC", "story"]],
  [TYPE_CONTI, [TYPE_CONTI, "conti"]],
  [TYPE_LINE, [TYPE_LINE, "line"]],
  [TYPE_FLAT, [TYPE_FLAT, "\uCC44\uC0C9", "flat"]],
  [TYPE_SHADE, [TYPE_SHADE, "shade"]],
  [TYPE_BG, [TYPE_BG, "bg"]],
  [TYPE_RETOUCH, [TYPE_RETOUCH, "\uBCF4\uC815", "retouch"]],
  [TYPE_EDIT, [TYPE_EDIT, "edit"]],
];

export const DEFAULT_STAGE_TEMPLATE = [
  { code: "story", name: TYPE_STORY, sort_order: 1, allow_parallel_workers: false },
  { code: "conti", name: TYPE_CONTI, sort_order: 2, allow_parallel_workers: false },
  { code: "line", name: TYPE_LINE, sort_order: 3, allow_parallel_workers: false },
  { code: "flat", name: TYPE_FLAT, sort_order: 4, allow_parallel_workers: false },
  { code: "shade", name: TYPE_SHADE, sort_order: 5, allow_parallel_workers: false },
  { code: "bg", name: TYPE_BG, sort_order: 6, allow_parallel_workers: true },
  { code: "retouch", name: TYPE_RETOUCH, sort_order: 7, allow_parallel_workers: false },
  { code: "edit", name: TYPE_EDIT, sort_order: 8, allow_parallel_workers: false },
];

export const RECOMMENDATION = [
  ["maintain", "\uC720\uC9C0"],
  ["priority", "\uC6B0\uC120 \uAC80\uD1A0"],
  ["caution", "\uC8FC\uC758"],
  ["hold", "\uBCF4\uB958/\uAD50\uCCB4 \uAC80\uD1A0"],
];

const LEGACY_TO_CURRENT_STATUS = {
  not_started: "planned",
  planned: "planned",
  in_progress: "in_progress",
  submitted: "submitted",
  feedback_requested: "feedback_requested",
  hold: "feedback_requested",
  done: "completed",
  completed: "completed",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deterministicUuid(seed) {
  let hash = 2166136261;
  const text = String(seed || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const parts = Array.from({ length: 32 }, (_, index) => {
    const rotated = (hash >>> ((index % 4) * 8)) & 0xff;
    return (rotated ^ ((index * 37) & 0xff)).toString(16).padStart(2, "0");
  }).join("");

  return `${parts.slice(0, 8)}-${parts.slice(8, 12)}-4${parts.slice(13, 16)}-a${parts.slice(
    17,
    20
  )}-${parts.slice(20, 32)}`;
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

export function stageDefIdForProject(projectId, stageCode) {
  return deterministicUuid(`stage:${String(projectId || "")}:${String(stageCode || "")}`);
}

function normalizeStageCode(stageCode, stageName, fallbackValue = "") {
  return String(stageCode || inferStageCodeFromType(stageName || fallbackValue) || "").trim();
}

function normalizeStageDefId(rawId, projectId, stageCode, stageName = "") {
  if (isUuid(rawId)) return String(rawId);
  const normalizedCode = normalizeStageCode(stageCode, stageName, rawId);
  if (!projectId || !normalizedCode) return rawId ? String(rawId) : null;
  return stageDefIdForProject(projectId, normalizedCode);
}

export function normalizeTaskStatus(status) {
  return LEGACY_TO_CURRENT_STATUS[String(status || "").trim()] || "planned";
}

export function normalizeEpisodeNo(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const numeric = Number(text);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

export function getStatusVisualKey(status) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "planned") return "not_started";
  if (normalized === "feedback_requested") return "hold";
  if (normalized === "completed") return "done";
  return normalized;
}

export function isCompletedStatus(status) {
  return normalizeTaskStatus(status) === "completed";
}

export function isFeedbackRequestedStatus(status) {
  return normalizeTaskStatus(status) === "feedback_requested";
}

export function needsTaskFeedback(task) {
  const normalized = normalizeTaskStatus(task?.status);
  return normalized === "feedback_requested" || (normalized === "submitted" && !Boolean(task?.feedback_done));
}

export function getLabelStatus(status) {
  const normalized = normalizeTaskStatus(status);
  return STATUS.find(([key]) => key === normalized)?.[1] || "\uBBF8\uC815";
}

export function getLabelRecommendation(value) {
  return RECOMMENDATION.find(([key]) => key === value)?.[1] || "\uC720\uC9C0";
}

export function inferStageCodeFromType(type) {
  const workType = normalizeWorkType(type);
  if (workType === TYPE_STORY) return "story";
  if (workType === TYPE_CONTI) return "conti";
  if (workType === TYPE_LINE) return "line";
  if (workType === TYPE_FLAT) return "flat";
  if (workType === TYPE_SHADE) return "shade";
  if (workType === TYPE_BG) return "bg";
  if (workType === TYPE_RETOUCH) return "retouch";
  if (workType === TYPE_EDIT) return "edit";
  return "other";
}

export function normalizeWorkType(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const matched = WORK_TYPE_ALIASES.find(([, aliases]) => aliases.some((alias) => text.includes(alias)));
  return matched?.[0] || fallback || text;
}

export function normalizeWorkTypeList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => normalizeWorkType(value)).filter(Boolean))];
}

const EMPLOYMENT_TYPE_ALIASES = [
  ["정규", ["정규"]],
  ["프리랜서", ["프리랜서", "프리", "외주", "외주작가"]],
  ["계약", ["계약"]],
  ["위촉", ["위촉"]],
  ["기타", ["기타"]],
  ["미정", ["미정", "미지정"]],
];

export function normalizeEmploymentType(value, fallback = "미정") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const matched = EMPLOYMENT_TYPE_ALIASES.find(([, aliases]) => aliases.includes(text));
  return matched?.[0] || text;
}

export function buildDefaultProjectStageDefs(projectId) {
  return DEFAULT_STAGE_TEMPLATE.map((stage) => ({
    id: stageDefIdForProject(projectId, stage.code),
    project_id: projectId,
    stage_code: stage.code,
    stage_name: stage.name,
    sort_order: stage.sort_order,
    is_active: true,
    allow_parallel_workers: Boolean(stage.allow_parallel_workers),
    note: "",
  }));
}function findStageDef(projectStageDefs, projectId, type) {
  const stageCode = inferStageCodeFromType(type);
  return (
    projectStageDefs.find((item) => item.project_id === projectId && item.stage_code === stageCode) ||
    projectStageDefs.find((item) => item.project_id === projectId && item.stage_name === type) ||
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
      (item) =>
        item.is_current &&
        item.writer_id === writerId &&
        item.stage_def_id === stageDefId
    ) ||
    null
  );
}

export function normalizeDb(db) {
  const baseProjects = Array.isArray(db?.projects) ? db.projects : [];
  const next = {
    projects: baseProjects,
    writers: Array.isArray(db?.writers) ? db.writers : [],
    participants: Array.isArray(db?.participants) ? db.participants : [],
    tasks: Array.isArray(db?.tasks) ? db.tasks : [],
    records: Array.isArray(db?.records) ? db.records : [],
    schedule_changes: Array.isArray(db?.schedule_changes) ? db.schedule_changes : [],
    weekly_reports: Array.isArray(db?.weekly_reports) ? db.weekly_reports : [],
    project_stage_defs: Array.isArray(db?.project_stage_defs) ? db.project_stage_defs : [],
    project_stage_assignments: Array.isArray(db?.project_stage_assignments) ? db.project_stage_assignments : [],
    rs_contract_terms: Array.isArray(db?.rs_contract_terms) ? db.rs_contract_terms : [],
    work_submission_cycles: Array.isArray(db?.work_submission_cycles) ? db.work_submission_cycles : [],
    production_cost_entries: Array.isArray(db?.production_cost_entries) ? db.production_cost_entries : [],
    production_costs: Array.isArray(db?.production_costs) ? db.production_costs : [],
    service_platforms: Array.isArray(db?.service_platforms) ? db.service_platforms : [],
    derivative_plannings: Array.isArray(db?.derivative_plannings) ? db.derivative_plannings : [],
    change_histories: Array.isArray(db?.change_histories) ? db.change_histories : [],
    writer_evaluations: Array.isArray(db?.writer_evaluations) ? db.writer_evaluations : [],
    pd_evaluations: Array.isArray(db?.pd_evaluations) ? db.pd_evaluations : [],
  };

  next.projects = next.projects.map((project) => ({
    id: String(project.id),
    title: String(project.title || ""),
    genre: project.genre || "",
    start_date: project.start_date || null,
    end_date: project.end_date || null,
    team_id: project.team_id || null,
    team_label: project.team_label || "",
    pd_id: project.pd_id || "pd_unknown",
    pd_name: project.pd_name || "\uBBF8\uC9C0\uC815 PD",
    total_episodes: Number.isFinite(Number(project.total_episodes)) ? Number(project.total_episodes) : null,
    production_mode: project.production_mode || "",
    co_production: project.co_production || "",
    co_production_partners: Array.isArray(project.co_production_partners)
      ? project.co_production_partners.filter(Boolean)
      : [],
    serialization_start_date: project.serialization_start_date || null,
    serialization_end_date: project.serialization_end_date || null,
    serialization_start_episode: Number.isFinite(Number(project.serialization_start_episode))
      ? Number(project.serialization_start_episode)
      : 1,
    serialization_weekdays: Array.isArray(project.serialization_weekdays)
      ? project.serialization_weekdays
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
      : [],
    serialization_hiatus_ranges: Array.isArray(project.serialization_hiatus_ranges)
      ? project.serialization_hiatus_ranges
          .map((item) => {
            const start = item?.start ? String(item.start).slice(0, 10) : null;
            const end = item?.end ? String(item.end).slice(0, 10) : null;
            if (!start || !end) return null;
            return start <= end ? { start, end } : { start: end, end: start };
          })
          .filter(Boolean)
      : [],
    derivative_memo: project.derivative_memo || "",
    episode_tracking_types: Array.isArray(project.episode_tracking_types)
      ? normalizeWorkTypeList(project.episode_tracking_types)
      : [...WORK_TYPE_OPTIONS],
  }));

  next.project_stage_defs = next.project_stage_defs.map((stage) => ({
    id: String(stage.id),
    project_id: String(stage.project_id),
    stage_code: String(stage.stage_code || inferStageCodeFromType(stage.stage_name || "")),
    stage_name: String(stage.stage_name || stage.stage_code || "\uAE30\uD0C0"),
    sort_order: Number.isFinite(Number(stage.sort_order)) ? Number(stage.sort_order) : 999,
    is_active: stage.is_active !== false,
    allow_parallel_workers: Boolean(stage.allow_parallel_workers),
    note: stage.note || "",
  }));

  const stageIdMap = new Map();
  next.project_stage_defs = next.project_stage_defs.map((stage) => {
    const stageCode = normalizeStageCode(stage.stage_code, stage.stage_name);
    const normalizedId = normalizeStageDefId(stage.id, stage.project_id, stageCode, stage.stage_name);

    if (stage.id !== normalizedId) {
      stageIdMap.set(stage.id, normalizedId);
    }
    if (stage.project_id && stageCode) {
      stageIdMap.set(`${stage.project_id}_${stageCode}`, normalizedId);
    }

    return {
      ...stage,
      id: normalizedId,
      stage_code: stageCode || "other",
    };
  });

  next.writers = next.writers.map((writer) => ({
    id: String(writer.id),
    name: writer.name || "\uBBF8\uC9C0\uC815",
    pen_names: Array.isArray(writer.pen_names) ? writer.pen_names : [],
    profile_link: writer.profile_link || "",
    career_note: writer.career_note || "",
    primary_genres: Array.isArray(writer.primary_genres) ? writer.primary_genres : [],
    phone: writer.phone || "",
    email: writer.email || "",
    employment_type: normalizeEmploymentType(writer.employment_type, "\uBBF8\uC9C0\uC815"),
    overall_grade: writer.overall_grade || "B",
    work_grade: writer.work_grade || "B",
    deadline_grade: writer.deadline_grade || "B",
    communication_grade: writer.communication_grade || "B",
    main_work_types: normalizeWorkTypeList(writer.main_work_types),
    contract_link: writer.contract_link || "",
    fee_label: writer.fee_label || "",
    rs_ratio: Number.isFinite(Number(writer.rs_ratio)) ? Number(writer.rs_ratio) : null,
    fit_genres: Array.isArray(writer.fit_genres) ? writer.fit_genres : [],
    legacy_note: writer.legacy_note || "",
    work_note: writer.work_note || "",
  }));

  next.participants = next.participants.map((participant, idx) => {
    const hiddenRaw = participant.hidden_from_ops;
    const hidden =
      hiddenRaw === true || hiddenRaw === 1 || hiddenRaw === "1" || hiddenRaw === "true";

    return {
      ...participant,
      id: String(participant.id),
      project_id: String(participant.project_id),
      writer_id: String(participant.writer_id),
      role: normalizeWorkType(participant.role, TYPE_STORY),
      status: participant.status || "active",
      started_at: participant.started_at || null,
      ended_at: participant.ended_at || null,
      end_reason: participant.end_reason || null,
      fee_label: participant.fee_label || "",
      rs_ratio: Number.isFinite(Number(participant.rs_ratio)) ? Number(participant.rs_ratio) : null,
      hidden_from_ops: hidden,
      sort_order: Number.isFinite(Number(participant.sort_order))
        ? Number(participant.sort_order)
        : idx + 1,
    };
  });

  next.project_stage_assignments = next.project_stage_assignments.map((assignment) => ({
    ...assignment,
    id: String(assignment.id),
    project_id: String(assignment.project_id),
    stage_def_id:
      normalizeStageDefId(
        stageIdMap.get(String(assignment.stage_def_id)) || assignment.stage_def_id,
        String(assignment.project_id),
        "",
        ""
      ) || null,
    participant_id: assignment.participant_id ? String(assignment.participant_id) : null,
    writer_id: String(assignment.writer_id),
    status: assignment.status || "active",
    started_at: assignment.started_at || null,
    ended_at: assignment.ended_at || null,
    replacement_reason: assignment.replacement_reason || "",
    note: assignment.note || "",
  }));

  next.rs_contract_terms = next.rs_contract_terms.map((term) => ({
    ...term,
    id: String(term.id),
    project_id: String(term.project_id),
    stage_def_id:
      normalizeStageDefId(
        stageIdMap.get(String(term.stage_def_id)) || term.stage_def_id,
        String(term.project_id),
        "",
        ""
      ) || null,
    assignment_id: term.assignment_id ? String(term.assignment_id) : null,
    writer_id: String(term.writer_id),
    effective_start_date: term.effective_start_date || null,
    effective_end_date: term.effective_end_date || null,
    amount_basis: term.amount_basis || "scope_batch",
    unit_amount: Number.isFinite(Number(term.unit_amount)) ? Number(term.unit_amount) : 0,
    currency_code: term.currency_code || "KRW",
    scope_note: term.scope_note || "",
    change_reason: term.change_reason || "",
    is_current: term.is_current !== false,
  }));

  next.tasks = next.tasks.map((task) => {
    const participantId = task.participant_id ? String(task.participant_id) : "";
    const participant = next.participants.find((item) => item.id === participantId) || null;
    const projectId = participant?.project_id || String(task.project_id || "");
    const writerId = participant?.writer_id || String(task.writer_id || "");
    const normalizedType = normalizeWorkType(task.type, TASK_TYPES[0]);
    const stage = findStageDef(next.project_stage_defs, projectId, normalizedType || task.stage_name || "");
    const normalizedStageDefId =
      normalizeStageDefId(
        stageIdMap.get(String(task.stage_def_id)) || task.stage_def_id,
        projectId,
        inferStageCodeFromType(normalizedType),
        task.stage_name || normalizedType
      ) ||
      stage?.id ||
      null;
    const assignment =
      findAssignment(next.project_stage_assignments, participantId, normalizedStageDefId || "", writerId) || null;
    const contract = findCurrentContract(
      next.rs_contract_terms,
      assignment?.id || null,
      writerId,
      normalizedStageDefId || ""
    );
    const normalizedEpisodeNo = normalizeEpisodeNo(task.episode_no) ?? parseEpisodeNo(task.title);

    return {
      ...task,
      id: String(task.id),
      project_id: projectId,
      participant_id: participantId,
      writer_id: writerId,
      team_id: participant?.team_id || task.team_id || null,
      status: normalizeTaskStatus(task.status),
      type: normalizedType,
      title: task.title || `${task.type || TYPE_OTHER} \uC791\uC5C5`,
      episode_no: normalizedEpisodeNo,
      ps: task.ps || null,
      pe: task.pe || null,
      cs: task.cs || null,
      ce: task.ce || null,
      feedback_done: Boolean(task.feedback_done),
      serialization_date: task.serialization_date || null,
      is_archived: Boolean(task.is_archived),
      planned_memo: task.planned_memo || "",
      scope_label: task.scope_label || task.title || `${task.type || TYPE_OTHER} \uBC30\uCE58`,
      stage_def_id: normalizedStageDefId,
      assignment_id: task.assignment_id || assignment?.id || null,
      rs_contract_term_id: task.rs_contract_term_id || contract?.id || null,
      approved_at: task.approved_at || null,
    };
  });

  next.work_submission_cycles = next.work_submission_cycles.map((cycle) => ({
    ...cycle,
    id: String(cycle.id),
    work_batch_id: String(cycle.work_batch_id),
    cycle_no: Number.isFinite(Number(cycle.cycle_no)) ? Number(cycle.cycle_no) : 1,
    submitted_at: cycle.submitted_at || null,
    submission_note: cycle.submission_note || "",
    pd_checked_at: cycle.pd_checked_at || null,
    feedback_note: cycle.feedback_note || "",
    revision_due_at: cycle.revision_due_at || null,
    resubmitted_at: cycle.resubmitted_at || null,
    is_approved: Boolean(cycle.is_approved),
  }));

  next.production_cost_entries = next.production_cost_entries.map((entry) => ({
    ...entry,
    id: String(entry.id),
    project_id: String(entry.project_id),
    stage_def_id:
      normalizeStageDefId(
        stageIdMap.get(String(entry.stage_def_id)) || entry.stage_def_id,
        String(entry.project_id),
        "",
        ""
      ) || null,
    assignment_id: entry.assignment_id ? String(entry.assignment_id) : null,
    writer_id: String(entry.writer_id),
    work_batch_id: String(entry.work_batch_id),
    rs_contract_term_id: entry.rs_contract_term_id ? String(entry.rs_contract_term_id) : null,
    amount_basis: entry.amount_basis || "scope_batch",
    unit_amount_snapshot: Number.isFinite(Number(entry.unit_amount_snapshot))
      ? Number(entry.unit_amount_snapshot)
      : 0,
    amount_total: Number.isFinite(Number(entry.amount_total)) ? Number(entry.amount_total) : 0,
    scope_label: entry.scope_label || "",
    approved_at: entry.approved_at || null,
  }));

  next.schedule_changes = next.schedule_changes.map((change) => ({
    ...change,
    is_typo: Boolean(change.is_typo),
    typo_marked_at: change.typo_marked_at || null,
  }));

  next.weekly_reports = next.weekly_reports.map((report) => ({
    ...report,
    project_id: report.project_id || "all",
    recommendation: report.recommendation || "maintain",
    score: Number.isFinite(Number(report.score)) ? Number(report.score) : 3,
    weekly_note: report.weekly_note || "",
    quality_grade: report.quality_grade || "",
    deadline_grade: report.deadline_grade || "",
    communication_grade: report.communication_grade || "",
    quality_note: report.quality_note || "",
    deadline_note: report.deadline_note || "",
    communication_note: report.communication_note || "",
    project_issue_note: report.project_issue_note || "",
    next_week_note: report.next_week_note || "",
    strengths: report.strengths || "",
    risks: report.risks || "",
    response_notes: report.response_notes || "",
  }));

  return next;
}

export function buildRange(cursor) {
  const start = weekStart(cursor);
  return {
    start: ISO(start),
    end: ISO(addDays(start, 6)),
    days: Array.from({ length: 7 }, (_, i) => ISO(addDays(start, i))),
  };
}

export function diffDays(a, b) {
  return Math.round((D(b) - D(a)) / DAY);
}

export function todayIso() {
  return ISO(new Date());
}

export function uid(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createProductionTeam(projectId, teamNumber = 1) {
  return {
    id: `pteam_${projectId}_${teamNumber}`,
    project_id: projectId,
    team_number: teamNumber,
    team_name: `\uC81C\uC791\uD300 ${teamNumber}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createProductionCost(projectId, teamId, part, unitPrice = 0) {
  return {
    id: `pcost_${projectId}_${teamId}_${part}_${Date.now()}`,
    project_id: projectId,
    team_id: teamId,
    part,
    unit_price: unitPrice,
    quantity: 0,
    total_cost: 0,
    payment_schedule: "",
    notes: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createChangeHistory(projectId, taskId, changeType, oldValue, newValue, changedBy) {
  return {
    id: `history_${projectId}_${taskId}_${Date.now()}`,
    project_id: projectId,
    task_id: taskId,
    changed_by: changedBy,
    changed_date: ISO(new Date()),
    change_type: changeType, // 예: "일정 변경", "담당자 변경"
    old_value: oldValue,
    new_value: newValue,
    reason: "",
    notes: "",
    created_at: new Date().toISOString(),
  };
}

export function createServicePlatform(projectId) {
  return {
    id: `splatform_${projectId}_${Date.now()}`,
    project_id: projectId,
    region: "\uAD6D\uB0B4", // domestic default
    platform: "", // 예: "네이버웹툰", "카카오웹툰", "리디", "WEBTOON"
    launch_date: "",
    status: "\uACC4\uD68D", // planned by default
    notes: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createDerivativePlanning(projectId) {
  return {
    id: `deriv_${projectId}_${Date.now()}`,
    project_id: projectId,
    type: "", // derivative type
    title: "",
    description: "",
    planned_date: "",
    status: "\uACC4\uD68D", // planned by default
    assigned_to: "",
    budget: 0,
    notes: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createWriterEvaluation(projectId, writerId, evaluatorId) {
  return {
    id: `weval_${projectId}_${writerId}_${Date.now()}`,
    project_id: projectId,
    writer_id: writerId,
    work_ability: "", // "A", "B", "C"
    deadline_ability: "",
    communication_ability: "",
    overall_assessment: "",
    notes: "",
    evaluated_by: evaluatorId,
    evaluated_at: ISO(new Date()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createPdEvaluation(projectId, pdId) {
  return {
    id: `peval_${projectId}_${pdId}_${Date.now()}`,
    project_id: projectId,
    pd_id: pdId,
    positive_assessment: "",
    negative_assessment: "",
    notes: "",
    evaluated_at: ISO(new Date()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}



