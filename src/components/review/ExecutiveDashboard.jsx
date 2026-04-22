import { useMemo, useState } from "react";
import { D } from "../../utils/workspace";
import { getLabelStatus, isCompletedStatus, normalizeTaskStatus } from "../../data.js";
import { buildWeeklyProjectWriterGroups } from "./reviewWeekModel.js";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return dateStr.slice(5);
}

function gradeColor(grade) {
  if (grade === "A") return "ex2-a";
  if (grade === "B") return "ex2-b";
  if (grade === "C") return "ex2-c";
  return "ex2-empty";
}

function GradeCell({ grade }) {
  return <span className={`ex2-gt ${gradeColor(grade)}`}>{grade || "—"}</span>;
}

function SubmissionBadge({ submitted }) {
  return (
    <span className={`ex2-report-badge${submitted ? " is-submitted" : " is-pending"}`}>
      {submitted ? "제출" : "미제출"}
    </span>
  );
}

function statusClassForTask(task) {
  const normalized = normalizeTaskStatus(task?.status);
  if (normalized === "planned") return "st-plan";
  if (normalized === "in_progress") return "st-ongoing";
  if (normalized === "completed") return "st-done";
  return "st-hold";
}

function isDelayedTask(task) {
  return Boolean(task && !isCompletedStatus(task.status) && task.ce && D(task.ce) < D(new Date()));
}

function WriterCard({ writer, report, tasks }) {
  const hasReport = Boolean(report?.submitted_at);
  const hasBadGrade =
    hasReport &&
    (report.quality_grade === "C" || report.deadline_grade === "C" || report.communication_grade === "C");
  const hasDelayed = tasks.some((task) => isDelayedTask(task));
  const rows = tasks.length > 0 ? tasks : [null];
  const noteText = [report?.project_issue_note, report?.next_week_note].filter(Boolean).join(" / ");

  return (
    <>
      {rows.map((task, index) => {
        const normalizedStatus = task ? normalizeTaskStatus(task.status) : null;
        const delayed = task ? isDelayedTask(task) : false;
        const start = task ? task.cs || task.ps : null;
        const end = task ? task.ce || task.pe : null;

        return (
          <div
            key={task?.id ?? `${writer.id}_empty`}
            className={`ex2-flat-row${hasBadGrade || hasDelayed ? " has-risk" : ""}${hasReport ? "" : " no-report"}`}
          >
            <div className="ex2-flat-name">
              {index === 0 ? (
                <>
                  <span className="ex2-writer-name">{writer.name}</span>
                  {!hasReport ? <span className="ex2-no-report-badge">미제출</span> : null}
                  {hasBadGrade || hasDelayed ? <span className="ex2-risk-dot" /> : null}
                </>
              ) : null}
            </div>

            <div className="ex2-flat-report">{index === 0 ? <SubmissionBadge submitted={hasReport} /> : null}</div>

            <div className="ex2-flat-status">
              {task ? (
                <span className={`ex2-task-status ${statusClassForTask(task)}${delayed ? " overdue" : ""}`}>
                  {delayed ? "지연" : getLabelStatus(normalizedStatus)}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </div>

            <div className="ex2-flat-dates">
              {task ? (
                <span className="ex2-task-dates">
                  {fmt(start)}
                  <span className="sep">~</span>
                  {fmt(end)}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </div>

            <div className="ex2-flat-title">
              {task ? (
                <span className="ex2-task-title">
                  {task.episode_no ? `${task.episode_no}화 ` : ""}
                  {task.title || task.type}
                  <span className="ex2-task-type">{task.type}</span>
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </div>

            <div className="ex2-flat-grade-cell">{index === 0 ? <GradeCell grade={hasReport ? report.quality_grade : ""} /> : null}</div>
            <div className="ex2-flat-grade-cell">{index === 0 ? <GradeCell grade={hasReport ? report.deadline_grade : ""} /> : null}</div>
            <div className="ex2-flat-grade-cell">{index === 0 ? <GradeCell grade={hasReport ? report.communication_grade : ""} /> : null}</div>

            <div className="ex2-flat-note">
              {index === 0 ? (
                hasReport && noteText ? (
                  <span className="ex2-flat-note-text">{noteText}</span>
                ) : (
                  <span className="muted">{hasReport ? "—" : ""}</span>
                )
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

function ProjectCard({ project, writers, getReport, weekTasks }) {
  const [collapsed, setCollapsed] = useState(false);
  const submitted = writers.filter((writer) => getReport(project.id, writer.id)?.submitted_at).length;
  const total = writers.length;
  const riskCount = writers.filter((writer) => {
    const report = getReport(project.id, writer.id);
    const writerTasks = weekTasks.filter((task) => task.project_id === project.id && task.writer_id === writer.id);
    const hasDelay = writerTasks.some((task) => isDelayedTask(task));
    return (
      (report &&
        (report.quality_grade === "C" || report.deadline_grade === "C" || report.communication_grade === "C")) ||
      hasDelay
    );
  }).length;

  return (
    <div className={`ex2-project-card${riskCount > 0 ? " has-risk" : ""}`}>
      <button type="button" className="ex2-project-header" onClick={() => setCollapsed((value) => !value)}>
        <div className="ex2-project-info">
          <span className="ex2-project-title">{project.title}</span>
          {project.genre ? <span className="ex2-project-genre">{project.genre}</span> : null}
        </div>
        <div className="ex2-project-meta">
          {riskCount > 0 ? <span className="ex2-risk-badge">리스크 {riskCount}명</span> : null}
          <span className={`ex2-submit-pill${submitted === total ? " done" : submitted > 0 ? " partial" : ""}`}>
            {submitted}/{total}
          </span>
          <span className="ex2-chevron">{collapsed ? "▼" : "▲"}</span>
        </div>
      </button>

      {!collapsed ? (
        <div className="ex2-project-body">
          <div className="ex2-writer-list-head">
            <span className="ex2-col-head">제출여부</span>
            <span className="ex2-col-head">작가</span>
            <span className="ex2-col-head">상태</span>
            <span className="ex2-col-head">작업 기간</span>
            <span className="ex2-col-head">작업명</span>
            <span className="ex2-col-head center">작업</span>
            <span className="ex2-col-head center">마감</span>
            <span className="ex2-col-head center">소통</span>
            <span className="ex2-col-head">특이사항 / 다음주 메모</span>
          </div>
          {writers.map((writer) => (
            <WriterCard
              key={writer.id}
              writer={writer}
              report={getReport(project.id, writer.id)}
              tasks={weekTasks.filter((task) => task.project_id === project.id && task.writer_id === writer.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PdSection({ pd, getReport, weekTasks }) {
  const submitted = pd.projects.reduce(
    (sum, { project, writers }) =>
      sum + writers.filter((writer) => getReport(project.id, writer.id)?.submitted_at).length,
    0
  );
  const total = pd.projects.reduce((sum, { writers }) => sum + writers.length, 0);

  return (
    <div className="ex2-pd-section">
      <div className="ex2-pd-header">
        <div className="ex2-pd-title">
          <span className="ex2-pd-name">{pd.pd_name}</span>
          <span className="ex2-pd-sub">작품 {pd.projects.length}개</span>
        </div>
        <div className={`ex2-pd-progress${submitted === total ? " done" : ""}`}>
          <div className="ex2-progress-fill" style={{ width: total > 0 ? `${(submitted / total) * 100}%` : "0%" }} />
          <span className="ex2-progress-text">{submitted}/{total} 제출</span>
        </div>
      </div>
      <div className="ex2-project-list">
        {pd.projects.map(({ project, writers }) => (
          <ProjectCard key={project.id} project={project} writers={writers} getReport={getReport} weekTasks={weekTasks} />
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveDashboard({ db, weekTasks, weekStart, writerName }) {
  const [selectedPd, setSelectedPd] = useState("all");

  const reportMap = useMemo(() => {
    const map = {};
    db.weekly_reports.filter((report) => report.week_start === weekStart).forEach((report) => {
      map[`${report.project_id}::${report.writer_id}`] = report;
    });
    db.weekly_reports
      .filter((report) => report.week_start === weekStart && report.project_id === "all")
      .forEach((report) => {
        map[`__all__::${report.writer_id}`] = report;
      });
    return map;
  }, [db.weekly_reports, weekStart]);

  const getReport = (projectId, writerId) =>
    reportMap[`${projectId}::${writerId}`] || reportMap[`__all__::${writerId}`];

  const pdGroups = useMemo(() => {
    const pdMap = new Map();
    buildWeeklyProjectWriterGroups({
      projects: db.projects,
      weekTasks,
      writerName,
    }).forEach(({ project, writers }) => {
      if (!pdMap.has(project.pd_id)) {
        pdMap.set(project.pd_id, { pd_id: project.pd_id, pd_name: project.pd_name, projects: [] });
      }
      pdMap.get(project.pd_id).projects.push({ project, writers });
    });
    return [...pdMap.values()].sort((a, b) => String(a.pd_name).localeCompare(String(b.pd_name), "ko"));
  }, [db.projects, weekTasks, writerName]);

  const stats = useMemo(() => {
    let total = 0;
    let submitted = 0;
    let riskWriters = 0;

    pdGroups.forEach((pd) => {
      pd.projects.forEach(({ project, writers }) => {
        total += writers.length;
        writers.forEach((writer) => {
          const report = getReport(project.id, writer.id);
          const writerTasks = weekTasks.filter((task) => task.project_id === project.id && task.writer_id === writer.id);
          const hasDelay = writerTasks.some((task) => isDelayedTask(task));
          if (report?.submitted_at) submitted += 1;
          if (
            (report &&
              (report.quality_grade === "C" || report.deadline_grade === "C" || report.communication_grade === "C")) ||
            hasDelay
          ) {
            riskWriters += 1;
          }
        });
      });
    });

    return {
      total,
      submitted,
      riskWriters,
      pdCount: pdGroups.length,
      projectCount: pdGroups.reduce((sum, pd) => sum + pd.projects.length, 0),
    };
  }, [pdGroups, weekTasks]);

  const visiblePds = selectedPd === "all" ? pdGroups : pdGroups.filter((pd) => pd.pd_id === selectedPd);

  return (
    <div className="ex2-dashboard">
      <div className="ex2-stats-row">
        <div className="ex2-stat-card">
          <span className="ex2-stat-num">{stats.pdCount}</span>
          <span className="ex2-stat-label">PD</span>
        </div>
        <div className="ex2-stat-card">
          <span className="ex2-stat-num">{stats.projectCount}</span>
          <span className="ex2-stat-label">작품</span>
        </div>
        <div className={`ex2-stat-card${stats.submitted === stats.total ? " accent-green" : ""}`}>
          <span className="ex2-stat-num">
            {stats.submitted}
            <small>/{stats.total}</small>
          </span>
          <span className="ex2-stat-label">보고서 제출</span>
          <div className="ex2-stat-bar">
            <div className="ex2-stat-bar-fill" style={{ width: stats.total > 0 ? `${(stats.submitted / stats.total) * 100}%` : "0%" }} />
          </div>
        </div>
        <div className="ex2-stat-card">
          <span className="ex2-stat-num">{weekTasks.length}</span>
          <span className="ex2-stat-label">이번 주 작업</span>
        </div>
        {stats.riskWriters > 0 ? (
          <div className="ex2-stat-card accent-red">
            <span className="ex2-stat-num">{stats.riskWriters}</span>
            <span className="ex2-stat-label">리스크 작가</span>
          </div>
        ) : null}
      </div>

      <div className="ex2-pd-card-row">
        <button
          type="button"
          className={`ex2-pd-card${selectedPd === "all" ? " selected" : ""}`}
          onClick={() => setSelectedPd("all")}
        >
          <span className="ex2-pd-card-name">전체</span>
          <div className="ex2-pd-card-meta">
            <span>PD {stats.pdCount}명</span>
            <span>작품 {stats.projectCount}개</span>
          </div>
          <div className="ex2-pd-card-bar">
            <div className="ex2-pd-card-bar-fill" style={{ width: stats.total > 0 ? `${(stats.submitted / stats.total) * 100}%` : "0%" }} />
          </div>
          <div className="ex2-pd-card-bottom">
            <span className={`ex2-pd-card-submit${stats.submitted === stats.total ? " done" : ""}`}>
              제출 {stats.submitted}/{stats.total}
            </span>
            {stats.riskWriters > 0 ? <span className="ex2-pd-card-risk">{stats.riskWriters}</span> : null}
          </div>
        </button>

        {pdGroups.map((pd) => {
          const pdTotal = pd.projects.reduce((sum, { writers }) => sum + writers.length, 0);
          const pdSubmitted = pd.projects.reduce(
            (sum, { project, writers }) =>
              sum + writers.filter((writer) => getReport(project.id, writer.id)?.submitted_at).length,
            0
          );
          const pdRisk = pd.projects.reduce(
            (sum, { project, writers }) =>
              sum +
              writers.filter((writer) => {
                const report = getReport(project.id, writer.id);
                const writerTasks = weekTasks.filter((task) => task.project_id === project.id && task.writer_id === writer.id);
                const delayed = writerTasks.some((task) => isDelayedTask(task));
                return (
                  (report &&
                    (report.quality_grade === "C" || report.deadline_grade === "C" || report.communication_grade === "C")) ||
                  delayed
                );
              }).length,
            0
          );
          const pct = pdTotal > 0 ? (pdSubmitted / pdTotal) * 100 : 0;

          return (
            <button
              key={pd.pd_id}
              type="button"
              className={`ex2-pd-card${selectedPd === pd.pd_id ? " selected" : ""}${pdRisk > 0 ? " has-risk" : ""}`}
              onClick={() => setSelectedPd(pd.pd_id)}
            >
              <span className="ex2-pd-card-name">{pd.pd_name}</span>
              <div className="ex2-pd-card-projects">
                {pd.projects.map(({ project }) => {
                  const title = project.title;
                  const label = title.length > 6 ? `${title.slice(0, 6)}…` : title;
                  return (
                    <span key={project.id} className="ex2-pd-card-project" title={title}>
                      {label}
                    </span>
                  );
                })}
              </div>
              <div className="ex2-pd-card-bar">
                <div className="ex2-pd-card-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="ex2-pd-card-bottom">
                <span className={`ex2-pd-card-submit${pdSubmitted === pdTotal ? " done" : ""}`}>
                  제출 {pdSubmitted}/{pdTotal}
                </span>
                {pdRisk > 0 ? <span className="ex2-pd-card-risk">{pdRisk}</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="ex2-sections">
        {visiblePds.map((pd) => (
          <PdSection key={pd.pd_id} pd={pd} getReport={getReport} weekTasks={weekTasks} />
        ))}
      </div>
    </div>
  );
}
