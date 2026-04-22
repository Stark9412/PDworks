import { getLabelStatus, normalizeWorkType, normalizeWorkTypeList } from "../../data.js";

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function includesText(source, query) {
  if (!query) return false;
  return norm(source).includes(norm(query));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

export function splitCommaValues(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function gradeToPoint(grade) {
  return grade === "A" ? 3 : grade === "C" ? 1 : 2;
}

export function pointToGrade(point) {
  return point >= 2.5 ? "A" : point >= 1.5 ? "B" : "C";
}

export function getWriterWorkTypes(db, writerId) {
  const writer = db.writers.find((item) => item.id === writerId);
  const participantRoles = db.participants
    .filter((participant) => participant.writer_id === writerId)
    .map((participant) => normalizeWorkType(participant.role));

  const taskTypes = db.tasks
    .filter((task) => task.writer_id === writerId)
    .map((task) => normalizeWorkType(task.type));
  const mainWorkTypes = normalizeWorkTypeList(writer?.main_work_types);
  return uniq([...mainWorkTypes, ...participantRoles, ...taskTypes]);
}

export function getWriterRecentWork(db, writerId) {
  const tasks = db.tasks.filter((task) => task.writer_id === writerId);
  if (!tasks.length) {
    return {
      label: "작업 이력 없음",
      sortValue: "",
    };
  }

  const sorted = [...tasks].sort((a, b) =>
    String(b.approved_at || b.ce || b.cs || b.pe || b.ps || "").localeCompare(
      String(a.approved_at || a.ce || a.cs || a.pe || a.ps || "")
    )
  );
  const task = sorted[0];
  const start = task.cs || task.ps || "";
  const end = task.ce || task.pe || "";
  return {
    label: start && end ? `${start} ~ ${end}` : start || end || "기간 미정",
    sortValue: task.approved_at || end || start || "",
  };
}

export function getWriterEvaluationReports(db, writerId) {
  return db.weekly_reports
    .filter((report) => report.writer_id === writerId)
    .sort((a, b) =>
      String(b.submitted_at || b.week_start || "").localeCompare(String(a.submitted_at || a.week_start || ""))
    )
    .map((report) => ({
      ...report,
      project_title:
        report.project_id && report.project_id !== "all"
          ? db.projects.find((project) => project.id === report.project_id)?.title || "-"
          : "전체 작품",
    }));
}

export function getWriterTotalGrade(db, writer) {
  const reports = getWriterEvaluationReports(db, writer.id).filter(
    (report) => report.quality_grade || report.deadline_grade || report.communication_grade
  );

  if (!reports.length) return writer.overall_grade || "B";

  let total = 0;
  let count = 0;
  reports.forEach((report) => {
    ["quality_grade", "deadline_grade", "communication_grade"].forEach((key) => {
      if (!report[key]) return;
      total += gradeToPoint(report[key]);
      count += 1;
    });
  });

  if (!count) return writer.overall_grade || "B";
  return pointToGrade(total / count);
}

export function buildWriterSearchFields(db, writer) {
  return {
    name: writer.name || "",
    pen_name: (writer.pen_names || []).join(" "),
    email: writer.email || "",
    phone: writer.phone || "",
    work_type: getWriterWorkTypes(db, writer.id).join(" "),
  };
}

export function getStrictMatchResult(db, writer, filters, mode) {
  const activeEntries = Object.entries(filters).filter(([, value]) => String(value || "").trim());
  if (!activeEntries.length) return true;

  const fields = buildWriterSearchFields(db, writer);
  const matches = activeEntries.map(([key, value]) => includesText(fields[key], value));
  return mode === "or" ? matches.some(Boolean) : matches.every(Boolean);
}

export function getCandidateScore(db, writer, filters) {
  const fields = buildWriterSearchFields(db, writer);
  const matched = [];
  let score = 0;

  const weights = {
    name: 3,
    pen_name: 3,
    email: 5,
    phone: 5,
    work_type: 2,
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (!String(value || "").trim()) return;
    if (!includesText(fields[key], value)) return;
    score += weights[key] || 1;
    matched.push(key);
  });

  return { score, matched };
}

export function getCandidateLabel(matched) {
  const labelMap = {
    name: "이름",
    pen_name: "필명",
    email: "이메일",
    phone: "전화번호",
    work_type: "작업 구분",
  };
  return matched.map((key) => labelMap[key] || key).join(" + ");
}

export function getWriterLatestRsRows(db, writerId) {
  const projectsById = new Map(db.projects.map((project) => [project.id, project]));
  const stagesById = new Map(db.project_stage_defs.map((stage) => [stage.id, stage]));
  const completedTasks = db.tasks.filter((task) => task.writer_id === writerId && task.approved_at);

  const latestCompletedByStage = new Map();
  completedTasks.forEach((task) => {
    const key = task.stage_def_id || task.type || "stage";
    const current = latestCompletedByStage.get(key);
    const stamp = task.approved_at || task.ce || task.pe || "";
    if (!current || stamp > current.sortValue) {
      latestCompletedByStage.set(key, { sortValue: stamp, task });
    }
  });

  const currentTerms = db.rs_contract_terms
    .filter((term) => term.writer_id === writerId && term.is_current)
    .sort((a, b) =>
      String(b.effective_start_date || "").localeCompare(String(a.effective_start_date || ""))
    );

  const rows = new Map();
  currentTerms.forEach((term) => {
    if (rows.has(term.stage_def_id)) return;
    const stage = stagesById.get(term.stage_def_id);
    const latestCompleted = latestCompletedByStage.get(term.stage_def_id)?.task || null;
    rows.set(term.stage_def_id, {
      id: `${writerId}_${term.stage_def_id}`,
      stage_name: stage?.stage_name || "기타",
      project_title: projectsById.get(term.project_id)?.title || "-",
      effective_start_date: term.effective_start_date || null,
      unit_amount: Number(term.unit_amount || 0),
      latest_completed_at: latestCompleted?.approved_at || latestCompleted?.ce || latestCompleted?.pe || null,
    });
  });

  return [...rows.values()].sort((a, b) => a.stage_name.localeCompare(b.stage_name));
}

export function getWriterCurrentAssignments(db, writerId) {
  const projectsById = new Map(db.projects.map((project) => [project.id, project]));
  const stagesById = new Map(db.project_stage_defs.map((stage) => [stage.id, stage]));
  const participantsById = new Map(db.participants.map((participant) => [participant.id, participant]));

  return db.project_stage_assignments
    .filter((assignment) => assignment.writer_id === writerId && assignment.status === "active")
    .map((assignment) => {
      const participant = participantsById.get(assignment.participant_id) || null;
      const feeLabel = participant?.fee_label || "";
      const rsRatio = participant?.rs_ratio ?? null;
      const compensationLabel =
        feeLabel || rsRatio != null
          ? `MG ${feeLabel || "-"} / RS ${rsRatio ?? "-"}`
          : "";

      return {
        ...assignment,
        project_title: projectsById.get(assignment.project_id)?.title || "-",
        stage_name: stagesById.get(assignment.stage_def_id)?.stage_name || "기타",
        note: [compensationLabel, assignment.note].filter(Boolean).join(" · "),
      };
    })
    .sort(
      (a, b) =>
        a.project_title.localeCompare(b.project_title) || a.stage_name.localeCompare(b.stage_name)
    );
}

export function getWriterProductionCostSummary(db, writerId) {
  const entries = db.production_cost_entries.filter((entry) => entry.writer_id === writerId);
  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.amount_total || 0), 0);
  return {
    totalAmount,
    entryCount: entries.length,
    latestApprovedAt:
      [...entries]
        .sort((a, b) => String(b.approved_at || "").localeCompare(String(a.approved_at || "")))[0]
        ?.approved_at || null,
  };
}

export function getWriterRecentSubmissionCycles(db, writerId, limit = 5) {
  const tasksById = new Map(db.tasks.map((task) => [task.id, task]));
  const projectsById = new Map(db.projects.map((project) => [project.id, project]));
  const stagesById = new Map(db.project_stage_defs.map((stage) => [stage.id, stage]));

  return db.work_submission_cycles
    .map((cycle) => {
      const task = tasksById.get(cycle.work_batch_id);
      if (!task || task.writer_id !== writerId) return null;
      return {
        ...cycle,
        project_title: projectsById.get(task.project_id)?.title || "-",
        stage_name: stagesById.get(task.stage_def_id)?.stage_name || task.type || "기타",
        scope_label: task.scope_label || task.title || "",
        task_status_label: getLabelStatus(task.status),
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      String(b.submitted_at || b.resubmitted_at || "").localeCompare(
        String(a.submitted_at || a.resubmitted_at || "")
      )
    )
    .slice(0, limit);
}
