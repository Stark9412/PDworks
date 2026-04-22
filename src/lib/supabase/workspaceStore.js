import {
  inferStageCodeFromType,
  normalizeDb,
  normalizeEmploymentType,
  normalizeEpisodeNo,
  normalizeWorkType,
} from "../../data.js";
import { getSupabaseClient, isSupabaseConfigured } from "./client.js";

const APPEND_ONLY_COLLECTIONS = new Set(["schedule_changes"]);
const WORKSPACE_REALTIME_TABLES = [
  "projects",
  "writers",
  "writer_aliases",
  "writer_contacts",
  "project_participants",
  "tasks",
  "task_schedule_changes",
  "weekly_reports",
  "project_stage_defs",
  "project_stage_assignments",
  "rs_contract_terms",
  "work_submission_cycles",
  "production_cost_entries",
  "production_costs",
  "service_platforms",
  "derivative_plannings",
  "change_histories",
  "writer_evaluations",
  "pd_evaluations",
];

function getClientOrThrow() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase 설정이 없습니다. .env.local에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY를 넣어주세요."
    );
  }
  return client;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

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

function toIsoDate(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function uuidOrNull(value) {
  return isUuid(value) ? String(value) : null;
}

function keepIfValid(items, predicate) {
  return ensureArray(items).filter(predicate);
}

function sanitizeDbForSync(inputDb) {
  const db = normalizeDb(inputDb || {});
  const validProjects = new Set(keepIfValid(db.projects, (item) => isUuid(item.id)).map((item) => item.id));
  const validWriters = new Set(keepIfValid(db.writers, (item) => isUuid(item.id)).map((item) => item.id));
  const participants = keepIfValid(
    db.participants,
    (item) => isUuid(item.id) && validProjects.has(item.project_id) && validWriters.has(item.writer_id)
  );
  const validParticipants = new Set(participants.map((item) => item.id));
  const stageDefs = keepIfValid(
    db.project_stage_defs,
    (item) => isUuid(item.id) && validProjects.has(item.project_id)
  );
  const validStageDefs = new Set(stageDefs.map((item) => item.id));
  const stageAssignments = keepIfValid(
    db.project_stage_assignments,
    (item) =>
      isUuid(item.id) &&
      validProjects.has(item.project_id) &&
      validStageDefs.has(item.stage_def_id) &&
      validWriters.has(item.writer_id) &&
      (!item.participant_id || validParticipants.has(item.participant_id))
  );
  const validAssignments = new Set(stageAssignments.map((item) => item.id));
  const rsTerms = keepIfValid(
    db.rs_contract_terms,
    (item) =>
      isUuid(item.id) &&
      validProjects.has(item.project_id) &&
      validWriters.has(item.writer_id) &&
      (!item.stage_def_id || validStageDefs.has(item.stage_def_id)) &&
      (!item.assignment_id || validAssignments.has(item.assignment_id))
  );
  const validRsTerms = new Set(rsTerms.map((item) => item.id));
  const tasks = keepIfValid(
    db.tasks,
    (item) =>
      isUuid(item.id) &&
      validProjects.has(item.project_id) &&
      validParticipants.has(item.participant_id) &&
      validWriters.has(item.writer_id) &&
      (!item.stage_def_id || validStageDefs.has(item.stage_def_id)) &&
      (!item.assignment_id || validAssignments.has(item.assignment_id)) &&
      (!item.rs_contract_term_id || validRsTerms.has(item.rs_contract_term_id))
  );
  const validTasks = new Set(tasks.map((item) => item.id));
  const workSubmissionCycles = keepIfValid(
    db.work_submission_cycles,
    (item) => isUuid(item.id) && validTasks.has(item.work_batch_id)
  );
  const productionCostEntries = keepIfValid(
    db.production_cost_entries,
    (item) =>
      isUuid(item.id) &&
      validProjects.has(item.project_id) &&
      validWriters.has(item.writer_id) &&
      validTasks.has(item.work_batch_id) &&
      (!item.stage_def_id || validStageDefs.has(item.stage_def_id)) &&
      (!item.assignment_id || validAssignments.has(item.assignment_id)) &&
      (!item.rs_contract_term_id || validRsTerms.has(item.rs_contract_term_id))
  );

  return {
    ...db,
    projects: keepIfValid(db.projects, (item) => isUuid(item.id)),
    writers: keepIfValid(db.writers, (item) => isUuid(item.id)),
    participants,
    project_stage_defs: stageDefs,
    project_stage_assignments: stageAssignments,
    rs_contract_terms: rsTerms,
    tasks,
    schedule_changes: keepIfValid(
      db.schedule_changes,
      (item) =>
        isUuid(item.id) &&
        validTasks.has(item.task_id) &&
        validProjects.has(item.project_id) &&
        validWriters.has(item.writer_id)
    ),
    weekly_reports: keepIfValid(
      db.weekly_reports,
      (item) =>
        isUuid(item.id) &&
        validWriters.has(item.writer_id) &&
        (!item.project_id || item.project_id === "all" || validProjects.has(item.project_id))
    ),
    work_submission_cycles: workSubmissionCycles,
    production_cost_entries: productionCostEntries,
    production_costs: keepIfValid(
      db.production_costs,
      (item) => isUuid(item.id) && validProjects.has(item.project_id)
    ),
    service_platforms: keepIfValid(
      db.service_platforms,
      (item) => isUuid(item.id) && validProjects.has(item.project_id)
    ),
    derivative_plannings: keepIfValid(
      db.derivative_plannings,
      (item) => isUuid(item.id) && validProjects.has(item.project_id)
    ),
    change_histories: keepIfValid(
      db.change_histories,
      (item) =>
        isUuid(item.id) &&
        validProjects.has(item.project_id) &&
        (!item.task_id || validTasks.has(item.task_id))
    ),
    writer_evaluations: keepIfValid(
      db.writer_evaluations,
      (item) =>
        isUuid(item.id) && validProjects.has(item.project_id) && validWriters.has(item.writer_id)
    ),
    pd_evaluations: keepIfValid(
      db.pd_evaluations,
      (item) => isUuid(item.id) && validProjects.has(item.project_id)
    ),
  };
}

function createLoadContext(rows) {
  const profilesById = new Map(ensureArray(rows.profiles).map((item) => [item.id, item]));
  const aliasesByWriterId = new Map();
  const contactsByWriterId = new Map();

  ensureArray(rows.writer_aliases).forEach((alias) => {
    const list = aliasesByWriterId.get(alias.writer_id) || [];
    list.push(alias);
    aliasesByWriterId.set(alias.writer_id, list);
  });

  ensureArray(rows.writer_contacts).forEach((contact) => {
    const list = contactsByWriterId.get(contact.writer_id) || [];
    list.push(contact);
    contactsByWriterId.set(contact.writer_id, list);
  });

  return {
    profilesById,
    aliasesByWriterId,
    contactsByWriterId,
  };
}

function mapProject(row, ctx) {
  const profile = row.pd_user_id ? ctx.profilesById.get(row.pd_user_id) : null;

  return {
    id: row.id,
    title: row.title || "",
    genre: row.genre || "",
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    team_id: row.team_id || null,
    team_label: row.team_label || "",
    pd_id: row.pd_user_id || "pd_unknown",
    pd_name: profile?.full_name || row.pd_display_name || "미지정 PD",
    total_episodes: Number.isFinite(Number(row.total_episodes)) ? Number(row.total_episodes) : null,
    production_mode: row.production_mode || "",
    co_production: row.co_production || "",
    co_production_partners: ensureArray(row.co_production_partners),
    serialization_start_date: row.serialization_start_date || null,
    serialization_end_date: row.serialization_end_date || null,
    serialization_start_episode: Number.isFinite(Number(row.serialization_start_episode))
      ? Number(row.serialization_start_episode)
      : 1,
    serialization_weekdays: ensureArray(row.serialization_weekdays)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7),
    serialization_hiatus_ranges: ensureArray(row.serialization_hiatus_ranges).map((item) => ({
      start: toIsoDate(item?.start),
      end: toIsoDate(item?.end),
    })),
    derivative_memo: row.derivative_memo || "",
    episode_tracking_types: ensureArray(row.episode_tracking_types),
    updated_at: row.updated_at || row.created_at || null,
  };
}

function mapWriter(row, ctx) {
  const aliases = ensureArray(ctx.aliasesByWriterId.get(row.id)).sort((a, b) => {
    if (a.is_primary === b.is_primary) return 0;
    return a.is_primary ? -1 : 1;
  });
  const contacts = ensureArray(ctx.contactsByWriterId.get(row.id));
  const primaryPhone =
    contacts.find((item) => item.contact_type === "phone" && item.is_primary) ||
    contacts.find((item) => item.contact_type === "phone") ||
    null;
  const primaryEmail =
    contacts.find((item) => item.contact_type === "email" && item.is_primary) ||
    contacts.find((item) => item.contact_type === "email") ||
    null;

  return {
    id: row.id,
    team_id: row.team_id || null,
    name: row.legal_name || row.primary_pen_name || "미지정",
    pen_names: aliases.map((item) => item.alias_name),
    profile_link: row.profile_link || "",
    career_note: row.career_note || "",
    primary_genres: ensureArray(row.primary_genres),
    phone: primaryPhone?.contact_value || "",
    email: primaryEmail?.contact_value || "",
    employment_type: normalizeEmploymentType(row.employment_type, "미지정"),
    overall_grade: row.overall_grade || "B",
    work_grade: row.work_grade || "B",
    deadline_grade: row.deadline_grade || "B",
    communication_grade: row.communication_grade || "B",
    main_work_types: ensureArray(row.main_work_types),
    contract_link: row.contract_link || "",
    fee_label: row.fee_label || "",
    rs_ratio: Number.isFinite(Number(row.rs_ratio)) ? Number(row.rs_ratio) : null,
    fit_genres: ensureArray(row.fit_genres),
    legacy_note: row.legacy_note || "",
    work_note: row.work_note || "",
  };
}

function mapParticipant(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    writer_id: row.writer_id,
    team_id: row.team_id || null,
    role: row.role || "",
    status: row.status || "active",
    started_at: row.started_at || null,
    ended_at: row.ended_at || null,
    end_reason: row.end_reason || "",
    fee_label: row.fee_label || "",
    rs_ratio: Number.isFinite(Number(row.rs_ratio)) ? Number(row.rs_ratio) : null,
    hidden_from_ops: Boolean(row.hidden_from_ops),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  };
}

function mapTask(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    participant_id: row.participant_id,
    writer_id: row.writer_id,
    team_id: row.team_id || null,
    title: row.title || "",
    type: row.task_type || "",
    episode_no: normalizeEpisodeNo(row.episode_no),
    ps: row.planned_start_date || null,
    pe: row.planned_end_date || null,
    cs: row.current_start_date || null,
    ce: row.current_end_date || null,
    status: row.status || "planned",
    feedback_done: Boolean(row.feedback_done),
    planned_memo: row.planned_memo || "",
    scope_label: row.scope_label || row.title || "",
    serialization_date: row.serialization_date || null,
    stage_def_id: row.stage_def_id || null,
    assignment_id: row.assignment_id || null,
    rs_contract_term_id: row.rs_contract_term_id || null,
    approved_at: row.approved_at || null,
    is_archived: Boolean(row.is_archived),
  };
}

function mapScheduleChange(row) {
  return {
    id: row.id,
    task_id: row.task_id,
    project_id: row.project_id,
    writer_id: row.writer_id,
    old_start: row.old_start_date || null,
    old_end: row.old_end_date || null,
    new_start: row.new_start_date || null,
    new_end: row.new_end_date || null,
    change_type: row.change_type || row.reason_code || "schedule_adjustment",
    from_value: row.from_value || null,
    to_value: row.to_value || null,
    source: row.source || "manual",
    changed_at: row.created_at || null,
    is_typo: Boolean(row.is_typo),
    typo_marked_at: row.typo_marked_at || null,
  };
}

function mapWeeklyReport(row) {
  return {
    id: row.id,
    week_start: row.week_start,
    week_end: row.week_end,
    project_id: row.report_scope || "all",
    writer_id: row.writer_id,
    team_id: row.team_id || null,
    recommendation: row.recommendation || "maintain",
    score: Number.isFinite(Number(row.score)) ? Number(row.score) : 3,
    weekly_note: row.weekly_note || "",
    quality_grade: row.quality_grade || "",
    deadline_grade: row.deadline_grade || "",
    communication_grade: row.communication_grade || "",
    quality_note: row.quality_note || "",
    deadline_note: row.deadline_note || "",
    communication_note: row.communication_note || "",
    project_issue_note: row.project_issue_note || "",
    next_week_note: row.next_week_note || "",
    strengths: row.strengths || "",
    risks: row.risks || "",
    response_notes: row.response_notes || "",
    manager_note: row.manager_note || "",
    submitted_at: row.submitted_at || null,
  };
}

function mapStageDef(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    stage_code: row.stage_code,
    stage_name: row.stage_name,
    sort_order: row.sort_order,
    is_active: row.is_active !== false,
    allow_parallel_workers: Boolean(row.allow_parallel_workers),
    note: row.note || "",
  };
}

function mapStageAssignment(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    stage_def_id: row.stage_def_id,
    participant_id: row.participant_id,
    writer_id: row.writer_id,
    status: row.status || "active",
    started_at: row.started_at || null,
    ended_at: row.ended_at || null,
    replacement_reason: row.replacement_reason || "",
    note: row.note || "",
  };
}

function mapRsTerm(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    stage_def_id: row.stage_def_id,
    assignment_id: row.assignment_id,
    writer_id: row.writer_id,
    effective_start_date: row.effective_start_date || null,
    effective_end_date: row.effective_end_date || null,
    amount_basis: row.amount_basis || "scope_batch",
    unit_amount: Number.isFinite(Number(row.unit_amount)) ? Number(row.unit_amount) : 0,
    currency_code: row.currency_code || "KRW",
    scope_note: row.scope_note || "",
    change_reason: row.change_reason || "",
    is_current: row.is_current !== false,
  };
}

function mapSubmissionCycle(row) {
  return {
    id: row.id,
    work_batch_id: row.work_batch_id,
    cycle_no: row.cycle_no,
    submitted_at: row.submitted_at || null,
    submission_note: row.submission_note || "",
    pd_checked_at: row.pd_checked_at || null,
    feedback_note: row.feedback_note || "",
    revision_due_at: row.revision_due_at || null,
    resubmitted_at: row.resubmitted_at || null,
    is_approved: Boolean(row.is_approved),
  };
}

function mapProductionCostEntry(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    stage_def_id: row.stage_def_id,
    assignment_id: row.assignment_id,
    writer_id: row.writer_id,
    work_batch_id: row.work_batch_id,
    rs_contract_term_id: row.rs_contract_term_id,
    amount_basis: row.amount_basis || "scope_batch",
    unit_amount_snapshot: Number.isFinite(Number(row.unit_amount_snapshot))
      ? Number(row.unit_amount_snapshot)
      : 0,
    amount_total: Number.isFinite(Number(row.amount_total)) ? Number(row.amount_total) : 0,
    scope_label: row.scope_label || "",
    approved_at: row.approved_at || null,
  };
}

function mapProductionCost(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    team_id: row.team_id || null,
    cost_category: row.cost_category || "current",
    part: row.part || "",
    writer_name: row.writer_name || "",
    unit_price: Number.isFinite(Number(row.unit_price)) ? Number(row.unit_price) : 0,
    quantity: Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0,
    total_cost: Number.isFinite(Number(row.total_cost)) ? Number(row.total_cost) : 0,
    payment_schedule: row.payment_schedule || "",
    scope_label: row.scope_label || "",
    notes: row.notes || "",
  };
}

function mapServicePlatform(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    team_id: row.team_id || null,
    region: row.region || "국내",
    platform: row.platform_name || row.platform_code || "",
    platform_name: row.platform_name || row.platform_code || "",
    launch_date: row.launch_date || "",
    status: row.status || "계획",
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDerivativePlanning(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    team_id: row.team_id || null,
    type: row.planning_type || "",
    title: row.title || "",
    description: row.description || "",
    planned_date: row.planned_date || "",
    status: row.status || "계획",
    assigned_to: row.assigned_to || "",
    budget: Number.isFinite(Number(row.budget)) ? Number(row.budget) : 0,
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapChangeHistory(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    task_id: row.task_id,
    team_id: row.team_id || null,
    changed_by: row.changed_by || null,
    changed_date: row.changed_date || null,
    change_type: row.change_type || "",
    old_value: row.old_value || "",
    new_value: row.new_value || "",
    reason: row.reason || "",
    notes: row.notes || "",
    task_type: row.task_type || "",
    task_title: row.task_title || "",
    episode_no: normalizeEpisodeNo(row.episode_no),
    created_at: row.created_at || null,
  };
}

function mapWriterEvaluation(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    writer_id: row.writer_id,
    team_id: row.team_id || null,
    work_ability: row.work_ability || "",
    deadline_ability: row.deadline_ability || "",
    communication_ability: row.communication_ability || "",
    overall_assessment: row.overall_assessment || "",
    notes: row.notes || "",
    evaluated_by: row.evaluated_by || null,
    evaluated_at: row.evaluated_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function mapPdEvaluation(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    team_id: row.team_id || null,
    pd_id: row.pd_user_id || null,
    positive_assessment: row.positive_assessment || "",
    negative_assessment: row.negative_assessment || "",
    notes: row.notes || "",
    evaluated_at: row.evaluated_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function buildLegacyDb(rows) {
  const ctx = createLoadContext(rows);

  return normalizeDb({
    projects: ensureArray(rows.projects).map((item) => mapProject(item, ctx)),
    writers: ensureArray(rows.writers).map((item) => mapWriter(item, ctx)),
    participants: ensureArray(rows.project_participants).map(mapParticipant),
    tasks: ensureArray(rows.tasks).map(mapTask),
    records: [],
    schedule_changes: ensureArray(rows.task_schedule_changes).map(mapScheduleChange),
    weekly_reports: ensureArray(rows.weekly_reports).map(mapWeeklyReport),
    project_stage_defs: ensureArray(rows.project_stage_defs).map(mapStageDef),
    project_stage_assignments: ensureArray(rows.project_stage_assignments).map(mapStageAssignment),
    rs_contract_terms: ensureArray(rows.rs_contract_terms).map(mapRsTerm),
    work_submission_cycles: ensureArray(rows.work_submission_cycles).map(mapSubmissionCycle),
    production_cost_entries: ensureArray(rows.production_cost_entries).map(mapProductionCostEntry),
    production_costs: ensureArray(rows.production_costs).map(mapProductionCost),
    service_platforms: ensureArray(rows.service_platforms).map(mapServicePlatform),
    derivative_plannings: ensureArray(rows.derivative_plannings).map(mapDerivativePlanning),
    change_histories: ensureArray(rows.change_histories).map(mapChangeHistory),
    writer_evaluations: ensureArray(rows.writer_evaluations).map(mapWriterEvaluation),
    pd_evaluations: ensureArray(rows.pd_evaluations).map(mapPdEvaluation),
  });
}

async function fetchTable(client, table, organizationId) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) throw error;
  return ensureArray(data);
}

async function fetchWorkspaceRows(client, organizationId) {
  const tableNames = [
    "projects",
    "writers",
    "writer_aliases",
    "writer_contacts",
    "project_participants",
    "tasks",
    "task_schedule_changes",
    "weekly_reports",
    "project_stage_defs",
    "project_stage_assignments",
    "rs_contract_terms",
    "work_submission_cycles",
    "production_cost_entries",
    "production_costs",
    "service_platforms",
    "derivative_plannings",
    "change_histories",
    "writer_evaluations",
    "pd_evaluations",
  ];

  const results = await Promise.all(
    tableNames.map(async (table) => [table, await fetchTable(client, table, organizationId)])
  );

  const rows = Object.fromEntries(results);
  const profileIds = [...new Set(ensureArray(rows.projects).map((item) => item.pd_user_id).filter(Boolean))];
  rows.profiles = profileIds.length
    ? await (async () => {
        const { data, error } = await client.from("profiles").select("*").in("id", profileIds);
        if (error) throw error;
        return ensureArray(data);
      })()
    : [];

  return rows;
}

export function canUseSupabaseWorkspace() {
  return isSupabaseConfigured();
}

export function createEmptyWorkspaceDb() {
  return normalizeDb({});
}

export async function loadWorkspaceState({ organizationId }) {
  if (!organizationId) {
    return createEmptyWorkspaceDb();
  }

  const client = getClientOrThrow();
  const rows = await fetchWorkspaceRows(client, organizationId);
  return buildLegacyDb(rows);
}

function createSyncContext({ organizationId, currentUserId, defaultTeamId, nextDb }) {
  const projectsById = new Map(ensureArray(nextDb.projects).map((item) => [item.id, item]));
  const participantsById = new Map(ensureArray(nextDb.participants).map((item) => [item.id, item]));
  const stageDefsById = new Map(ensureArray(nextDb.project_stage_defs).map((item) => [item.id, item]));
  const stageDefsByProjectCode = new Map();

  ensureArray(nextDb.project_stage_defs).forEach((item) => {
    const projectId = String(item.project_id || "");
    const stageCode = String(item.stage_code || "").trim();
    if (!projectId || !stageCode) return;
    stageDefsByProjectCode.set(`${projectId}:${stageCode}`, item);
  });

  return {
    organizationId,
    currentUserId,
    defaultTeamId: defaultTeamId || null,
    projectsById,
    participantsById,
    stageDefsById,
    stageDefsByProjectCode,
    resolveProjectTeam(projectId) {
      return projectsById.get(projectId)?.team_id || defaultTeamId || null;
    },
    resolveParticipantTeam(participantId) {
      const participant = participantsById.get(participantId);
      return participant?.team_id || this.resolveProjectTeam(participant?.project_id);
    },
    resolveStageTeam(stageDefId) {
      const stage = stageDefsById.get(stageDefId);
      return this.resolveProjectTeam(stage?.project_id);
    },
    resolveTaskStageDefId(projectId, taskType, fallbackStageDefId = null) {
      if (fallbackStageDefId && stageDefsById.has(fallbackStageDefId)) {
        return fallbackStageDefId;
      }

      const normalizedType = normalizeWorkType(taskType);
      const stageCode = inferStageCodeFromType(normalizedType);
      if (!projectId || !stageCode) return null;

      return stageDefsByProjectCode.get(`${projectId}:${stageCode}`)?.id || null;
    },
  };
}

function projectToRow(project, ctx) {
  return {
    id: project.id,
    organization_id: ctx.organizationId,
    code: String(project.code || project.id),
    title: String(project.title || "").trim(),
    genre: String(project.genre || "").trim() || null,
    start_date: project.start_date || null,
    end_date: project.end_date || null,
    pd_user_id: uuidOrNull(project.pd_id),
    pd_display_name: String(project.pd_name || "").trim() || null,
    team_id: uuidOrNull(project.team_id) || uuidOrNull(ctx.defaultTeamId),
    team_label: String(project.team_label || "").trim() || null,
    total_episodes: Number.isFinite(Number(project.total_episodes)) ? Number(project.total_episodes) : null,
    production_mode: String(project.production_mode || "").trim() || null,
    co_production: String(project.co_production || "").trim() || null,
    co_production_partners: ensureArray(project.co_production_partners),
    status: "active",
    serialization_start_date: project.serialization_start_date || null,
    serialization_end_date: project.serialization_end_date || null,
    serialization_start_episode: Number.isFinite(Number(project.serialization_start_episode))
      ? Number(project.serialization_start_episode)
      : 1,
    serialization_weekdays: ensureArray(project.serialization_weekdays)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)),
    serialization_hiatus_ranges: ensureArray(project.serialization_hiatus_ranges),
    derivative_memo: String(project.derivative_memo || "").trim() || null,
    episode_tracking_types: ensureArray(project.episode_tracking_types),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function legacyProjectToRow(project, ctx) {
  return {
    id: project.id,
    organization_id: ctx.organizationId,
    code: String(project.code || project.id),
    title: String(project.title || "").trim(),
    genre: String(project.genre || "").trim() || null,
    start_date: project.start_date || null,
    end_date: project.end_date || null,
    pd_user_id: uuidOrNull(project.pd_id),
    team_id: uuidOrNull(project.team_id) || uuidOrNull(ctx.defaultTeamId),
    status: "active",
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function writerToRow(writer, ctx) {
  return {
    id: writer.id,
    organization_id: ctx.organizationId,
    team_id: uuidOrNull(writer.team_id) || uuidOrNull(ctx.defaultTeamId),
    legal_name: String(writer.name || "").trim(),
    primary_pen_name: ensureArray(writer.pen_names)[0] || null,
    employment_type: normalizeEmploymentType(String(writer.employment_type || "").trim(), "미지정"),
    overall_grade: String(writer.overall_grade || "").trim() || null,
    work_grade: String(writer.work_grade || "").trim() || null,
    deadline_grade: String(writer.deadline_grade || "").trim() || null,
    communication_grade: String(writer.communication_grade || "").trim() || null,
    recommendation: null,
    legacy_note: String(writer.legacy_note || "").trim() || null,
    profile_link: String(writer.profile_link || "").trim() || null,
    career_note: String(writer.career_note || "").trim() || null,
    primary_genres: ensureArray(writer.primary_genres),
    main_work_types: ensureArray(writer.main_work_types),
    contract_link: String(writer.contract_link || "").trim() || null,
    fee_label: String(writer.fee_label || "").trim() || null,
    rs_ratio: Number.isFinite(Number(writer.rs_ratio)) ? Number(writer.rs_ratio) : null,
    fit_genres: ensureArray(writer.fit_genres),
    work_note: String(writer.work_note || "").trim() || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function participantToRow(participant, ctx) {
  return {
    id: participant.id,
    organization_id: ctx.organizationId,
    project_id: participant.project_id,
    writer_id: participant.writer_id,
    team_id: uuidOrNull(participant.team_id) || uuidOrNull(ctx.resolveProjectTeam(participant.project_id)),
    role: String(participant.role || "").trim(),
    status: participant.status || "active",
    started_at: participant.started_at || null,
    ended_at: participant.ended_at || null,
    end_reason: String(participant.end_reason || "").trim() || null,
    fee_label: String(participant.fee_label || "").trim() || null,
    rs_ratio: Number.isFinite(Number(participant.rs_ratio)) ? Number(participant.rs_ratio) : null,
    replacement_note: String(participant.replacement_note || "").trim() || null,
    sort_order: Number.isFinite(Number(participant.sort_order)) ? Number(participant.sort_order) : 0,
    hidden_from_ops: Boolean(participant.hidden_from_ops),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function taskToRow(task, ctx) {
  const participant = ctx.participantsById.get(task.participant_id) || null;
  const projectId = participant?.project_id || task.project_id;
  const writerId = participant?.writer_id || task.writer_id;
  const teamId =
    uuidOrNull(participant?.team_id) ||
    uuidOrNull(task.team_id) ||
    uuidOrNull(ctx.resolveParticipantTeam(task.participant_id));
  const stageDefId = ctx.resolveTaskStageDefId(projectId, task.type, task.stage_def_id);

  return {
    id: task.id,
    organization_id: ctx.organizationId,
    project_id: projectId,
    participant_id: task.participant_id,
    writer_id: writerId,
    team_id: teamId,
    episode_no: normalizeEpisodeNo(task.episode_no),
    task_type: String(task.type || "").trim(),
    title: String(task.title || "").trim(),
    planned_start_date: task.ps || task.cs || null,
    planned_end_date: task.pe || task.ce || task.ps || task.cs || null,
    current_start_date: task.cs || task.ps || null,
    current_end_date: task.ce || task.pe || task.cs || task.ps || null,
    status: String(task.status || "planned"),
    feedback_done: Boolean(task.feedback_done),
    detail_note: null,
    planned_memo: String(task.planned_memo || "").trim() || null,
    scope_label: String(task.scope_label || task.title || "").trim() || null,
    serialization_date: task.serialization_date || null,
    stage_def_id: stageDefId,
    assignment_id: uuidOrNull(task.assignment_id),
    rs_contract_term_id: uuidOrNull(task.rs_contract_term_id),
    approved_at: task.approved_at || null,
    is_archived: Boolean(task.is_archived),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function taskToWorkBatchRow(task, ctx) {
  return {
    id: task.id,
    organization_id: ctx.organizationId,
    project_id: task.project_id,
    team_id: uuidOrNull(task.team_id) || uuidOrNull(ctx.resolveParticipantTeam(task.participant_id)),
    stage_def_id: uuidOrNull(task.stage_def_id),
    assignment_id: uuidOrNull(task.assignment_id),
    writer_id: task.writer_id,
    legacy_task_id: task.id,
    title: String(task.title || "").trim(),
    scope_label: String(task.scope_label || task.title || "").trim() || null,
    episode_start: Number.isFinite(Number(task.episode_no)) ? Number(task.episode_no) : null,
    episode_end: Number.isFinite(Number(task.episode_no)) ? Number(task.episode_no) : null,
    planned_note: task.planned_memo || null,
    status: String(task.status || "planned"),
    planned_start_date: task.ps || task.cs || null,
    planned_end_date: task.pe || task.ce || task.ps || task.cs || null,
    current_start_date: task.cs || task.ps || null,
    current_end_date: task.ce || task.pe || task.cs || task.ps || null,
    rs_contract_term_id: uuidOrNull(task.rs_contract_term_id),
    approved_at: task.approved_at || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function scheduleChangeToRow(change, ctx) {
  return {
    id: change.id,
    organization_id: ctx.organizationId,
    task_id: change.task_id,
    project_id: change.project_id,
    writer_id: change.writer_id,
    team_id: uuidOrNull(change.team_id) || uuidOrNull(ctx.resolveProjectTeam(change.project_id)),
    old_start_date: change.old_start || null,
    old_end_date: change.old_end || null,
    new_start_date: change.new_start || null,
    new_end_date: change.new_end || null,
    delay_days: 0,
    source: String(change.source || "manual"),
    reason_code: String(change.change_type || "schedule_adjustment"),
    reason_detail: null,
    change_type: String(change.change_type || "schedule_adjustment"),
    from_value: change.from_value || null,
    to_value: change.to_value || null,
    is_typo: Boolean(change.is_typo),
    typo_marked_at: change.typo_marked_at || null,
    changed_by: uuidOrNull(change.changed_by),
    created_at: change.changed_at || nowIso(),
  };
}

function weeklyReportToRow(report, ctx) {
  return {
    id: report.id,
    organization_id: ctx.organizationId,
    week_start: report.week_start,
    week_end: report.week_end,
    report_scope: report.project_id || "all",
    writer_id: report.writer_id,
    team_id:
      uuidOrNull(report.team_id) ||
      (report.project_id && report.project_id !== "all"
        ? uuidOrNull(ctx.resolveProjectTeam(report.project_id))
        : uuidOrNull(ctx.defaultTeamId)),
    recommendation: report.recommendation || "maintain",
    score: Number.isFinite(Number(report.score)) ? Number(report.score) : 3,
    weekly_note: report.weekly_note || null,
    strengths: report.strengths || null,
    risks: report.risks || null,
    response_notes: report.response_notes || null,
    manager_note: report.manager_note || null,
    submitted_at: report.submitted_at || nowIso(),
    quality_grade: report.quality_grade || null,
    deadline_grade: report.deadline_grade || null,
    communication_grade: report.communication_grade || null,
    quality_note: report.quality_note || null,
    deadline_note: report.deadline_note || null,
    communication_note: report.communication_note || null,
    project_issue_note: report.project_issue_note || null,
    next_week_note: report.next_week_note || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function stageDefToRow(stage, ctx) {
  return {
    id: stage.id,
    organization_id: ctx.organizationId,
    project_id: stage.project_id,
    team_id: uuidOrNull(ctx.resolveProjectTeam(stage.project_id)),
    stage_code: stage.stage_code,
    stage_name: stage.stage_name,
    sort_order: Number(stage.sort_order || 0),
    is_active: stage.is_active !== false,
    allow_parallel_workers: Boolean(stage.allow_parallel_workers),
    note: stage.note || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function stageAssignmentToRow(assignment, ctx) {
  return {
    id: assignment.id,
    organization_id: ctx.organizationId,
    project_id: assignment.project_id,
    team_id: uuidOrNull(ctx.resolveProjectTeam(assignment.project_id)),
    stage_def_id: assignment.stage_def_id,
    participant_id: uuidOrNull(assignment.participant_id),
    writer_id: assignment.writer_id,
    status: assignment.status || "active",
    started_at: assignment.started_at || null,
    ended_at: assignment.ended_at || null,
    replacement_reason: assignment.replacement_reason || null,
    note: assignment.note || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function rsTermToRow(term, ctx) {
  return {
    id: term.id,
    organization_id: ctx.organizationId,
    project_id: term.project_id,
    team_id: uuidOrNull(ctx.resolveProjectTeam(term.project_id)),
    stage_def_id: uuidOrNull(term.stage_def_id),
    assignment_id: uuidOrNull(term.assignment_id),
    writer_id: term.writer_id,
    effective_start_date: term.effective_start_date || null,
    effective_end_date: term.effective_end_date || null,
    amount_basis: term.amount_basis || "scope_batch",
    unit_amount: Number(term.unit_amount || 0),
    currency_code: term.currency_code || "KRW",
    scope_note: term.scope_note || null,
    change_reason: term.change_reason || null,
    is_current: term.is_current !== false,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function submissionCycleToRow(cycle, ctx) {
  return {
    id: cycle.id,
    organization_id: ctx.organizationId,
    team_id: uuidOrNull(ctx.defaultTeamId),
    work_batch_id: cycle.work_batch_id,
    cycle_no: Number(cycle.cycle_no || 1),
    submitted_at: cycle.submitted_at || null,
    submission_note: cycle.submission_note || null,
    pd_checked_at: cycle.pd_checked_at || null,
    feedback_note: cycle.feedback_note || null,
    revision_due_at: cycle.revision_due_at || null,
    resubmitted_at: cycle.resubmitted_at || null,
    is_approved: Boolean(cycle.is_approved),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function productionCostEntryToRow(entry, ctx) {
  return {
    id: entry.id,
    organization_id: ctx.organizationId,
    project_id: entry.project_id,
    team_id: uuidOrNull(ctx.resolveProjectTeam(entry.project_id)),
    stage_def_id: uuidOrNull(entry.stage_def_id),
    assignment_id: uuidOrNull(entry.assignment_id),
    writer_id: entry.writer_id,
    work_batch_id: entry.work_batch_id,
    rs_contract_term_id: uuidOrNull(entry.rs_contract_term_id),
    amount_basis: entry.amount_basis || "scope_batch",
    unit_amount_snapshot: Number(entry.unit_amount_snapshot || 0),
    currency_code: "KRW",
    scope_label: entry.scope_label || null,
    amount_total: Number(entry.amount_total || 0),
    approved_at: entry.approved_at || nowIso(),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function productionCostToRow(cost, ctx) {
  return {
    id: cost.id,
    organization_id: ctx.organizationId,
    project_id: cost.project_id,
    team_id: uuidOrNull(cost.team_id) || uuidOrNull(ctx.resolveProjectTeam(cost.project_id)),
    cost_category: cost.cost_category || "current",
    part: cost.part || null,
    writer_name: cost.writer_name || null,
    unit_price: Number(cost.unit_price || 0),
    quantity: Number(cost.quantity || 0),
    total_cost: Number(cost.total_cost || 0),
    payment_schedule: cost.payment_schedule || null,
    scope_label: cost.scope_label || null,
    notes: cost.notes || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function servicePlatformToRow(item, ctx) {
  return {
    id: item.id,
    organization_id: ctx.organizationId,
    project_id: item.project_id,
    team_id: uuidOrNull(item.team_id) || uuidOrNull(ctx.resolveProjectTeam(item.project_id)),
    region: item.region || "국내",
    platform_code: item.platform || item.platform_name || null,
    platform_name: item.platform_name || item.platform || null,
    launch_date: item.launch_date || null,
    status: item.status || "계획",
    notes: item.notes || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function derivativePlanningToRow(item, ctx) {
  return {
    id: item.id,
    organization_id: ctx.organizationId,
    project_id: item.project_id,
    team_id: uuidOrNull(item.team_id) || uuidOrNull(ctx.resolveProjectTeam(item.project_id)),
    planning_type: item.type || null,
    title: item.title || null,
    description: item.description || item.notes || null,
    planned_date: item.planned_date || null,
    status: item.status || "계획",
    assigned_to: item.assigned_to || null,
    budget: Number(item.budget || 0),
    notes: item.notes || null,
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function changeHistoryToRow(item, ctx) {
  return {
    id: item.id,
    organization_id: ctx.organizationId,
    project_id: item.project_id,
    task_id: item.task_id || null,
    team_id: uuidOrNull(item.team_id) || uuidOrNull(ctx.resolveProjectTeam(item.project_id)),
    changed_by: uuidOrNull(item.changed_by) || ctx.currentUserId,
    changed_date: item.changed_date || null,
    change_type: item.change_type || null,
    old_value: item.old_value || null,
    new_value: item.new_value || null,
    reason: item.reason || null,
    notes: item.notes || null,
    task_type: item.task_type || null,
    task_title: item.task_title || null,
    episode_no: normalizeEpisodeNo(item.episode_no),
    created_at: item.created_at || nowIso(),
  };
}

function writerEvaluationToRow(item, ctx) {
  return {
    id: item.id,
    organization_id: ctx.organizationId,
    project_id: item.project_id,
    writer_id: item.writer_id,
    team_id: uuidOrNull(item.team_id) || uuidOrNull(ctx.resolveProjectTeam(item.project_id)),
    work_ability: item.work_ability || null,
    deadline_ability: item.deadline_ability || null,
    communication_ability: item.communication_ability || null,
    overall_assessment: item.overall_assessment || null,
    notes: item.notes || null,
    evaluated_by: uuidOrNull(item.evaluated_by) || ctx.currentUserId,
    evaluated_at: item.evaluated_at || toIsoDate(nowIso()),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

function pdEvaluationToRow(item, ctx) {
  return {
    id: item.id,
    organization_id: ctx.organizationId,
    project_id: item.project_id,
    team_id: uuidOrNull(item.team_id) || uuidOrNull(ctx.resolveProjectTeam(item.project_id)),
    pd_user_id: uuidOrNull(item.pd_id) || ctx.currentUserId,
    positive_assessment: item.positive_assessment || null,
    negative_assessment: item.negative_assessment || null,
    notes: item.notes || null,
    evaluated_at: item.evaluated_at || toIsoDate(nowIso()),
    created_by: ctx.currentUserId,
    updated_by: ctx.currentUserId,
    updated_at: nowIso(),
  };
}

const PRIMARY_SYNC_ADAPTERS = [
  { key: "projects", table: "projects", toRow: projectToRow },
  { key: "writers", table: "writers", toRow: writerToRow, nestedWriterData: true },
  { key: "participants", table: "project_participants", toRow: participantToRow },
  { key: "project_stage_defs", table: "project_stage_defs", toRow: stageDefToRow },
  { key: "project_stage_assignments", table: "project_stage_assignments", toRow: stageAssignmentToRow },
  { key: "rs_contract_terms", table: "rs_contract_terms", toRow: rsTermToRow },
  { key: "tasks", table: "tasks", toRow: taskToRow },
  { key: "schedule_changes", table: "task_schedule_changes", toRow: scheduleChangeToRow, appendOnly: true, hasUpdatedAt: false },
  { key: "weekly_reports", table: "weekly_reports", toRow: weeklyReportToRow },
];

const SECONDARY_SYNC_ADAPTERS = [
  { key: "work_submission_cycles", table: "work_submission_cycles", toRow: submissionCycleToRow },
  { key: "production_cost_entries", table: "production_cost_entries", toRow: productionCostEntryToRow },
  { key: "production_costs", table: "production_costs", toRow: productionCostToRow },
  { key: "service_platforms", table: "service_platforms", toRow: servicePlatformToRow },
  { key: "derivative_plannings", table: "derivative_plannings", toRow: derivativePlanningToRow },
  { key: "change_histories", table: "change_histories", toRow: changeHistoryToRow, hasUpdatedAt: false },
  { key: "writer_evaluations", table: "writer_evaluations", toRow: writerEvaluationToRow },
  { key: "pd_evaluations", table: "pd_evaluations", toRow: pdEvaluationToRow },
];

async function replaceWriterNestedTables(client, writer, organizationId) {
  const writerId = writer.id;
  const timestamp = nowIso();
  const aliasRows = ensureArray(writer.pen_names)
    .filter(Boolean)
    .map((alias, index) => ({
      id: deterministicUuid(`alias:${writerId}:${alias}:${index}`),
      organization_id: organizationId,
      writer_id: writerId,
      alias_name: String(alias).trim(),
      is_primary: index === 0,
      created_at: timestamp,
      updated_at: timestamp,
    }));
  const contactRows = [
    writer.phone
      ? {
          id: deterministicUuid(`contact:${writerId}:phone:${writer.phone}`),
          organization_id: organizationId,
          writer_id: writerId,
          contact_type: "phone",
          contact_value: String(writer.phone).trim(),
          is_primary: true,
          created_at: timestamp,
          updated_at: timestamp,
        }
      : null,
    writer.email
      ? {
          id: deterministicUuid(`contact:${writerId}:email:${writer.email}`),
          organization_id: organizationId,
          writer_id: writerId,
          contact_type: "email",
          contact_value: String(writer.email).trim().toLowerCase(),
          is_primary: true,
          created_at: timestamp,
          updated_at: timestamp,
        }
      : null,
  ].filter(Boolean);

  const deactivate = async (table) => {
    const { error } = await client
      .from(table)
      .update({
        deleted_at: timestamp,
        updated_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("writer_id", writerId)
      .is("deleted_at", null);

    if (error) throw error;
  };

  await deactivate("writer_aliases");
  await deactivate("writer_contacts");

  if (aliasRows.length) {
    const { error } = await client.from("writer_aliases").upsert(aliasRows, { onConflict: "id" });
    if (error) throw error;
  }

  if (contactRows.length) {
    const { error } = await client.from("writer_contacts").upsert(contactRows, { onConflict: "id" });
    if (error) throw error;
  }
}

function diffCollection(previousItems, nextItems, { appendOnly = false }) {
  const previousById = new Map(ensureArray(previousItems).map((item) => [item.id, item]));
  const nextById = new Map(ensureArray(nextItems).map((item) => [item.id, item]));
  const upserts = [];
  const deletes = [];

  nextById.forEach((nextItem, id) => {
    const previousItem = previousById.get(id);
    if (!previousItem || stableStringify(previousItem) !== stableStringify(nextItem)) {
      upserts.push(nextItem);
    }
  });

  if (!appendOnly) {
    previousById.forEach((previousItem, id) => {
      if (!nextById.has(id)) {
        deletes.push(previousItem);
      }
    });
  }

  return { upserts, deletes };
}

function getMissingWeeklyReportColumns(error) {
  const message = String(error?.message || error?.details || error?.hint || "");
  return ["project_issue_note", "next_week_note"].filter(
    (column) => message.includes(`'${column}'`) && message.includes("'weekly_reports'")
  );
}

function getMissingProjectColumns(error) {
  const message = String(error?.message || error?.details || error?.hint || "");
  return [
    "team_label",
    "total_episodes",
    "production_mode",
    "co_production",
    "co_production_partners",
    "serialization_end_date",
    "derivative_memo",
  ].filter((column) => message.includes(`'${column}'`) && message.includes("'projects'"));
}

async function syncAdapter(client, adapter, ctx, previousDb, nextDb) {
  const previousItems = ensureArray(previousDb[adapter.key]);
  const nextItems = ensureArray(nextDb[adapter.key]);
  const { upserts: changedItems, deletes } = diffCollection(previousItems, nextItems, adapter);
  const upserts = changedItems.map((item) => adapter.toRow(item, ctx));

  if (upserts.length) {
    let upsertError = null;
    let { error } = await client.from(adapter.table).upsert(upserts, { onConflict: "id" });
    upsertError = error;

    if (upsertError && adapter.table === "weekly_reports") {
      const missingColumns = getMissingWeeklyReportColumns(upsertError);
      if (missingColumns.length) {
        const fallbackRows = upserts.map((row) => {
          const nextRow = { ...row };
          missingColumns.forEach((column) => {
            delete nextRow[column];
          });
          return nextRow;
        });
        const retryResult = await client.from(adapter.table).upsert(fallbackRows, { onConflict: "id" });
        upsertError = retryResult.error;
      }
    }

    if (upsertError && adapter.table === "projects") {
      const missingColumns = getMissingProjectColumns(upsertError);
      if (missingColumns.length) {
        const fallbackRows = upserts.map((row) => {
          const nextRow = { ...row };
          missingColumns.forEach((column) => {
            delete nextRow[column];
          });
          return nextRow;
        });
        const retryResult = await client.from(adapter.table).upsert(fallbackRows, { onConflict: "id" });
        upsertError = retryResult.error;
      }
    }

    if (upsertError && adapter.table === "projects") {
      const legacyRows = changedItems.map((item) => legacyProjectToRow(item, ctx));
      const legacyResult = await client.from(adapter.table).upsert(legacyRows, { onConflict: "id" });
      upsertError = legacyResult.error;
    }

    if (upsertError) throw upsertError;
  }

  if (adapter.nestedWriterData && upserts.length) {
    const writerMap = new Map(ensureArray(nextDb.writers).map((item) => [item.id, item]));
    for (const row of upserts) {
      const writer = writerMap.get(row.id);
      if (writer) {
        await replaceWriterNestedTables(client, writer, ctx.organizationId);
      }
    }
  }

  if (deletes.length && !APPEND_ONLY_COLLECTIONS.has(adapter.key)) {
    const patch =
      adapter.hasUpdatedAt === false
        ? { deleted_at: nowIso() }
        : { deleted_at: nowIso(), updated_at: nowIso() };
    const { error } = await client.from(adapter.table).update(patch).in("id", deletes.map((item) => item.id));
    if (error) throw error;

    if (adapter.nestedWriterData) {
      for (const deletedWriter of deletes) {
        await replaceWriterNestedTables(
          client,
          { id: deletedWriter.id, pen_names: [], phone: "", email: "" },
          ctx.organizationId
        );
      }
    }
  }
}

export async function syncWorkspaceDiff({
  organizationId,
  currentUserId,
  defaultTeamId,
  previousDb,
  nextDb,
}) {
  if (!organizationId) return;

  const safePreviousDb = sanitizeDbForSync(previousDb);
  const safeNextDb = sanitizeDbForSync(nextDb);
  const client = getClientOrThrow();
  const ctx = createSyncContext({
    organizationId,
    currentUserId,
    defaultTeamId,
    nextDb: safeNextDb,
  });

  for (const adapter of PRIMARY_SYNC_ADAPTERS) {
    await syncAdapter(client, adapter, ctx, safePreviousDb, safeNextDb);
  }

  for (const adapter of SECONDARY_SYNC_ADAPTERS) {
    try {
      await syncAdapter(client, adapter, ctx, safePreviousDb, safeNextDb);
    } catch (error) {
      console.warn(`[workspace-sync:${adapter.table}]`, error);
    }
  }
}

export function subscribeToWorkspaceChanges({ organizationId, onChange }) {
  if (!organizationId || typeof onChange !== "function") {
    return () => {};
  }

  const client = getClientOrThrow();
  const filter = `organization_id=eq.${organizationId}`;
  const channel = WORKSPACE_REALTIME_TABLES.reduce(
    (currentChannel, table) =>
      currentChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        onChange
      ),
    client.channel(`workspace-sync:${organizationId}`)
  );

  channel.subscribe();

  return () => {
    channel.unsubscribe();
  };
}
