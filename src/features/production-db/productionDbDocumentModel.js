import { WORK_TYPE_OPTIONS } from "../../data.js";

const PART_LABELS = {
  글: "글 / 원작",
  콘티: "콘티",
  선화: "선화",
  밑색: "밑색",
  명암: "명암",
  배경: "배경",
  후보정: "후보정",
  편집: "편집",
};

function toDateText(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function toDateSortValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function toneForStatus(status) {
  if (status === "완료") return "good";
  if (status.startsWith("확인")) return "review";
  return "warn";
}

function averageGrade(values) {
  const score = { A: 3, B: 2, C: 1 };
  const valid = values.filter((value) => score[value]);
  if (!valid.length) return "-";
  const avg = valid.reduce((sum, value) => sum + score[value], 0) / valid.length;
  if (avg >= 2.5) return "A";
  if (avg >= 1.5) return "B";
  return "C";
}

function buildPeopleSection({ project, participants, writersById, pdEvaluations }) {
  const columns = WORK_TYPE_OPTIONS.map((role) => {
    const entries = participants
      .filter((item) => item.role === role)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        return toDateSortValue(b.started_at || b.ended_at).localeCompare(
          toDateSortValue(a.started_at || a.ended_at)
        );
      })
      .map((item) => ({
        id: item.id,
        writerId: item.writer_id,
        name: writersById.get(item.writer_id)?.name || "미지정",
        status: item.status,
        startedAt: item.started_at || "",
        endedAt: item.ended_at || "",
        note: item.end_reason || "",
      }));

    return {
      role,
      label: PART_LABELS[role] || role,
      entries,
    };
  });

  const rowCount = Math.max(1, ...columns.map((column) => column.entries.length));
  const pdHistory = Array.from(
    new Set(
      [project.pd_name, ...pdEvaluations.map((item) => item.pd_name || item.pd_id).filter(Boolean)].filter(Boolean)
    )
  );

  return {
    teamLabel: project.team_id || "team_1",
    pdName: project.pd_name || "미지정 PD",
    pdRole: "담당 PD",
    columns,
    rowCount,
    pdHistoryLabel: pdHistory.length ? pdHistory.join(" - ") : project.pd_name || "미지정",
  };
}

function buildProjectInfo(project) {
  return {
    genre: project.genre || "-",
    totalEpisodes: Number.isFinite(Number(project.total_episodes)) ? Number(project.total_episodes) : "-",
    productionMode: project.production_mode || "-",
    coProduction: project.co_production || "-",
    coProductionPartners: Array.isArray(project.co_production_partners)
      ? project.co_production_partners.filter(Boolean)
      : [],
    productionStart: toDateText(project.start_date),
    productionEnd: toDateText(project.end_date),
    serializationStart: toDateText(project.serialization_start_date),
    serializationEnd: toDateText(project.serialization_end_date || project.end_date),
    derivativeMemo: project.derivative_memo || "-",
  };
}

function buildHistoryRows({
  projectId,
  changeHistories,
  rsContractTerms,
  projectStageDefs,
  assignmentsById,
  writersById,
}) {
  const stageById = new Map(projectStageDefs.map((item) => [item.id, item]));
  const isContractHistory = (item) => {
    const text = [
      item.change_type,
      item.title,
      item.notes,
      item.description,
      item.reason,
      item.old_value,
      item.new_value,
    ]
      .filter(Boolean)
      .join(" ");

    return ["계약", "해지", "이관"].some((keyword) => text.includes(keyword));
  };

  const contractRows = rsContractTerms
    .filter((item) => item.project_id === projectId)
    .map((item) => {
      const writerName = writersById.get(item.writer_id)?.name || "미지정";
      const stageName = stageById.get(item.stage_def_id)?.stage_name || "기타";
      const assignment = item.assignment_id ? assignmentsById.get(item.assignment_id) : null;
      const statusLabel =
        assignment?.status === "ended" || item.effective_end_date
          ? "계약 종료"
          : item.change_reason?.includes("수정") || item.change_reason?.includes("변경")
            ? "계약 변경"
            : "계약 진행";
      const detail = [item.scope_note, item.change_reason].filter(Boolean).join(" / ") || "-";

      return {
        id: `contract_${item.id}`,
        date: item.effective_start_date || item.effective_end_date || "",
        issue: `${writerName} 작가 ${stageName} ${statusLabel}`,
        detail,
        source: "contract",
      };
    });

  const manualRows = changeHistories
    .filter((item) => item.project_id === projectId && isContractHistory(item))
    .map((item) => ({
      id: `history_${item.id}`,
      date: item.changed_date || item.changed_at || item.created_at || "",
      issue: item.change_type || item.title || "변경 이력",
      detail:
        item.notes ||
        item.description ||
        [item.old_value, item.new_value].filter(Boolean).join(" → ") ||
        item.reason ||
        "-",
      source: "manual",
    }));

  return [...contractRows, ...manualRows].sort((a, b) => toDateSortValue(a.date).localeCompare(toDateSortValue(b.date)));
}

function buildCurrentCostRows({
  projectId,
  participants,
  assignments,
  writersById,
  projectStageDefs,
  rsContractTerms,
  tasks,
}) {
  const stageById = new Map(projectStageDefs.map((item) => [item.id, item]));
  const taskByAssignment = new Map();

  tasks
    .filter((task) => task.project_id === projectId && !task.is_archived)
    .forEach((task) => {
      if (!task.assignment_id) return;
      const existing = taskByAssignment.get(task.assignment_id);
      if (!existing || toDateSortValue(task.ce || task.pe || task.ps) > toDateSortValue(existing.ce || existing.pe || existing.ps)) {
        taskByAssignment.set(task.assignment_id, task);
      }
    });

  return assignments
    .filter((assignment) => assignment.project_id === projectId && assignment.status === "active")
    .map((assignment) => {
      const participant = participants.find((item) => item.id === assignment.participant_id) || null;
      const contract =
        rsContractTerms.find(
          (item) =>
            item.project_id === projectId &&
            item.assignment_id === assignment.id &&
            item.writer_id === assignment.writer_id &&
            item.is_current
        ) || null;
      const latestTask = taskByAssignment.get(assignment.id) || null;

      return {
        id: `current_${assignment.id}`,
        part: stageById.get(assignment.stage_def_id)?.stage_name || participant?.role || "-",
        writerName: writersById.get(assignment.writer_id)?.name || "미지정",
        unitAmount: formatMoney(contract?.unit_amount || 0),
        scopeLabel: latestTask?.scope_label || contract?.scope_note || "-",
        totalAmount: formatMoney(contract?.unit_amount || 0),
        note: contract?.change_reason || assignment.note || "-",
      };
    })
    .sort((a, b) => a.part.localeCompare(b.part, "ko-KR"));
}

function buildEndedCostRows({
  projectId,
  participants,
  writersById,
  projectStageDefs,
  rsContractTerms,
  assignmentsById,
  manualCosts,
}) {
  const stageById = new Map(projectStageDefs.map((item) => [item.id, item]));

  const contractRows = rsContractTerms
    .filter((item) => item.project_id === projectId && (!item.is_current || item.effective_end_date))
    .map((item) => {
      const assignment = item.assignment_id ? assignmentsById.get(item.assignment_id) : null;
      const participant = participants.find((entry) => entry.id === assignment?.participant_id) || null;
      return {
        id: `ended_contract_${item.id}`,
        part: stageById.get(item.stage_def_id)?.stage_name || participant?.role || "-",
        writerName: writersById.get(item.writer_id)?.name || "미지정",
        unitAmount: formatMoney(item.unit_amount || 0),
        scopeLabel: item.scope_note || "-",
        totalAmount: formatMoney(item.unit_amount || 0),
        note: item.change_reason || participant?.end_reason || "-",
      };
    });

  const manualRows = manualCosts
    .filter((item) => item.cost_category === "ended")
    .map((item) => ({
      id: `ended_manual_${item.id}`,
      part: item.part || "-",
      writerName: item.writer_name || "-",
      unitAmount: formatMoney(item.unit_price || 0),
      scopeLabel: item.scope_label || String(item.quantity || 0),
      totalAmount: formatMoney(item.total_cost || Number(item.unit_price || 0) * Number(item.quantity || 0)),
      note: item.notes || "-",
    }));

  return [...contractRows, ...manualRows];
}

function buildTestCostRows(manualCosts) {
  return manualCosts
    .filter((item) => item.cost_category === "test")
    .map((item) => ({
      id: `test_${item.id}`,
      part: item.part || "-",
      writerName: item.writer_name || "-",
      unitAmount: formatMoney(item.unit_price || 0),
      scopeLabel: item.scope_label || String(item.quantity || 0),
      totalAmount: formatMoney(item.total_cost || Number(item.unit_price || 0) * Number(item.quantity || 0)),
      note: item.notes || "-",
    }));
}

function buildWriterReviewRows({ reports, participantsByWriter, writersById }) {
  const grouped = new Map();

  reports.forEach((report) => {
    if (!grouped.has(report.writer_id)) grouped.set(report.writer_id, []);
    grouped.get(report.writer_id).push(report);
  });

  return Array.from(grouped.entries())
    .map(([writerId, items]) => {
      const sorted = [...items].sort((a, b) => toDateSortValue(b.week_start).localeCompare(toDateSortValue(a.week_start)));
      const latest = sorted[0];
      const writer = writersById.get(writerId);
      const participant = participantsByWriter.get(writerId);

      return {
        writerId,
        role: participant?.role || "-",
        name: writer?.name || "미지정",
        email: writer?.email || "-",
        workAbility: averageGrade(sorted.map((item) => item.quality_grade)),
        deadlineAbility: averageGrade(sorted.map((item) => item.deadline_grade)),
        communicationAbility: averageGrade(sorted.map((item) => item.communication_grade)),
        summaryLines: [latest?.strengths, latest?.risks, latest?.weekly_note].filter(Boolean),
        historyLines: [
          `평가 ${sorted.length}회`,
          `최근 평가 ${toDateText(latest?.week_start)}`,
          ...sorted.slice(0, 3).map(
            (item) =>
              `${toDateText(item.week_start)} · 작업 ${item.quality_grade || "-"} / 마감 ${item.deadline_grade || "-"} / 소통 ${item.communication_grade || "-"}`
          ),
        ],
      };
    })
    .sort((a, b) => a.role.localeCompare(b.role, "ko-KR") || a.name.localeCompare(b.name, "ko-KR"));
}

export function buildProductionDbDocumentModel(db, project) {
  const writersById = new Map((db.writers || []).map((writer) => [writer.id, writer]));
  const projectStageDefs = (db.project_stage_defs || []).filter((item) => item.project_id === project.id);
  const participants = (db.participants || [])
    .filter((item) => item.project_id === project.id && !item.hidden_from_ops)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return toDateSortValue(b.started_at || b.ended_at).localeCompare(toDateSortValue(a.started_at || a.ended_at));
    });
  const assignments = (db.project_stage_assignments || []).filter((item) => item.project_id === project.id);
  const assignmentsById = new Map(assignments.map((item) => [item.id, item]));
  const rsContractTerms = (db.rs_contract_terms || []).filter((item) => item.project_id === project.id);
  const servicePlatforms = (db.service_platforms || [])
    .filter((item) => item.project_id === project.id)
    .sort((a, b) => String(a.region || "").localeCompare(String(b.region || ""), "ko-KR"));
  const derivativeContracts = (db.derivative_plannings || [])
    .filter((item) => item.project_id === project.id)
    .sort((a, b) => toDateSortValue(a.planned_date).localeCompare(toDateSortValue(b.planned_date)));
  const manualHistories = (db.change_histories || []).filter((item) => item.project_id === project.id);
  const manualCosts = (db.production_costs || []).filter((item) => item.project_id === project.id);
  const tasks = (db.tasks || []).filter((item) => item.project_id === project.id && !item.is_archived);
  const pdEvaluations = (db.pd_evaluations || []).filter((item) => item.project_id === project.id);
  const latestPdEvaluation = [...pdEvaluations].sort((a, b) => toDateSortValue(b.evaluated_at).localeCompare(toDateSortValue(a.evaluated_at)))[0] || null;

  const participantsByWriter = new Map(
    participants.filter((item) => item.status === "active").map((item) => [item.writer_id, item])
  );
  const projectSpecificReports = (db.weekly_reports || []).filter((report) => report.project_id === project.id);
  const fallbackReports = (db.weekly_reports || []).filter(
    (report) => report.project_id === "all" && participantsByWriter.has(report.writer_id)
  );
  const reviewReports = projectSpecificReports.length ? projectSpecificReports : fallbackReports;

  const histories = buildHistoryRows({
    projectId: project.id,
    changeHistories: db.change_histories || [],
    rsContractTerms,
    projectStageDefs,
    assignmentsById,
    writersById,
  });
  const currentCostRows = buildCurrentCostRows({
    projectId: project.id,
    participants,
    assignments,
    writersById,
    projectStageDefs,
    rsContractTerms,
    tasks,
  });
  const endedCostRows = buildEndedCostRows({
    projectId: project.id,
    participants,
    writersById,
    projectStageDefs,
    rsContractTerms,
    assignmentsById,
    manualCosts,
  });
  const testCostRows = buildTestCostRows(manualCosts);

  const totalCostAmount = [...currentCostRows, ...endedCostRows, ...testCostRows].reduce(
    (sum, item) => sum + Number(String(item.totalAmount || "0").replaceAll(",", "")),
    0
  );

  const sections = [
    {
      id: "people",
      number: 1,
      title: "인적 사항",
      status: participants.length ? "확인 1" : "입력 1",
    },
    {
      id: "production-info",
      number: 2,
      title: "작품 정보(제작)",
      status: project.genre && project.start_date ? "확인 1" : "입력 1",
    },
    {
      id: "service",
      number: 3,
      title: "작품 정보(서비스팀)",
      status: servicePlatforms.length ? "확인 1" : "입력 1",
    },
    {
      id: "derivative-contracts",
      number: 4,
      title: "파생 계약(서비스팀)",
      status: derivativeContracts.length ? "확인 1" : "입력 1",
    },
    {
      id: "history",
      number: 5,
      title: "히스토리(제작/서비스팀 공용)",
      status: histories.length ? "완료" : "입력 1",
    },
    {
      id: "cost",
      number: 6,
      title: "제작 비용",
      status: currentCostRows.length || endedCostRows.length || testCostRows.length ? "확인 1" : "입력 1",
    },
    {
      id: "writer-review",
      number: 7,
      title: "작가정보 및 평가",
      status: reviewReports.length ? "완료" : "입력 1",
    },
    {
      id: "pd-review",
      number: 8,
      title: "담당 PD 총평",
      status: latestPdEvaluation?.notes ? "확인 1" : "입력 3",
    },
  ].map((section) => ({ ...section, tone: toneForStatus(section.status) }));

  return {
    projectInfo: buildProjectInfo(project),
    people: buildPeopleSection({ project, participants, writersById, pdEvaluations }),
    servicePlatforms,
    derivativeContracts,
    histories,
    cost: {
      currentRows: currentCostRows,
      endedRows: endedCostRows,
      testRows: testCostRows,
      totalAmount: formatMoney(totalCostAmount),
    },
    writerReviewSourceLabel: projectSpecificReports.length ? "주간보고" : "참여 작가 주간보고",
    writerReviewRows: buildWriterReviewRows({
      reports: reviewReports,
      participantsByWriter,
      writersById,
    }),
    pdReview: {
      positive: latestPdEvaluation?.positive_assessment || "-",
      negative: latestPdEvaluation?.negative_assessment || "-",
      note: latestPdEvaluation?.notes || "-",
      evaluatedAt: toDateText(latestPdEvaluation?.evaluated_at),
    },
    sections,
  };
}
