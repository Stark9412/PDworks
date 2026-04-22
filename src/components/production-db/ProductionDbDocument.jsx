import { useEffect, useMemo, useState } from "react";
import {
  createChangeHistory,
  createDerivativePlanning,
  createProductionCost,
  createServicePlatform,
} from "../../data.js";
import { buildProductionDbDocumentModel } from "../../features/production-db/productionDbDocumentModel.js";

const SERVICE_REGIONS = ["국내", "일본", "북미", "중국", "유럽", "기타"];
const SERVICE_STATUS = ["계획", "운영", "종료"];
const DERIVATIVE_STATUS = ["계획", "진행", "완료"];

function compactStatus(label) {
  return label;
}

function renderLines(lines, emptyText) {
  if (!lines?.length) return <div className="pdb-empty-inline">{emptyText}</div>;
  return (
    <div className="pdb-cell-lines">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function cloneRows(rows) {
  return rows.map((item) => ({ ...item }));
}

function buildHistoryDraft(projectId, userId) {
  const base = createChangeHistory(projectId, "manual", "계약 변경", "", "", userId || "system");
  return {
    ...base,
    changed_date: base.changed_date || new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

function buildCostDraft(projectId, category) {
  return {
    ...createProductionCost(projectId, "manual", "", 0),
    cost_category: category,
    writer_name: "",
    scope_label: "",
  };
}

function buildPeopleDraft(project, model) {
  return {
    team_label: project?.team_label || model?.people?.teamLabel || "",
    pd_name: project?.pd_name || "",
  };
}

function buildProjectInfoDraft(project) {
  return {
    genre: project?.genre || "",
    total_episodes:
      Number.isFinite(Number(project?.total_episodes)) && Number(project?.total_episodes) > 0
        ? String(Number(project.total_episodes))
        : "",
    production_mode: project?.production_mode || "",
    co_production: project?.co_production || "",
    co_production_partners: Array.isArray(project?.co_production_partners)
      ? project.co_production_partners.filter(Boolean).join(", ")
      : "",
    start_date: project?.start_date || "",
    end_date: project?.end_date || "",
    serialization_start_date: project?.serialization_start_date || "",
    serialization_end_date: project?.serialization_end_date || "",
    derivative_memo: project?.derivative_memo || "",
  };
}

function formatProjectInfoValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "-";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function normalizeCommaList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyHistoryValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function buildSectionHistories(projectId, changeType, changedBy, changes) {
  return changes.map(({ label, oldValue, newValue }) => {
    const history = createChangeHistory(
      projectId,
      "manual",
      changeType,
      stringifyHistoryValue(oldValue),
      stringifyHistoryValue(newValue),
      changedBy || "system"
    );
    return {
      ...history,
      change_type: changeType,
      notes: `${label}: ${stringifyHistoryValue(oldValue)} -> ${stringifyHistoryValue(newValue)}`,
    };
  });
}

function CostDraftRow({ item, onChange, onDelete }) {
  const total = Number(item.total_cost || Number(item.unit_price || 0) * Number(item.quantity || 0));
  return (
    <tr>
      <td>
        <input className="pdb-input" value={item.part || ""} onChange={(e) => onChange("part", e.target.value)} />
      </td>
      <td>
        <input
          className="pdb-input"
          value={item.writer_name || ""}
          onChange={(e) => onChange("writer_name", e.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          className="pdb-input"
          value={item.unit_price || 0}
          onChange={(e) => onChange("unit_price", Number(e.target.value || 0))}
        />
      </td>
      <td>
        <input
          className="pdb-input"
          value={item.scope_label || ""}
          onChange={(e) => onChange("scope_label", e.target.value)}
        />
      </td>
      <td>{total.toLocaleString("ko-KR")}</td>
      <td>
        <input className="pdb-input" value={item.notes || ""} onChange={(e) => onChange("notes", e.target.value)} />
      </td>
      <td>
        <button type="button" className="pdb-link-btn" onClick={onDelete}>
          삭제
        </button>
      </td>
    </tr>
  );
}

export default function ProductionDbDocument({
  db,
  setDb,
  project,
  onBack,
  onOpenWriter,
  currentUser,
  canEdit,
  canDelete,
  onDeleteProject,
}) {
  const model = useMemo(() => buildProductionDbDocumentModel(db, project), [db, project]);
  const [serviceDrafts, setServiceDrafts] = useState([]);
  const [derivativeDrafts, setDerivativeDrafts] = useState([]);
  const [historyDrafts, setHistoryDrafts] = useState([]);
  const [costDrafts, setCostDrafts] = useState([]);
  const [isEditingPeople, setIsEditingPeople] = useState(false);
  const [peopleDraft, setPeopleDraft] = useState(() => buildPeopleDraft(project, model));
  const [isEditingProjectInfo, setIsEditingProjectInfo] = useState(false);
  const [projectInfoDraft, setProjectInfoDraft] = useState(() => buildProjectInfoDraft(project));

  useEffect(() => setServiceDrafts(cloneRows(model.servicePlatforms)), [model.servicePlatforms]);
  useEffect(() => setDerivativeDrafts(cloneRows(model.derivativeContracts)), [model.derivativeContracts]);
  useEffect(() => setHistoryDrafts([]), [db.change_histories, project.id]);
  useEffect(
    () => setCostDrafts(cloneRows((db.production_costs || []).filter((item) => item.project_id === project.id))),
    [db.production_costs, project.id]
  );
  useEffect(() => setPeopleDraft(buildPeopleDraft(project, model)), [project, model]);
  useEffect(() => setProjectInfoDraft(buildProjectInfoDraft(project)), [project]);

  const updateDraftRow = (setter, id, field, value) =>
    setter((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value, updated_at: new Date().toISOString() } : item))
    );
  const removeDraftRow = (setter, id) => setter((prev) => prev.filter((item) => item.id !== id));
  const replaceProjectRows = (key, rows) =>
    setDb((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []).filter((item) => item.project_id !== project.id), ...rows],
    }));

  const groupedCostDrafts = useMemo(
    () => ({
      current: costDrafts.filter((item) => item.cost_category === "current"),
      ended: costDrafts.filter((item) => item.cost_category === "ended"),
      test: costDrafts.filter((item) => item.cost_category === "test"),
    }),
    [costDrafts]
  );

  const commitProjectPatch = (patch, changeType, changes, onDone) => {
    if (!changes.length) {
      onDone?.();
      return;
    }

    const nextHistories = buildSectionHistories(project.id, changeType, currentUser?.id || project.pd_id, changes);
    setDb((prev) => ({
      ...prev,
      projects: (prev.projects || []).map((item) =>
        item.id === project.id
          ? {
              ...item,
              ...patch,
              updated_at: new Date().toISOString(),
            }
          : item
      ),
      change_histories: [...(prev.change_histories || []), ...nextHistories],
    }));
    onDone?.();
  };

  const savePeopleSection = () => {
    const patch = {
      team_label: peopleDraft.team_label.trim() || null,
      pd_name: peopleDraft.pd_name.trim() || null,
    };
    const changes = [];

    if ((project.team_label || "") !== (patch.team_label || "")) {
      changes.push({ label: "소속팀", oldValue: project.team_label || model.people.teamLabel, newValue: patch.team_label });
    }
    if ((project.pd_name || "") !== (patch.pd_name || "")) {
      changes.push({ label: "담당 PD", oldValue: project.pd_name, newValue: patch.pd_name });
    }

    commitProjectPatch(patch, "인적사항 수정", changes, () => setIsEditingPeople(false));
  };

  const saveProjectInfoSection = () => {
    const patch = {
      genre: projectInfoDraft.genre.trim() || null,
      total_episodes: String(projectInfoDraft.total_episodes || "").trim()
        ? Number(projectInfoDraft.total_episodes)
        : null,
      production_mode: projectInfoDraft.production_mode.trim() || null,
      co_production: projectInfoDraft.co_production.trim() || null,
      co_production_partners: normalizeCommaList(projectInfoDraft.co_production_partners),
      start_date: projectInfoDraft.start_date || null,
      end_date: projectInfoDraft.end_date || null,
      serialization_start_date: projectInfoDraft.serialization_start_date || null,
      serialization_end_date: projectInfoDraft.serialization_end_date || null,
      derivative_memo: projectInfoDraft.derivative_memo.trim() || null,
    };
    const changes = [];
    const track = (label, before, after) => {
      if (JSON.stringify(before || null) !== JSON.stringify(after || null)) {
        changes.push({ label, oldValue: before, newValue: after });
      }
    };

    track("장르", project.genre || null, patch.genre);
    track("완결 회차", project.total_episodes || null, patch.total_episodes);
    track("제작 방식", project.production_mode || null, patch.production_mode);
    track("공동 제작", project.co_production || null, patch.co_production);
    track("공동 제작 파트너", project.co_production_partners || [], patch.co_production_partners);
    track("작품 시작일", project.start_date || null, patch.start_date);
    track("작품 종료일", project.end_date || null, patch.end_date);
    track("연재 시작일", project.serialization_start_date || null, patch.serialization_start_date);
    track("연재 종료일", project.serialization_end_date || null, patch.serialization_end_date);
    track("2차 사업 메모", project.derivative_memo || null, patch.derivative_memo);

    commitProjectPatch(patch, "작품정보 수정", changes, () => setIsEditingProjectInfo(false));
  };

  const saveCosts = () =>
    setDb((prev) => ({
      ...prev,
      production_costs: [
        ...(prev.production_costs || []).filter(
          (item) => item.project_id !== project.id || !["current", "ended", "test"].includes(item.cost_category)
        ),
        ...costDrafts.map((item) => ({
          ...item,
          total_cost: Number(item.unit_price || 0) * Number(item.quantity || 0),
        })),
      ],
    }));

  return (
    <div className="pdb-page">
      <div className="pdb-main">
        <div className="pdb-document">
          <div className="pdb-hero">
            <div>
              <p className="pdb-hero-kicker">작품 상세 DB</p>
              <h1>{project.title}</h1>
              <p className="pdb-hero-subtitle">
                작품 운영에 필요한 제작, 서비스, 비용, 평가, 변경 이력을 한 문서에서 관리합니다.
              </p>
            </div>
            <div className="pdb-hero-actions">
              {canDelete ? (
                <button type="button" className="pdb-danger-btn" onClick={onDeleteProject}>
                  작품 삭제
                </button>
              ) : null}
              <button type="button" className="pdb-back-btn" onClick={onBack}>
                목록으로
              </button>
            </div>
          </div>

          <section id="people" className="pdb-section">
            <div className="pdb-section-head pdb-section-head-split">
              <h2>1. 인적 사항</h2>
              {canEdit ? (
                <div className="pdb-inline-actions">
                  {isEditingPeople ? (
                    <>
                      <button type="button" className="pdb-action-btn" onClick={() => setPeopleDraft(buildPeopleDraft(project, model))}>
                        초기화
                      </button>
                      <button type="button" className="pdb-action-btn" onClick={() => setIsEditingPeople(false)}>
                        취소
                      </button>
                      <button type="button" className="pdb-save-btn" onClick={savePeopleSection}>
                        저장
                      </button>
                    </>
                  ) : (
                    <button type="button" className="pdb-action-btn" onClick={() => setIsEditingPeople(true)}>
                      수정
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <div className="pdb-section-body">
              {isEditingPeople ? (
                <div className="pdb-edit-grid pdb-grid-2">
                  <label className="pdb-field-editor">
                    <span>소속팀 표기</span>
                    <input
                      className="pdb-input"
                      value={peopleDraft.team_label}
                      onChange={(event) => setPeopleDraft((prev) => ({ ...prev, team_label: event.target.value }))}
                      placeholder="예: 제작 1팀"
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>담당 PD</span>
                    <input
                      className="pdb-input"
                      value={peopleDraft.pd_name}
                      onChange={(event) => setPeopleDraft((prev) => ({ ...prev, pd_name: event.target.value }))}
                      placeholder="담당 PD 이름"
                    />
                  </label>
                </div>
              ) : null}

              <div className="pdb-people-shell">
                <table className="pdb-people-table">
                  <tbody>
                    <tr>
                      <th>소속팀</th>
                      <td colSpan={model.people.columns.length}>{project.team_label || model.people.teamLabel}</td>
                    </tr>
                    <tr>
                      <th>담당자명 / 직책</th>
                      <td colSpan={model.people.columns.length}>
                        {project.pd_name || model.people.pdName} / {model.people.pdRole}
                      </td>
                    </tr>
                    <tr>
                      <th>참여 작가</th>
                      {model.people.columns.map((column) => (
                        <td key={column.role} className="pdb-people-col-head">
                          {column.label}
                        </td>
                      ))}
                    </tr>
                    {Array.from({ length: model.people.rowCount }, (_, rowIndex) => (
                      <tr key={`people_${rowIndex}`}>
                        <th>{rowIndex === 0 ? "최신" : ""}</th>
                        {model.people.columns.map((column) => {
                          const entry = column.entries[rowIndex];
                          return (
                            <td key={`${column.role}_${rowIndex}`} className="pdb-people-cell">
                              {entry ? (
                                <span className={`pdb-people-name ${entry.status !== "active" ? "is-ended" : ""}`}>
                                  {entry.name}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <th>담당 PD 변경</th>
                      <td colSpan={model.people.columns.length}>{model.people.pdHistoryLabel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="production-info" className="pdb-section">
            <div className="pdb-section-head pdb-section-head-split">
              <h2>2. 작품 정보</h2>
              {canEdit ? (
                <div className="pdb-inline-actions">
                  {isEditingProjectInfo ? (
                    <>
                      <button type="button" className="pdb-action-btn" onClick={() => setProjectInfoDraft(buildProjectInfoDraft(project))}>
                        초기화
                      </button>
                      <button type="button" className="pdb-action-btn" onClick={() => setIsEditingProjectInfo(false)}>
                        취소
                      </button>
                      <button type="button" className="pdb-save-btn" onClick={saveProjectInfoSection}>
                        저장
                      </button>
                    </>
                  ) : (
                    <button type="button" className="pdb-action-btn" onClick={() => setIsEditingProjectInfo(true)}>
                      수정
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <div className="pdb-section-body">
              {isEditingProjectInfo ? (
                <div className="pdb-edit-grid pdb-grid-2">
                  <label className="pdb-field-editor">
                    <span>장르</span>
                    <input
                      className="pdb-input"
                      value={projectInfoDraft.genre}
                      onChange={(event) => setProjectInfoDraft((prev) => ({ ...prev, genre: event.target.value }))}
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>완결 회차</span>
                    <input
                      type="number"
                      min="0"
                      className="pdb-input"
                      value={projectInfoDraft.total_episodes}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, total_episodes: event.target.value }))
                      }
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>제작 방식</span>
                    <input
                      className="pdb-input"
                      value={projectInfoDraft.production_mode}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, production_mode: event.target.value }))
                      }
                      placeholder="예: 자체 제작"
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>공동 제작 여부</span>
                    <input
                      className="pdb-input"
                      value={projectInfoDraft.co_production}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, co_production: event.target.value }))
                      }
                      placeholder="예: 있음 / 없음"
                    />
                  </label>
                  <label className="pdb-field-editor pdb-grid-span-2">
                    <span>공동 제작 파트너</span>
                    <input
                      className="pdb-input"
                      value={projectInfoDraft.co_production_partners}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, co_production_partners: event.target.value }))
                      }
                      placeholder="쉼표로 구분해서 입력"
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>작품 시작일</span>
                    <input
                      type="date"
                      className="pdb-input"
                      value={projectInfoDraft.start_date}
                      onChange={(event) => setProjectInfoDraft((prev) => ({ ...prev, start_date: event.target.value }))}
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>작품 종료일</span>
                    <input
                      type="date"
                      className="pdb-input"
                      value={projectInfoDraft.end_date}
                      onChange={(event) => setProjectInfoDraft((prev) => ({ ...prev, end_date: event.target.value }))}
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>연재 시작일</span>
                    <input
                      type="date"
                      className="pdb-input"
                      value={projectInfoDraft.serialization_start_date}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, serialization_start_date: event.target.value }))
                      }
                    />
                  </label>
                  <label className="pdb-field-editor">
                    <span>연재 종료일</span>
                    <input
                      type="date"
                      className="pdb-input"
                      value={projectInfoDraft.serialization_end_date}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, serialization_end_date: event.target.value }))
                      }
                    />
                  </label>
                  <label className="pdb-field-editor pdb-grid-span-2">
                    <span>2차 사업 메모</span>
                    <textarea
                      className="pdb-input pdb-textarea"
                      rows="4"
                      value={projectInfoDraft.derivative_memo}
                      onChange={(event) =>
                        setProjectInfoDraft((prev) => ({ ...prev, derivative_memo: event.target.value }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="pdb-grid pdb-grid-4">
                    <div className="pdb-field">
                      <span>장르</span>
                      <strong>{formatProjectInfoValue(project.genre)}</strong>
                    </div>
                    <div className="pdb-field">
                      <span>완결 회차</span>
                      <strong>{formatProjectInfoValue(project.total_episodes)}</strong>
                    </div>
                    <div className="pdb-field">
                      <span>제작 방식</span>
                      <strong>{formatProjectInfoValue(project.production_mode)}</strong>
                    </div>
                    <div className="pdb-field">
                      <span>공동 제작</span>
                      <strong>{formatProjectInfoValue(project.co_production)}</strong>
                    </div>
                  </div>
                  <div className="pdb-grid pdb-grid-2">
                    <div className="pdb-field">
                      <span>작품 제작 기간</span>
                      <strong>
                        {formatProjectInfoValue(project.start_date)} ~ {formatProjectInfoValue(project.end_date)}
                      </strong>
                    </div>
                    <div className="pdb-field">
                      <span>작품 연재 기간</span>
                      <strong>
                        {formatProjectInfoValue(project.serialization_start_date)} ~{" "}
                        {formatProjectInfoValue(project.serialization_end_date || project.end_date)}
                      </strong>
                    </div>
                  </div>
                  <div className="pdb-field">
                    <span>공동 제작 파트너</span>
                    <strong>{formatProjectInfoValue(project.co_production_partners)}</strong>
                  </div>
                  <div className="pdb-field">
                    <span>2차 사업 메모</span>
                    <strong>{formatProjectInfoValue(project.derivative_memo)}</strong>
                  </div>
                </>
              )}
            </div>
          </section>

          <section id="service" className="pdb-section">
            <div className="pdb-section-head">
              <h2>3. 작품 정보(서비스)</h2>
            </div>
            <div className="pdb-section-body">
              <div className="pdb-subsection-head">
                <h3>서비스 플랫폼</h3>
                {canEdit ? (
                  <div className="pdb-inline-actions">
                    <button
                      type="button"
                      className="pdb-action-btn"
                      onClick={() => setServiceDrafts((prev) => [...prev, createServicePlatform(project.id)])}
                    >
                      플랫폼 추가
                    </button>
                    <button type="button" className="pdb-save-btn" onClick={() => replaceProjectRows("service_platforms", serviceDrafts)}>
                      저장
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="pdb-table-shell">
                <table className="pdb-table">
                  <thead>
                    <tr>
                      <th>권역</th>
                      <th>플랫폼</th>
                      <th>론칭일</th>
                      <th>상태</th>
                      <th>비고</th>
                      {canEdit ? <th>관리</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {serviceDrafts.length ? (
                      serviceDrafts.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {canEdit ? (
                              <select
                                className="pdb-input"
                                value={item.region || "국내"}
                                onChange={(e) => updateDraftRow(setServiceDrafts, item.id, "region", e.target.value)}
                              >
                                {SERVICE_REGIONS.map((region) => (
                                  <option key={region} value={region}>
                                    {region}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              item.region || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                className="pdb-input"
                                value={item.platform_name || item.platform || ""}
                                onChange={(e) =>
                                  setServiceDrafts((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            platform_name: e.target.value,
                                            platform: e.target.value,
                                            updated_at: new Date().toISOString(),
                                          }
                                        : row
                                    )
                                  )
                                }
                              />
                            ) : (
                              item.platform_name || item.platform || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                type="date"
                                className="pdb-input"
                                value={item.launch_date || ""}
                                onChange={(e) => updateDraftRow(setServiceDrafts, item.id, "launch_date", e.target.value)}
                              />
                            ) : (
                              item.launch_date || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <select
                                className="pdb-input"
                                value={item.status || "계획"}
                                onChange={(e) => updateDraftRow(setServiceDrafts, item.id, "status", e.target.value)}
                              >
                                {SERVICE_STATUS.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              item.status || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                className="pdb-input"
                                value={item.notes || ""}
                                onChange={(e) => updateDraftRow(setServiceDrafts, item.id, "notes", e.target.value)}
                              />
                            ) : (
                              item.notes || "-"
                            )}
                          </td>
                          {canEdit ? (
                            <td>
                              <button type="button" className="pdb-link-btn" onClick={() => removeDraftRow(setServiceDrafts, item.id)}>
                                삭제
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canEdit ? 6 : 5} className="pdb-empty-cell">
                          서비스 플랫폼 정보가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="derivative-contracts" className="pdb-section">
            <div className="pdb-section-head">
              <h2>4. 파생 계약(서비스)</h2>
            </div>
            <div className="pdb-section-body">
              <div className="pdb-subsection-head">
                <h3>파생 계약</h3>
                {canEdit ? (
                  <div className="pdb-inline-actions">
                    <button
                      type="button"
                      className="pdb-action-btn"
                      onClick={() => setDerivativeDrafts((prev) => [...prev, createDerivativePlanning(project.id)])}
                    >
                      계약 추가
                    </button>
                    <button
                      type="button"
                      className="pdb-save-btn"
                      onClick={() => replaceProjectRows("derivative_plannings", derivativeDrafts)}
                    >
                      저장
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="pdb-table-shell">
                <table className="pdb-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>체결일자</th>
                      <th>업체명</th>
                      <th>계약금</th>
                      <th>현황</th>
                      <th>특이사항</th>
                      {canEdit ? <th>관리</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {derivativeDrafts.length ? (
                      derivativeDrafts.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>
                            {canEdit ? (
                              <input
                                type="date"
                                className="pdb-input"
                                value={item.planned_date || ""}
                                onChange={(e) => updateDraftRow(setDerivativeDrafts, item.id, "planned_date", e.target.value)}
                              />
                            ) : (
                              item.planned_date || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                className="pdb-input"
                                value={item.title || ""}
                                onChange={(e) => updateDraftRow(setDerivativeDrafts, item.id, "title", e.target.value)}
                              />
                            ) : (
                              item.title || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                type="number"
                                className="pdb-input"
                                value={item.budget || 0}
                                onChange={(e) => updateDraftRow(setDerivativeDrafts, item.id, "budget", Number(e.target.value || 0))}
                              />
                            ) : (
                              Number(item.budget || 0).toLocaleString("ko-KR")
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <select
                                className="pdb-input"
                                value={item.status || "계획"}
                                onChange={(e) => updateDraftRow(setDerivativeDrafts, item.id, "status", e.target.value)}
                              >
                                {DERIVATIVE_STATUS.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              item.status || "-"
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <input
                                className="pdb-input"
                                value={item.notes || item.description || ""}
                                onChange={(e) =>
                                  setDerivativeDrafts((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            notes: e.target.value,
                                            description: e.target.value,
                                            updated_at: new Date().toISOString(),
                                          }
                                        : row
                                    )
                                  )
                                }
                              />
                            ) : (
                              item.notes || item.description || "-"
                            )}
                          </td>
                          {canEdit ? (
                            <td>
                              <button
                                type="button"
                                className="pdb-link-btn"
                                onClick={() => removeDraftRow(setDerivativeDrafts, item.id)}
                              >
                                삭제
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="pdb-empty-cell">
                          파생 계약 정보가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="history" className="pdb-section">
            <div className="pdb-section-head">
              <h2>5. 히스토리(제작/서비스 공용)</h2>
            </div>
            <div className="pdb-section-body">
              <div className="pdb-subsection-head">
                <h3>계약 및 변경 이력</h3>
                {canEdit ? (
                  <div className="pdb-inline-actions">
                    <button
                      type="button"
                      className="pdb-action-btn"
                      onClick={() => setHistoryDrafts((prev) => [...prev, buildHistoryDraft(project.id, currentUser?.id)])}
                    >
                      이력 추가
                    </button>
                    <button
                      type="button"
                      className="pdb-save-btn"
                      onClick={() =>
                        setDb((prev) => ({
                          ...prev,
                          change_histories: [...(prev.change_histories || []), ...historyDrafts],
                        }))
                      }
                    >
                      저장
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="pdb-table-shell">
                <table className="pdb-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>내용</th>
                      {canEdit ? <th>관리</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {model.histories.map((item) => (
                      <tr key={item.id}>
                        <td>{item.date || "-"}</td>
                        <td>
                          <div className="pdb-cell-lines">
                            <div>{item.issue}</div>
                            {item.detail && item.detail !== "-" ? <div className="pdb-muted-line">{item.detail}</div> : null}
                          </div>
                        </td>
                        {canEdit ? <td>-</td> : null}
                      </tr>
                    ))}
                    {historyDrafts.map((item) => (
                      <tr key={`draft_${item.id}`}>
                        <td>
                          <input
                            type="date"
                            className="pdb-input"
                            value={item.changed_date || ""}
                            onChange={(e) => updateDraftRow(setHistoryDrafts, item.id, "changed_date", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="pdb-input"
                            value={item.notes || ""}
                            onChange={(e) => updateDraftRow(setHistoryDrafts, item.id, "notes", e.target.value)}
                            placeholder="예: 권현준 작가 배경 용역 계약 종료"
                          />
                        </td>
                        {canEdit ? (
                          <td>
                            <button type="button" className="pdb-link-btn" onClick={() => removeDraftRow(setHistoryDrafts, item.id)}>
                              삭제
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!model.histories.length && !historyDrafts.length ? (
                      <tr>
                        <td colSpan={canEdit ? 3 : 2} className="pdb-empty-cell">
                          히스토리가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="cost" className="pdb-section">
            <div className="pdb-section-head">
              <h2>6. 제작 비용</h2>
            </div>
            <div className="pdb-section-body">
              {[
                ["1. 현재 진행중인 작업자", model.cost.currentRows, groupedCostDrafts.current, "current", "내역 추가"],
                ["2. 계약 종료 작업자", model.cost.endedRows, groupedCostDrafts.ended, "ended", "종료 내역 추가"],
                ["3. 테스트 비용", model.cost.testRows, groupedCostDrafts.test, "test", "테스트 비용 추가"],
              ].map(([title, rows, drafts, category, addLabel]) => (
                <div key={category} className="pdb-subsection">
                  <div className="pdb-subsection-head">
                    <h3>{title}</h3>
                    {canEdit ? (
                      <div className="pdb-inline-actions">
                        <button
                          type="button"
                          className="pdb-action-btn"
                          onClick={() => setCostDrafts((prev) => [...prev, buildCostDraft(project.id, category)])}
                        >
                          {addLabel}
                        </button>
                        <button type="button" className="pdb-save-btn" onClick={saveCosts}>
                          저장
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="pdb-table-shell">
                    <table className="pdb-table">
                      <thead>
                        <tr>
                          <th>파트</th>
                          <th>작가</th>
                          <th>단가 / 회</th>
                          <th>제작 범위</th>
                          <th>합계</th>
                          <th>비고</th>
                          {canEdit ? <th>관리</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item) => (
                          <tr key={item.id}>
                            <td>{item.part}</td>
                            <td>{item.writerName}</td>
                            <td>{item.unitAmount}</td>
                            <td>{item.scopeLabel}</td>
                            <td>{item.totalAmount}</td>
                            <td>{item.note}</td>
                            {canEdit ? <td>-</td> : null}
                          </tr>
                        ))}
                        {drafts.map((item) => (
                          <CostDraftRow
                            key={item.id}
                            item={item}
                            onChange={(field, value) => updateDraftRow(setCostDrafts, item.id, field, value)}
                            onDelete={() => removeDraftRow(setCostDrafts, item.id)}
                          />
                        ))}
                        {!rows.length && !drafts.length ? (
                          <tr>
                            <td colSpan={canEdit ? 7 : 6} className="pdb-empty-cell">
                              {title} 정보가 없습니다.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div className="pdb-cost-summary">
                <div className="summary-card">
                  <span>제작비용 총합계</span>
                  <strong>{model.cost.totalAmount}</strong>
                </div>
              </div>
            </div>
          </section>

          <section id="writer-review" className="pdb-section">
            <div className="pdb-section-head">
              <h2>7. 작가 정보 및 평가</h2>
            </div>
            <div className="pdb-section-body">
              <div className="pdb-subsection-head">
                <h3>{model.writerReviewSourceLabel} 기반 작가 평가 이력</h3>
              </div>
              <div className="pdb-table-shell">
                <table className="pdb-table">
                  <thead>
                    <tr>
                      <th>파트</th>
                      <th>이름</th>
                      <th>이메일</th>
                      <th>작업능력</th>
                      <th>마감능력</th>
                      <th>소통능력</th>
                      <th>총평</th>
                      <th>평가 이력</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.writerReviewRows.length ? (
                      model.writerReviewRows.map((row) => (
                        <tr key={row.writerId}>
                          <td>{row.role}</td>
                          <td>
                            {onOpenWriter ? (
                              <button type="button" className="pdb-writer-link" onClick={() => onOpenWriter(row.writerId)}>
                                {row.name}
                              </button>
                            ) : (
                              row.name
                            )}
                          </td>
                          <td>{row.email}</td>
                          <td>{row.workAbility}</td>
                          <td>{row.deadlineAbility}</td>
                          <td>{row.communicationAbility}</td>
                          <td>{renderLines(row.summaryLines, "요약 총평이 없습니다.")}</td>
                          <td>{renderLines(row.historyLines, "평가 이력이 없습니다.")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="pdb-empty-cell">
                          연결된 작가 평가 이력이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="pd-review" className="pdb-section">
            <div className="pdb-section-head">
              <h2>8. 담당 PD 총평</h2>
            </div>
            <div className="pdb-section-body">
              <div className="pdb-review-groups">
                <div className="pdb-review-group">
                  <div className="pdb-review-group-head">
                    <h3>연재반응</h3>
                  </div>
                  <div className="pdb-field">
                    <span>긍정</span>
                    <strong>{model.pdReview.positive}</strong>
                  </div>
                  <div className="pdb-field">
                    <span>부정</span>
                    <strong>{model.pdReview.negative}</strong>
                  </div>
                </div>
                <div className="pdb-review-group">
                  <div className="pdb-review-group-head">
                    <h3>작품진행</h3>
                  </div>
                  <div className="pdb-field">
                    <span>총평 메모</span>
                    <strong>{model.pdReview.note}</strong>
                  </div>
                </div>
                <div className="pdb-review-group">
                  <div className="pdb-review-group-head">
                    <h3>작가 스택관리업무</h3>
                  </div>
                  <div className="pdb-field">
                    <span>최근 평가일</span>
                    <strong>{model.pdReview.evaluatedAt}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="pdb-nav pdb-nav-secondary">
        <div className="pdb-nav-top">
          <p className="pdb-nav-kicker">작품 운영 목차</p>
          <h2>섹션 요약</h2>
          <p className="pdb-nav-meta">섹션별 상태를 요약한 네비게이션입니다.</p>
        </div>
        <div className="pdb-nav-list">
          {model.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="pdb-nav-item">
              <span className="pdb-nav-compact">
                <span className="pdb-nav-number">{section.number}</span>
                <span className={`pdb-nav-compact-status tone-${section.tone}`}>{compactStatus(section.status)}</span>
              </span>
              <span className="pdb-nav-title">{section.title}</span>
              <span className="pdb-nav-badges">
                <span className={`badge tone-${section.tone}`}>{section.status}</span>
              </span>
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}
