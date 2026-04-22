import { useMemo, useState } from "react";
import { buildWeeklyProjectWriterGroups } from "./reviewWeekModel.js";

const GRADES = ["A", "B", "C"];

const GRADE_LABELS = {
  quality_grade: "작업평가",
  deadline_grade: "마감평가",
  communication_grade: "소통평가",
};

const GRADE_NOTE_KEYS = {
  quality_grade: "quality_note",
  deadline_grade: "deadline_note",
  communication_grade: "communication_note",
};

function gradeClass(grade, selected) {
  if (!selected) return "wr-grade-btn";
  if (grade === "A") return "wr-grade-btn grade-a selected";
  if (grade === "B") return "wr-grade-btn grade-b selected";
  if (grade === "C") return "wr-grade-btn grade-c selected";
  return "wr-grade-btn selected";
}

function WriterReportCard({ project, writer, report, weekStart, weekEnd, onSave }) {
  const initialDraft = {
    quality_grade: report?.quality_grade || "",
    deadline_grade: report?.deadline_grade || "",
    communication_grade: report?.communication_grade || "",
    quality_note: report?.quality_note || "",
    deadline_note: report?.deadline_note || "",
    communication_note: report?.communication_note || "",
    project_issue_note: report?.project_issue_note || "",
    next_week_note: report?.next_week_note || "",
  };

  const [draft, setDraft] = useState(initialDraft);
  const [expanded, setExpanded] = useState(!report?.submitted_at);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const isSubmitted = Boolean(report?.submitted_at);
  const allGraded = draft.quality_grade && draft.deadline_grade && draft.communication_grade;

  function setGrade(key, value) {
    setDraft((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
    setSaved(false);
  }

  function setNote(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit() {
    onSave({
      weekStart,
      weekEnd,
      projectId: project.id,
      writerId: writer.id,
      patch: draft,
    });
    setSaved(true);
  }

  return (
    <div className={`wr-writer-card${isSubmitted ? " submitted" : ""}${expanded ? " open" : ""}`}>
      <button type="button" className="wr-writer-header" onClick={() => setExpanded((value) => !value)}>
        <div className="wr-writer-meta">
          <span className="wr-writer-name">{writer.name}</span>
          {isSubmitted && !isDirty ? (
            <span className="wr-badge submitted">제출 완료</span>
          ) : (
            <span className="wr-badge pending">미제출</span>
          )}
        </div>

        <div className="wr-grade-summary">
          {Object.entries(GRADE_LABELS).map(([key, label]) => {
            const grade = draft[key];
            return (
              <span key={key} className={`wr-grade-chip${grade ? ` grade-${grade.toLowerCase()}` : " is-empty"}`}>
                {label} {grade || "-"}
              </span>
            );
          })}
        </div>

        <span className="wr-chevron">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="wr-writer-body">
          <div className="wr-grade-grid">
            {Object.entries(GRADE_LABELS).map(([gradeKey, label]) => {
              const noteKey = GRADE_NOTE_KEYS[gradeKey];

              return (
                <div key={gradeKey} className="wr-grade-col">
                  <div className="wr-grade-col-head">
                    <span className="wr-grade-label">{label}</span>
                    <div className="wr-grade-btns">
                      {GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          className={gradeClass(grade, draft[gradeKey] === grade)}
                          onClick={() => setGrade(gradeKey, grade)}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="wr-note-input"
                    placeholder="메모"
                    value={draft[noteKey]}
                    onChange={(event) => setNote(noteKey, event.target.value)}
                    rows={3}
                  />
                </div>
              );
            })}
          </div>

          <div className="wr-card-foot">
            <div className="wr-note-stack">
              <textarea
                className="wr-note-input wr-weekly-note"
                placeholder="작품 특이사항"
                value={draft.project_issue_note}
                onChange={(event) => setNote("project_issue_note", event.target.value)}
                rows={3}
              />
              <textarea
                className="wr-note-input wr-weekly-note"
                placeholder="다음주 메모"
                value={draft.next_week_note}
                onChange={(event) => setNote("next_week_note", event.target.value)}
                rows={3}
              />
            </div>
            <div className="wr-foot-actions">
              {saved ? <span className="wr-saved-msg">제출 완료</span> : null}
              <button
                type="button"
                className={`btn${allGraded ? "" : " btn-disabled"}`}
                disabled={!allGraded}
                onClick={handleSubmit}
              >
                {isSubmitted ? "재제출" : "제출"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectCard({ project, writers, reports, weekStart, weekEnd, onSave }) {
  const [collapsed, setCollapsed] = useState(false);
  const submittedCount = writers.filter((writer) => reports[`${project.id}::${writer.id}`]?.submitted_at).length;

  return (
    <div className="wr-project-card">
      <button type="button" className="wr-project-header" onClick={() => setCollapsed((value) => !value)}>
        <div className="wr-project-title">
          <strong>{project.title}</strong>
          <span className="wr-project-pd">{project.pd_name}</span>
        </div>
        <div className="wr-project-progress">
          <span className={`wr-progress-text${submittedCount === writers.length ? " done" : ""}`}>
            {submittedCount}/{writers.length} 작가 제출
          </span>
          <span className="wr-chevron">{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {!collapsed ? (
        <div className="wr-project-body">
          {writers.map((writer) => (
            <WriterReportCard
              key={`${weekStart}::${project.id}::${writer.id}`}
              project={project}
              writer={writer}
              report={reports[`${project.id}::${writer.id}`]}
              weekStart={weekStart}
              weekEnd={weekEnd}
              onSave={onSave}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PdInputPanel({ db, weekTasks, weekStart, weekEnd, upsertWeeklyReport, writerName, filterPdId }) {
  const reportMap = useMemo(() => {
    const nextMap = {};
    db.weekly_reports
      .filter((report) => report.week_start === weekStart)
      .forEach((report) => {
        nextMap[`${report.project_id}::${report.writer_id}`] = report;
      });
    return nextMap;
  }, [db.weekly_reports, weekStart]);

  const projectWriters = useMemo(
    () =>
      buildWeeklyProjectWriterGroups({
        projects: db.projects,
        weekTasks,
        writerName,
        filterPdId,
      }),
    [db.projects, filterPdId, weekTasks, writerName]
  );

  if (projectWriters.length === 0) {
    return <div className="empty">이번 주에 제출할 작품이 없습니다.</div>;
  }

  return (
    <div className="wr-input-stack">
      {projectWriters.map(({ project, writers }) => (
        <ProjectCard
          key={project.id}
          project={project}
          writers={writers}
          reports={reportMap}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onSave={upsertWeeklyReport}
        />
      ))}
    </div>
  );
}
