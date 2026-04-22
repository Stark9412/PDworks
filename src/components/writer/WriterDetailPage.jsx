import { useEffect, useMemo, useState } from "react";
import { getLabelStatus } from "../../data.js";
import Panel from "../ui/Panel.jsx";
import Field from "../ui/Field.jsx";
import Button from "../ui/Button.jsx";
import {
  getWriterCurrentAssignments,
  getWriterEvaluationReports,
  getWriterLatestRsRows,
  getWriterProductionCostSummary,
  getWriterRecentSubmissionCycles,
  getWriterTotalGrade,
  getWriterWorkTypes,
} from "./writerDbModel.js";

function parseListInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
}

function buildWriterDraft(writer) {
  if (!writer) return null;

  return {
    name: writer.name || "",
    pen_names: (writer.pen_names || []).join(", "),
    profile_link: writer.profile_link || "",
    career_note: writer.career_note || "",
    primary_genres: (writer.primary_genres || []).join(", "),
    fit_genres: (writer.fit_genres || []).join(", "),
    employment_type: writer.employment_type || "미지정",
    phone: writer.phone || "",
    email: writer.email || "",
    contract_link: writer.contract_link || "",
    legacy_note: writer.legacy_note || "",
  };
}

export default function WriterDetailPage({ db, writerId, patchWriter, deleteWriter, onBack }) {
  const writer = useMemo(
    () => db.writers.find((item) => item.id === writerId) || null,
    [db.writers, writerId]
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState(() => buildWriterDraft(writer));
  const [message, setMessage] = useState("");

  const tasks = useMemo(
    () =>
      db.tasks
        .filter((item) => item.writer_id === writerId)
        .sort((a, b) =>
          String(b.approved_at || b.ce || b.pe || "").localeCompare(
            String(a.approved_at || a.ce || a.pe || "")
          )
        )
        .map((task) => ({
          ...task,
          project_title: db.projects.find((project) => project.id === task.project_id)?.title || "-",
        })),
    [db.tasks, db.projects, writerId]
  );

  const evaluations = useMemo(() => getWriterEvaluationReports(db, writerId), [db, writerId]);
  const totalGrade = useMemo(() => (writer ? getWriterTotalGrade(db, writer) : "B"), [db, writer]);
  const workTypes = useMemo(() => getWriterWorkTypes(db, writerId), [db, writerId]);
  const latestRsRows = useMemo(() => getWriterLatestRsRows(db, writerId), [db, writerId]);
  const currentAssignments = useMemo(() => getWriterCurrentAssignments(db, writerId), [db, writerId]);
  const productionCost = useMemo(() => getWriterProductionCostSummary(db, writerId), [db, writerId]);
  const recentCycles = useMemo(() => getWriterRecentSubmissionCycles(db, writerId), [db, writerId]);

  useEffect(() => {
    setDraft(buildWriterDraft(writer));
    setIsEditing(false);
    setIsSaving(false);
    setIsDeleting(false);
    setMessage("");
  }, [writer]);

  if (!writer) {
    return (
      <Panel title="작가 상세">
        <p className="helper-text">선택된 작가를 찾지 못했습니다.</p>
        <Button onClick={onBack}>목록으로</Button>
      </Panel>
    );
  }

  const currentDraft = draft || buildWriterDraft(writer);

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...(prev || buildWriterDraft(writer)), [key]: value }));
  };

  const startEdit = () => {
    setDraft(buildWriterDraft(writer));
    setIsEditing(true);
    setMessage("");
  };

  const cancelEdit = () => {
    setDraft(buildWriterDraft(writer));
    setIsEditing(false);
    setMessage("수정을 취소했습니다.");
  };

  const saveEdit = async () => {
    const name = String(currentDraft?.name || "").trim();
    if (!name) {
      setMessage("작가명은 비워둘 수 없습니다.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const result = await patchWriter(writer.id, {
      name,
      pen_names: parseListInput(currentDraft.pen_names),
      profile_link: String(currentDraft.profile_link || "").trim(),
      career_note: String(currentDraft.career_note || "").trim(),
      primary_genres: parseListInput(currentDraft.primary_genres),
      fit_genres: parseListInput(currentDraft.fit_genres),
      employment_type: currentDraft.employment_type || "미지정",
      phone: String(currentDraft.phone || "").trim(),
      email: String(currentDraft.email || "").trim(),
      contract_link: String(currentDraft.contract_link || "").trim(),
      legacy_note: String(currentDraft.legacy_note || "").trim(),
    });

    setIsSaving(false);

    if (!result?.ok) {
      setMessage(result?.message || "작가 정보를 저장하지 못했습니다.");
      return;
    }

    setIsEditing(false);
    setMessage("작가 정보를 저장했습니다.");
  };

  const removeWriter = async () => {
    const confirmed = window.confirm(
      `"${writer.name}" 작가를 삭제 예약하시겠습니까?\n목록에서 즉시 숨김 처리되고, 연결된 참여 이력/작업/보고서 데이터도 함께 삭제 예약됩니다.\n실제 데이터는 7일 뒤 영구 삭제됩니다.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setMessage("");

    const result = await deleteWriter(writer.id);
    setIsDeleting(false);

    if (!result?.ok) {
      setMessage(result?.message || "작가 삭제 예약을 반영하지 못했습니다.");
      return;
    }

    setMessage("작가 삭제를 예약했습니다. 7일 뒤 영구 삭제됩니다.");
    onBack();
  };

  return (
    <section className="writer-detail-page">
      <Panel
        title={`${writer.name} 상세`}
        actions={
          <div className="writer-detail-toolbar">
            <Button onClick={onBack}>목록으로</Button>
            {!isEditing ? (
              <Button variant="primary" onClick={startEdit}>
                수정
              </Button>
            ) : (
              <>
                <Button onClick={cancelEdit} disabled={isSaving || isDeleting}>
                  취소
                </Button>
                <Button variant="primary" onClick={saveEdit} disabled={isSaving || isDeleting}>
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
              </>
            )}
            <Button variant="danger" onClick={removeWriter} disabled={isSaving || isDeleting}>
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        }
      >
        {message ? <p className="helper-text writer-detail-message">{message}</p> : null}
        <div className="writer-detail-form">
          <Field label="작가명">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.name : writer.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="필명(쉼표 구분)">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.pen_names : (writer.pen_names || []).join(", ")}
              onChange={(event) => updateDraft("pen_names", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="프로필 링크">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.profile_link : writer.profile_link || ""}
              onChange={(event) => updateDraft("profile_link", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="경력">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.career_note : writer.career_note || ""}
              onChange={(event) => updateDraft("career_note", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="주요장르(쉼표 구분)">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.primary_genres : (writer.primary_genres || []).join(", ")}
              onChange={(event) => updateDraft("primary_genres", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="적합장르(쉼표 구분)">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.fit_genres : (writer.fit_genres || []).join(", ")}
              onChange={(event) => updateDraft("fit_genres", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="근무형태">
            <select
              className="ui-select"
              value={isEditing ? currentDraft.employment_type : writer.employment_type || "미지정"}
              onChange={(event) => updateDraft("employment_type", event.target.value)}
              disabled={!isEditing}
            >
              <option value="내부">내부</option>
              <option value="외주">외주</option>
              <option value="업체">업체</option>
              <option value="테스트">테스트</option>
              <option value="퇴사">퇴사</option>
            </select>
          </Field>
          <Field label="연락처">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.phone : writer.phone || ""}
              onChange={(event) => updateDraft("phone", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="이메일">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.email : writer.email || ""}
              onChange={(event) => updateDraft("email", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="계약서 링크">
            <input
              className="ui-input"
              value={isEditing ? currentDraft.contract_link : writer.contract_link || ""}
              onChange={(event) => updateDraft("contract_link", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
          <Field label="메인 작업 구분">
            <input className="ui-input" value={workTypes.join(", ")} readOnly />
          </Field>
          <Field label="총평 등급">
            <input className="ui-input" value={totalGrade} readOnly />
          </Field>
          <Field label="누적 제작비">
            <input className="ui-input" value={`${formatCurrency(productionCost.totalAmount)}원`} readOnly />
          </Field>
          <Field label="메모" className="writer-detail-wide">
            <textarea
              className="ui-textarea"
              rows={3}
              value={isEditing ? currentDraft.legacy_note : writer.legacy_note || ""}
              onChange={(event) => updateDraft("legacy_note", event.target.value)}
              readOnly={!isEditing}
            />
          </Field>
        </div>
      </Panel>

      <div className="split-panels">
        <Panel title="공정별 최신 RS">
          <div className="writer-evaluation-list">
            {latestRsRows.length === 0 && <p className="helper-text">최신 RS 데이터가 없습니다.</p>}
            {latestRsRows.map((row) => (
              <div key={row.id} className="writer-evaluation-item">
                <strong>{row.stage_name}</strong>
                <span>{row.project_title}</span>
                <small>적용 시작일: {row.effective_start_date || "-"}</small>
                <small>단가: {formatCurrency(row.unit_amount)}원</small>
                <small>최근 완료일: {row.latest_completed_at || "-"}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="현재 참여 작품/공정">
          <div className="writer-evaluation-list">
            {currentAssignments.length === 0 && <p className="helper-text">현재 진행 중인 배정이 없습니다.</p>}
            {currentAssignments.map((assignment) => (
              <div key={assignment.id} className="writer-evaluation-item">
                <strong>{assignment.project_title}</strong>
                <span>{assignment.stage_name}</span>
                <small>시작일: {assignment.started_at || "-"}</small>
                <small>비고: {assignment.note || "-"}</small>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="split-panels">
        <Panel title="최근 제출/피드백 이력">
          <div className="writer-evaluation-list">
            {recentCycles.length === 0 && <p className="helper-text">제출 이력이 없습니다.</p>}
            {recentCycles.map((cycle) => (
              <div key={cycle.id} className="writer-evaluation-item">
                <strong>
                  {cycle.project_title} · {cycle.stage_name}
                </strong>
                <span>{cycle.scope_label || "-"}</span>
                <small>제출일: {cycle.submitted_at || "-"}</small>
                <small>수정 기한: {cycle.revision_due_at || "-"}</small>
                <small>상태: {cycle.is_approved ? "확인" : cycle.task_status_label}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="평가 이력">
          <div className="writer-evaluation-list">
            {evaluations.length === 0 && <p className="helper-text">평가 이력이 없습니다.</p>}
            {evaluations.map((report) => (
              <div key={report.id} className="writer-evaluation-item">
                <strong>
                  {report.week_start} ~ {report.week_end} · {report.project_title}
                </strong>
                <span>
                  작업 {report.quality_grade || "-"} / 마감 {report.deadline_grade || "-"} / 소통{" "}
                  {report.communication_grade || "-"}
                </span>
                <small>작업 메모: {report.quality_note || "-"}</small>
                <small>마감 메모: {report.deadline_note || "-"}</small>
                <small>소통 메모: {report.communication_note || "-"}</small>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="작업 상세 이력">
        <div className="writer-task-list">
          {tasks.length === 0 && <p className="helper-text">작업 이력이 없습니다.</p>}
          {tasks.map((task) => (
            <div key={task.id} className="writer-task-item">
              <strong>
                {task.project_title} · {task.title}
              </strong>
              <span>
                {task.episode_no ? `${task.episode_no}화 · ` : ""}
                {task.type || "-"} · {getLabelStatus(task.status)}
              </span>
              <small>
                예정 {task.ps || "-"} ~ {task.pe || "-"} / 실행 {task.cs || "-"} ~ {task.ce || "-"}
              </small>
              <small>범위: {task.scope_label || "-"}</small>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
