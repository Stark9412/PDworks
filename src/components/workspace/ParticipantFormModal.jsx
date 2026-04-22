import { useEffect, useMemo, useState } from "react";
import { WORK_TYPE_OPTIONS, normalizeEmploymentType, todayIso } from "../../data";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import ModalShell from "../ui/ModalShell.jsx";
import { getWriterWorkTypes } from "../writer/writerDbModel.js";

const REQUIRED_NEW_WRITER_FIELDS = ["이름", "필명", "전화번호", "역할", "근무형태"];

function normalizeSelectedRoles(draft) {
  if (Array.isArray(draft?.roles)) {
    return [...new Set(draft.roles.filter((item) => WORK_TYPE_OPTIONS.includes(item)))];
  }
  if (draft?.role && WORK_TYPE_OPTIONS.includes(draft.role)) {
    return [draft.role];
  }
  return [];
}

function makeInitialForm(draft, writers) {
  const selectedRoles = normalizeSelectedRoles(draft);

  return {
    participant_id: draft?.participant_id || null,
    project_id: draft?.project_id || "",
    mode: draft?.mode || "existing",
    writer_id: draft?.writer_id || writers[0]?.id || "",
    role: selectedRoles[0] || "",
    roles: selectedRoles,
    started_at: draft?.started_at || todayIso(),
    fee_label: draft?.fee_label ?? "",
    rs_ratio: draft?.rs_ratio ?? "",
    writer_name: draft?.writer_name || "",
    writer_pen_names: draft?.writer_pen_names || "",
    writer_phone: draft?.writer_phone || "",
    writer_email: draft?.writer_email || "",
    writer_employment_type: normalizeEmploymentType(draft?.writer_employment_type, "외주"),
    writer_profile_link: draft?.writer_profile_link || "",
    writer_contract_link: draft?.writer_contract_link || "",
    writer_career_note: draft?.writer_career_note || "",
    writer_primary_genres: draft?.writer_primary_genres || "",
    writer_fit_genres: draft?.writer_fit_genres || "",
    writer_legacy_note: draft?.writer_legacy_note || "",
    existing_search_name: "",
    existing_search_pen_name: "",
    existing_search_email: "",
    existing_search_phone: "",
    existing_search_work_type: "",
  };
}

function matchesWriter(db, writer, form) {
  const filters = {
    name: form.existing_search_name,
    pen_name: form.existing_search_pen_name,
    email: form.existing_search_email,
    phone: form.existing_search_phone,
  };

  const workTypes = getWriterWorkTypes(db, writer.id);
  const fields = {
    name: String(writer.name || "").toLowerCase(),
    pen_name: (writer.pen_names || []).join(" ").toLowerCase(),
    email: String(writer.email || "").toLowerCase(),
    phone: String(writer.phone || "").toLowerCase(),
  };

  const matchesText = Object.entries(filters).every(([key, value]) => {
    const query = String(value || "").trim().toLowerCase();
    if (!query) return true;
    return fields[key].includes(query);
  });

  if (!matchesText) return false;
  if (!form.existing_search_work_type) return true;
  return workTypes.includes(form.existing_search_work_type);
}

function WorkTypeSelect({ value, onChange, placeholder = "선택" }) {
  return (
    <select className="ui-select" value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {WORK_TYPE_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function WorkTypeButtonGroup({ values, single, onToggle }) {
  return (
    <div className="work-type-grid" role="group" aria-label={single ? "역할 선택" : "역할 다중 선택"}>
      {WORK_TYPE_OPTIONS.map((option) => {
        const active = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`work-type-chip${active ? " active" : ""}`}
            aria-pressed={active}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function normalizeWorkTypeCandidates(workTypes) {
  return Array.isArray(workTypes)
    ? workTypes.filter((item) => WORK_TYPE_OPTIONS.includes(item))
    : [];
}

export default function ParticipantFormModal({
  open,
  draft,
  db,
  writers,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => makeInitialForm(draft, writers));

  useEffect(() => {
    if (!open) return;
    setForm(makeInitialForm(draft, writers));
  }, [open, draft, writers]);

  const existingProjectRolesByWriter = useMemo(() => {
    const map = new Map();
    (db?.participants || [])
      .filter((participant) => participant.project_id === form.project_id && participant.status === "active")
      .forEach((participant) => {
        if (participant.id === form.participant_id) return;
        const list = map.get(participant.writer_id) || [];
        list.push(participant.role);
        map.set(participant.writer_id, [...new Set(list)]);
      });
    return map;
  }, [db?.participants, form.participant_id, form.project_id]);

  const filteredOptions = useMemo(
    () =>
      writers
        .filter((writer) => matchesWriter(db, writer, form))
        .map((writer) => {
          const workTypes = normalizeWorkTypeCandidates(getWriterWorkTypes(db, writer.id));
          return {
            id: writer.id,
            name: writer.name || "",
            label: `${writer.name}${writer.pen_names?.length ? ` (${writer.pen_names.join(", ")})` : ""}`,
            penNames: writer.pen_names || [],
            email: writer.email || "",
            phone: writer.phone || "",
            employmentType: normalizeEmploymentType(writer.employment_type, "미정"),
            workTypes,
            projectRoles: existingProjectRolesByWriter.get(writer.id) || [],
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [db, existingProjectRolesByWriter, form, writers]
  );

  useEffect(() => {
    if (form.mode !== "existing") return;
    if (!filteredOptions.length) return;
    const exists = filteredOptions.some((item) => item.id === form.writer_id);
    if (exists) return;
    setForm((prev) => ({ ...prev, writer_id: filteredOptions[0].id }));
  }, [filteredOptions, form.mode, form.writer_id]);

  const selectedExistingWriter = useMemo(
    () => filteredOptions.find((item) => item.id === form.writer_id) || null,
    [filteredOptions, form.writer_id]
  );

  const activeFilterCount = [
    form.existing_search_name,
    form.existing_search_pen_name,
    form.existing_search_email,
    form.existing_search_phone,
    form.existing_search_work_type,
  ].filter((value) => String(value || "").trim()).length;

  const isEditMode = Boolean(form.participant_id);
  const isNewWriterMode = form.mode === "new_writer" && !isEditMode;
  const title = isEditMode ? "참여 작가 수정" : "참여 작가 등록";
  const submitLabel = isEditMode ? "수정" : "등록";
  const selectedRoles = form.roles || [];
  const canSubmit =
    form.mode === "existing"
      ? Boolean(form.writer_id && form.started_at && selectedRoles.length > 0)
      : Boolean(
          form.writer_name.trim() &&
            form.writer_pen_names.trim() &&
            form.writer_phone.trim() &&
            selectedRoles.length > 0 &&
            form.writer_employment_type &&
            form.started_at
        );

  function updateRoles(nextRoles) {
    setForm((prev) => ({
      ...prev,
      roles: nextRoles,
      role: nextRoles[0] || "",
    }));
  }

  function toggleRole(role) {
    if (!WORK_TYPE_OPTIONS.includes(role)) return;

    if (isEditMode) {
      updateRoles(selectedRoles[0] === role ? [] : [role]);
      return;
    }

    if (selectedRoles.includes(role)) {
      updateRoles(selectedRoles.filter((item) => item !== role));
      return;
    }
    updateRoles([...selectedRoles, role]);
  }

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onCancel}
      className="participant-form-modal-shell"
      footer={
        <>
          <Button onClick={onCancel}>취소</Button>
          <Button
            active
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onSubmit({
                participant_id: form.participant_id,
                mode: form.mode,
                writer_id: form.mode === "existing" ? form.writer_id : "",
                writer_name: form.writer_name.trim(),
                writer_pen_names: form.writer_pen_names,
                writer_phone: form.writer_phone.trim(),
                writer_email: form.writer_email.trim(),
                writer_employment_type: normalizeEmploymentType(form.writer_employment_type, "미정"),
                writer_profile_link: form.writer_profile_link.trim(),
                writer_contract_link: form.writer_contract_link.trim(),
                writer_career_note: form.writer_career_note.trim(),
                writer_primary_genres: form.writer_primary_genres,
                writer_fit_genres: form.writer_fit_genres,
                writer_legacy_note: form.writer_legacy_note.trim(),
                fee_label: form.fee_label,
                rs_ratio: form.rs_ratio,
                role: selectedRoles[0] || "",
                roles: selectedRoles,
                started_at: form.started_at || todayIso(),
              });
            }}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      {!isEditMode && (
        <div className="split-2">
          <Button
            active={form.mode === "existing"}
            onClick={() => setForm((prev) => ({ ...prev, mode: "existing" }))}
          >
            기존 작가 선택
          </Button>
          <Button
            active={form.mode === "new_writer"}
            onClick={() => setForm((prev) => ({ ...prev, mode: "new_writer" }))}
          >
            신규 작가 생성
          </Button>
        </div>
      )}

      {form.mode === "existing" ? (
        <>
          {!isEditMode && (
            <section className="form-block participant-filter-block">
              <div className="form-block-head participant-block-head">
                <div>
                  <h4>검색 필터</h4>
                  <p className="helper-text">
                    이름, 필명, 작업 구분으로 먼저 보고 필요한 경우 연락처로 더 좁힙니다.
                  </p>
                </div>
                <span className="participant-filter-count">필터 {activeFilterCount}개</span>
              </div>

              <div className="participant-filter-grid">
                <Field label="이름">
                  <input
                    className="ui-input"
                    value={form.existing_search_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, existing_search_name: event.target.value }))}
                  />
                </Field>
                <Field label="필명">
                  <input
                    className="ui-input"
                    value={form.existing_search_pen_name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, existing_search_pen_name: event.target.value }))
                    }
                  />
                </Field>
                <Field label="작업 구분">
                  <WorkTypeSelect
                    value={form.existing_search_work_type}
                    placeholder="전체"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, existing_search_work_type: event.target.value }))
                    }
                  />
                </Field>
                <Field label="이메일">
                  <input
                    className="ui-input"
                    value={form.existing_search_email}
                    onChange={(event) => setForm((prev) => ({ ...prev, existing_search_email: event.target.value }))}
                  />
                </Field>
                <Field label="전화번호">
                  <input
                    className="ui-input"
                    value={form.existing_search_phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, existing_search_phone: event.target.value }))}
                  />
                </Field>
                <div className="participant-filter-actions">
                  <Button
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        existing_search_name: "",
                        existing_search_pen_name: "",
                        existing_search_email: "",
                        existing_search_phone: "",
                        existing_search_work_type: "",
                      }))
                    }
                  >
                    필터 초기화
                  </Button>
                </div>
              </div>
            </section>
          )}

          <section className="form-block participant-result-block">
            <div className="form-block-head participant-block-head">
              <div>
                <h4>{isEditMode ? "참여 정보 수정" : "검색 결과"}</h4>
                <p className="helper-text">
                  {isEditMode
                    ? "선택된 참여 행 1건만 수정합니다."
                    : "역할을 여러 개 선택하면 각 역할별로 참여 행이 따로 생성됩니다."}
                </p>
              </div>
              <span className="participant-result-count">
                {isEditMode ? "수정 모드" : `${filteredOptions.length}명`}
              </span>
            </div>

            {!isEditMode && filteredOptions.length ? (
              <div className="participant-search-results" role="listbox" aria-label="기존 작가 검색 결과">
                {filteredOptions.map((item) => {
                  const active = item.id === form.writer_id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`participant-search-card${active ? " active" : ""}`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          writer_id: item.id,
                        }))
                      }
                    >
                      <div className="participant-search-card-head">
                        <strong>{item.name}</strong>
                        <span className="participant-search-badge">{item.employmentType}</span>
                      </div>
                      {item.penNames.length ? (
                        <div className="participant-search-sub">필명: {item.penNames.join(", ")}</div>
                      ) : null}
                      <div className="participant-search-sub">
                        {[item.email, item.phone].filter(Boolean).join(" / ") || "연락처 정보 없음"}
                      </div>
                      {item.projectRoles.length ? (
                        <div className="participant-search-sub">
                          이미 참여 중인 역할: {item.projectRoles.join(", ")}
                        </div>
                      ) : null}
                      {item.workTypes.length ? (
                        <div className="participant-search-tags">
                          {item.workTypes.map((workType) => (
                            <span key={`${item.id}-${workType}`} className="participant-search-tag">
                              {workType}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : !isEditMode ? (
              <div className="empty">입력한 검색 조건에 맞는 작가가 없습니다.</div>
            ) : null}

            {selectedExistingWriter ? (
              <div className="participant-selected-summary">
                <span className="participant-selected-label">선택한 작가</span>
                <strong>{selectedExistingWriter.label}</strong>
                <span>
                  {[selectedExistingWriter.email, selectedExistingWriter.phone]
                    .filter(Boolean)
                    .join(" / ") || "연락처 정보 없음"}
                </span>
                {selectedExistingWriter.projectRoles.length ? (
                  <span>이미 참여 중인 역할: {selectedExistingWriter.projectRoles.join(", ")}</span>
                ) : null}
              </div>
            ) : null}

            <div className="split-2">
              <Field label="역할" required>
                <div className="stack-sm">
                  <WorkTypeButtonGroup values={selectedRoles} single={isEditMode} onToggle={toggleRole} />
                  <div className="helper-text">
                    {isEditMode
                      ? "수정은 현재 참여 행 1건의 역할만 바꿉니다."
                      : "선택한 역할마다 별도 참여 행이 생성됩니다."}
                  </div>
                </div>
              </Field>
              <Field label="참여 시작일" required>
                <input
                  className="ui-input"
                  type="date"
                  value={form.started_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, started_at: event.target.value }))}
                />
              </Field>
            </div>

            <div className="split-2 compact-row">
              <Field label="작품별 MG">
                <input
                  className="ui-input"
                  placeholder="예: 80만원, 수정비 15만원"
                  value={form.fee_label}
                  onChange={(event) => setForm((prev) => ({ ...prev, fee_label: event.target.value }))}
                />
              </Field>
              <Field label="작품별 RS">
                <input
                  className="ui-input"
                  type="number"
                  step="0.1"
                  placeholder="예: 30"
                  value={form.rs_ratio}
                  onChange={(event) => setForm((prev) => ({ ...prev, rs_ratio: event.target.value }))}
                />
              </Field>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="form-block participant-result-block">
            <div className="form-block-head participant-block-head">
              <div>
                <h4>신규 작가 생성</h4>
                <p className="helper-text">
                  작가 DB 등록용 기본 정보를 입력합니다. 필수 항목은 {REQUIRED_NEW_WRITER_FIELDS.join(", ")}
                  입니다.
                </p>
              </div>
              <span className="participant-result-count">필수 5개</span>
            </div>

            <div className="split-2">
              <Field label="이름" required>
                <input
                  className="ui-input"
                  value={form.writer_name}
                  placeholder="예: 김지민"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_name: event.target.value }))}
                />
              </Field>
              <Field label="필명" required>
                <input
                  className="ui-input"
                  value={form.writer_pen_names}
                  placeholder="예: 지민, JM"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_pen_names: event.target.value }))}
                />
              </Field>
            </div>

            <div className="split-2">
              <Field label="전화번호" required>
                <input
                  className="ui-input"
                  value={form.writer_phone}
                  placeholder="010-0000-0000"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_phone: event.target.value }))}
                />
              </Field>
              <Field label="이메일">
                <input
                  className="ui-input"
                  value={form.writer_email}
                  placeholder="name@example.com"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_email: event.target.value }))}
                />
              </Field>
            </div>

            <div className="split-2">
              <Field label="역할" required>
                <div className="stack-sm">
                  <WorkTypeButtonGroup values={selectedRoles} single={false} onToggle={toggleRole} />
                  <div className="helper-text">선택한 역할마다 별도 참여 행이 생성됩니다.</div>
                </div>
              </Field>
              <Field label="근무형태" required>
                <select
                  className="ui-select"
                  value={form.writer_employment_type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, writer_employment_type: event.target.value }))
                  }
                >
                  <option value="내부">내부</option>
                  <option value="외주">외주</option>
                  <option value="자사">자사</option>
                  <option value="업체">업체</option>
                  <option value="프리랜서">프리랜서</option>
                  <option value="미정">미정</option>
                </select>
              </Field>
            </div>

            <div className="split-2">
              <Field label="프로필 링크">
                <input
                  className="ui-input"
                  value={form.writer_profile_link}
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_profile_link: event.target.value }))}
                />
              </Field>
              <Field label="계약 링크">
                <input
                  className="ui-input"
                  value={form.writer_contract_link}
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_contract_link: event.target.value }))}
                />
              </Field>
            </div>

            <div className="split-2">
              <Field label="경력">
                <input
                  className="ui-input"
                  value={form.writer_career_note}
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_career_note: event.target.value }))}
                />
              </Field>
              <Field label="참여 시작일" required>
                <input
                  className="ui-input"
                  type="date"
                  value={form.started_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, started_at: event.target.value }))}
                />
              </Field>
            </div>

            <div className="split-2">
              <Field label="주요 장르">
                <input
                  className="ui-input"
                  value={form.writer_primary_genres}
                  placeholder="쉼표로 구분"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_primary_genres: event.target.value }))}
                />
              </Field>
              <Field label="적합 장르">
                <input
                  className="ui-input"
                  value={form.writer_fit_genres}
                  placeholder="쉼표로 구분"
                  onChange={(event) => setForm((prev) => ({ ...prev, writer_fit_genres: event.target.value }))}
                />
              </Field>
            </div>

            <Field label="메모">
              <textarea
                className="ui-textarea"
                rows={3}
                value={form.writer_legacy_note}
                onChange={(event) => setForm((prev) => ({ ...prev, writer_legacy_note: event.target.value }))}
              />
            </Field>
          </section>

          <section className="form-block participant-filter-block">
            <div className="form-block-head participant-block-head">
              <div>
                <h4>작품별 계약 정보</h4>
                <p className="helper-text">MG/RS는 작가 기본값이 아니라 이 작품 참여 정보로 저장됩니다.</p>
              </div>
            </div>

            <div className="split-2 compact-row">
              <Field label="작품별 MG">
                <input
                  className="ui-input"
                  placeholder="예: 80만원, 수정비 15만원"
                  value={form.fee_label}
                  onChange={(event) => setForm((prev) => ({ ...prev, fee_label: event.target.value }))}
                />
              </Field>
              <Field label="작품별 RS">
                <input
                  className="ui-input"
                  type="number"
                  step="0.1"
                  placeholder="예: 30"
                  value={form.rs_ratio}
                  onChange={(event) => setForm((prev) => ({ ...prev, rs_ratio: event.target.value }))}
                />
              </Field>
            </div>
          </section>
        </>
      )}

      {isNewWriterMode && !canSubmit ? (
        <div className="helper-text">`*` 표시 항목을 모두 입력해야 등록할 수 있습니다.</div>
      ) : null}
    </ModalShell>
  );
}
