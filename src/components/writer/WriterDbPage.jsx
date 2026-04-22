import { useMemo, useState } from "react";
import { WORK_TYPE_OPTIONS } from "../../data.js";
import Panel from "../ui/Panel.jsx";
import Field from "../ui/Field.jsx";
import Button from "../ui/Button.jsx";
import ModalShell from "../ui/ModalShell.jsx";
import ClickableCard from "../ui/ClickableCard.jsx";
import {
  getCandidateLabel,
  getCandidateScore,
  getStrictMatchResult,
  getWriterRecentWork,
  getWriterTotalGrade,
  getWriterWorkTypes,
  splitCommaValues,
} from "./writerDbModel.js";

function makeWriterForm() {
  return {
    name: "",
    pen_names: "",
    profile_link: "",
    career_note: "",
    primary_genres: "",
    employment_type: "외주",
    phone: "",
    email: "",
    contract_link: "",
    fee_label: "",
    rs_ratio: "",
    fit_genres: "",
    main_work_types: [],
    legacy_note: "",
  };
}

function WorkTypeChecklist({ value, onToggle }) {
  return (
    <div className="work-type-grid">
      {WORK_TYPE_OPTIONS.map((option) => {
        const active = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`work-type-chip${active ? " active" : ""}`}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function WriterCreateModal({ open, form, setForm, onCancel, onSubmit }) {
  if (!open) return null;

  return (
    <ModalShell
      open={open}
      title="작가 등록"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>취소</Button>
          <Button active onClick={onSubmit}>
            등록
          </Button>
        </>
      }
    >
      <div className="split-2">
        <Field label="작가명">
          <input
            className="ui-input"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </Field>
        <Field label="필명(쉼표 구분)">
          <input
            className="ui-input"
            value={form.pen_names}
            onChange={(event) => setForm((prev) => ({ ...prev, pen_names: event.target.value }))}
          />
        </Field>
      </div>

      <div className="split-2">
        <Field label="프로필 링크">
          <input
            className="ui-input"
            value={form.profile_link}
            onChange={(event) => setForm((prev) => ({ ...prev, profile_link: event.target.value }))}
          />
        </Field>
        <Field label="계약서 링크">
          <input
            className="ui-input"
            value={form.contract_link}
            onChange={(event) => setForm((prev) => ({ ...prev, contract_link: event.target.value }))}
          />
        </Field>
      </div>

      <div className="split-2">
        <Field label="연락처">
          <input
            className="ui-input"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </Field>
        <Field label="이메일">
          <input
            className="ui-input"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </Field>
      </div>

      <div className="split-2">
        <Field label="근무형태">
          <select
            className="ui-select"
            value={form.employment_type}
            onChange={(event) => setForm((prev) => ({ ...prev, employment_type: event.target.value }))}
          >
            <option value="내부">내부</option>
            <option value="외주">외주</option>
            <option value="업체">업체</option>
            <option value="테스트">테스트</option>
            <option value="퇴사">퇴사</option>
          </select>
        </Field>
        <Field label="경력">
          <input
            className="ui-input"
            value={form.career_note}
            onChange={(event) => setForm((prev) => ({ ...prev, career_note: event.target.value }))}
          />
        </Field>
      </div>

      <div className="split-2">
        <Field label="주요장르(쉼표 구분)">
          <input
            className="ui-input"
            value={form.primary_genres}
            onChange={(event) => setForm((prev) => ({ ...prev, primary_genres: event.target.value }))}
          />
        </Field>
        <Field label="적합장르(쉼표 구분)">
          <input
            className="ui-input"
            value={form.fit_genres}
            onChange={(event) => setForm((prev) => ({ ...prev, fit_genres: event.target.value }))}
          />
        </Field>
      </div>

      <div className="split-2">
        <Field label="작업 구분">
          <WorkTypeChecklist
            value={form.main_work_types}
            onToggle={(option) =>
              setForm((prev) => ({
                ...prev,
                main_work_types: prev.main_work_types.includes(option)
                  ? prev.main_work_types.filter((item) => item !== option)
                  : [...prev.main_work_types, option],
              }))
            }
          />
        </Field>
        <Field label="고료 / RS">
          <div className="split-2 compact-row">
            <input
              className="ui-input"
              placeholder="고료"
              value={form.fee_label}
              onChange={(event) => setForm((prev) => ({ ...prev, fee_label: event.target.value }))}
            />
            <input
              className="ui-input"
              placeholder="RS"
              value={form.rs_ratio}
              onChange={(event) => setForm((prev) => ({ ...prev, rs_ratio: event.target.value }))}
            />
          </div>
        </Field>
      </div>

      <Field label="메모">
        <textarea
          className="ui-textarea"
          rows={3}
          value={form.legacy_note}
          onChange={(event) => setForm((prev) => ({ ...prev, legacy_note: event.target.value }))}
        />
      </Field>
    </ModalShell>
  );
}

function WriterCard({ row, onOpenWriter, candidate = false }) {
  const penNames = Array.isArray(row.writer.pen_names) ? row.writer.pen_names.filter(Boolean) : [];

  return (
    <ClickableCard
      className={`writer-summary-card${candidate ? " candidate" : ""}`}
      onClick={() => onOpenWriter(row.writer.id)}
      title={row.writer.name}
    >
      <div className="writer-summary-top">
        <div className="writer-summary-title">
          <strong>{row.writer.name}</strong>
          <span>{penNames.join(", ") || "필명 없음"}</span>
        </div>
        {candidate ? (
          <span className="candidate-chip">후보 {row.candidateScore}</span>
        ) : (
          <span className={`grade-chip grade-${row.totalGrade}`}>총평 {row.totalGrade}</span>
        )}
      </div>

      <div className="writer-summary-grid">
        <div className="writer-meta-box">
          <small>이메일</small>
          <strong>{row.writer.email || "-"}</strong>
        </div>
        <div className="writer-meta-box">
          <small>연락처</small>
          <strong>{row.writer.phone || "-"}</strong>
        </div>
        <div className="writer-meta-box">
          <small>작업 구분</small>
          <strong>{row.workTypes.join(", ") || "-"}</strong>
        </div>
        <div className="writer-meta-box">
          <small>최근 작업 기간</small>
          <strong>{row.recent.label}</strong>
        </div>
      </div>

      <div className="writer-card-footer">
        <div className="chip-row">
          {(row.workTypes.length ? row.workTypes : ["미분류"]).slice(0, 4).map((item) => (
            <span key={`${row.writer.id}-${item}`} className="chip tone-blue">
              {item}
            </span>
          ))}
        </div>
        {candidate ? (
          <p className="writer-match-copy">일치 필드: {row.candidateLabel || "-"}</p>
        ) : (
          <p className="writer-match-copy">근무형태: {row.writer.employment_type || "-"}</p>
        )}
      </div>
    </ClickableCard>
  );
}

function getSelectToneClass(value) {
  return value === "" ? "ui-select is-placeholder" : "ui-select";
}

export default function WriterDbPage({ db, createWriter, onOpenWriter }) {
  const [filters, setFilters] = useState({
    name: "",
    pen_name: "",
    email: "",
    phone: "",
    work_type: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(makeWriterForm);

  const rows = useMemo(() => {
    const source = db.writers.map((writer) => {
      const workTypes = getWriterWorkTypes(db, writer.id);
      const recent = getWriterRecentWork(db, writer.id);
      const totalGrade = getWriterTotalGrade(db, writer);
      const strict = getStrictMatchResult(db, writer, filters, "and");
      const candidate = getCandidateScore(db, writer, filters);

      return {
        writer,
        workTypes,
        recent,
        totalGrade,
        strict,
        candidateScore: candidate.score,
        candidateLabel: getCandidateLabel(candidate.matched),
      };
    });

    const strictRows = source
      .filter((row) => row.strict)
      .sort(
        (a, b) =>
          String(b.recent.sortValue || "").localeCompare(String(a.recent.sortValue || "")) ||
          String(a.writer.name || "").localeCompare(String(b.writer.name || ""), "ko")
      );

    const strictIds = new Set(strictRows.map((row) => row.writer.id));
    const candidateRows = source
      .filter((row) => !strictIds.has(row.writer.id) && row.candidateScore > 0)
      .sort(
        (a, b) =>
          b.candidateScore - a.candidateScore ||
          String(b.recent.sortValue || "").localeCompare(String(a.recent.sortValue || "")) ||
          String(a.writer.name || "").localeCompare(String(b.writer.name || ""), "ko")
      );

    return { strictRows, candidateRows };
  }, [db, filters]);

  const activeFilterCount = Object.values(filters).filter((value) => String(value || "").trim()).length;
  const hasActiveFilters = activeFilterCount > 0;

  const submitCreate = () => {
    const created = createWriter({
      name: createForm.name.trim(),
      pen_names: splitCommaValues(createForm.pen_names),
      profile_link: createForm.profile_link.trim(),
      career_note: createForm.career_note.trim(),
      primary_genres: splitCommaValues(createForm.primary_genres),
      employment_type: createForm.employment_type,
      phone: createForm.phone.trim(),
      email: createForm.email.trim(),
      contract_link: createForm.contract_link.trim(),
      fee_label: createForm.fee_label.trim(),
      rs_ratio: createForm.rs_ratio === "" ? null : createForm.rs_ratio,
      fit_genres: splitCommaValues(createForm.fit_genres),
      main_work_types: createForm.main_work_types,
      legacy_note: createForm.legacy_note.trim(),
    });

    if (!created?.ok) return;

    setCreateOpen(false);
    setCreateForm(makeWriterForm());
    onOpenWriter(created.writer.id);
  };

  return (
    <section className="writer-page writer-db-page">
      <div className="writer-db-hero">
        <div>
          <h2>작가 DB 리서치</h2>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          작가 추가
        </Button>
      </div>

      <div className="writer-db-shell">
        <Panel className="writer-db-sidebar">
          <aside className="writer-search-panel writer-search-panel-compact">
            <Field label="이름">
              <input
                className="ui-input"
                placeholder="작가명"
                value={filters.name}
                onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Field>
            <Field label="필명">
              <input
                className="ui-input"
                placeholder="필명"
                value={filters.pen_name}
                onChange={(event) => setFilters((prev) => ({ ...prev, pen_name: event.target.value }))}
              />
            </Field>
            <Field label="이메일">
              <input
                className="ui-input"
                placeholder="sample@company.com"
                value={filters.email}
                onChange={(event) => setFilters((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Field>
            <Field label="전화번호">
              <input
                className="ui-input"
                placeholder="010-0000-0000"
                value={filters.phone}
                onChange={(event) => setFilters((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </Field>
            <Field label="작업 구분">
              <select
                className={getSelectToneClass(filters.work_type)}
                value={filters.work_type}
                onChange={(event) => setFilters((prev) => ({ ...prev, work_type: event.target.value }))}
              >
                <option value="">전체 작업 구분</option>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <div className="writer-search-actions">
              <Button onClick={() => setFilters({ name: "", pen_name: "", email: "", phone: "", work_type: "" })}>
                초기화
              </Button>
              <Button active onClick={() => setCreateOpen(true)}>
                작가 추가
              </Button>
            </div>
          </aside>
        </Panel>

        <div className="writer-db-results">
          <div className="writer-result-stats">
            <div className="writer-stat-box">
              <small>{hasActiveFilters ? "정확 결과" : "전체 작가"}</small>
              <strong>{hasActiveFilters ? rows.strictRows.length : db.writers.length}</strong>
            </div>
            <div className="writer-stat-box">
              <small>{hasActiveFilters ? "후보 결과" : "필터 적용"}</small>
              <strong>{hasActiveFilters ? rows.candidateRows.length : activeFilterCount}</strong>
            </div>
            <div className="writer-stat-box">
              <small>활성 필터</small>
              <strong>{activeFilterCount}</strong>
            </div>
            <div className="writer-stat-box">
              <small>전체 작가</small>
              <strong>{db.writers.length}</strong>
            </div>
          </div>

          {!hasActiveFilters ? (
            <section className="writer-result-section writer-result-section-all">
              <div className="writer-card-list writer-card-grid entity-card-grid">
                {db.writers.length === 0 ? <p className="helper-text">등록된 작가가 없습니다.</p> : null}
                {db.writers.map((writer) => {
                  const row = {
                    writer,
                    workTypes: getWriterWorkTypes(db, writer.id),
                    recent: getWriterRecentWork(db, writer.id),
                    totalGrade: getWriterTotalGrade(db, writer),
                  };
                  return <WriterCard key={writer.id} row={row} onOpenWriter={onOpenWriter} />;
                })}
              </div>
            </section>
          ) : (
            <>
              <section className="writer-result-section writer-result-section-primary">
                <div className="writer-result-head">
                  <h3>결과</h3>
                  <span className="chip tone-blue">{rows.strictRows.length}명</span>
                </div>
                <div className="writer-card-list writer-card-grid entity-card-grid">
                  {rows.strictRows.length === 0 ? <p className="helper-text">일치하는 결과가 없습니다.</p> : null}
                  {rows.strictRows.map((row) => (
                    <WriterCard key={row.writer.id} row={row} onOpenWriter={onOpenWriter} />
                  ))}
                </div>
              </section>

              <section className="writer-result-section writer-result-section-candidate">
                <div className="writer-result-head">
                  <h3>후보</h3>
                  <span className="chip tone-yellow">{rows.candidateRows.length}명</span>
                </div>
                <div className="writer-card-list writer-card-grid entity-card-grid">
                  {rows.candidateRows.length === 0 ? <p className="helper-text">검토할 후보가 없습니다.</p> : null}
                  {rows.candidateRows.map((row) => (
                    <WriterCard key={row.writer.id} row={row} onOpenWriter={onOpenWriter} candidate />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <WriterCreateModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        onCancel={() => {
          setCreateOpen(false);
          setCreateForm(makeWriterForm());
        }}
        onSubmit={submitCreate}
      />
    </section>
  );
}
