import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import { uid } from "../../../data.js";

const TYPES = ["2차창작", "이벤트", "굿즈", "연애중계", "기타"];
const STATUSES = ["계획", "진행", "완료"];

export default function DerivativePlanningSection({ projectId, canEdit }) {
  const { db, setDb } = useWorkspaceDb();
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: "",
    title: "",
    description: "",
    planned_date: "",
    status: "계획",
    assigned_to: "",
    budget: 0,
    notes: "",
  });

  const projectPlannings = useMemo(() => {
    return (db.derivative_plannings || []).filter((p) => p.project_id === projectId);
  }, [db.derivative_plannings, projectId]);

  const handleEdit = (planning) => {
    setEditingId(planning.id);
    setFormData({
      type: planning.type,
      title: planning.title,
      description: planning.description,
      planned_date: planning.planned_date,
      status: planning.status,
      assigned_to: planning.assigned_to,
      budget: planning.budget,
      notes: planning.notes,
    });
  };

  const handleAdd = () => {
    if (!formData.title || !formData.type) {
      alert("제목과 유형을 입력하세요");
      return;
    }

    const newPlanning = {
      id: uid("deriv"),
      project_id: projectId,
      type: formData.type,
      title: formData.title,
      description: formData.description,
      planned_date: formData.planned_date,
      status: formData.status,
      assigned_to: formData.assigned_to,
      budget: Number(formData.budget),
      notes: formData.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      derivative_plannings: [...(prev.derivative_plannings || []), newPlanning],
    }));
    setFormData({
      type: "",
      title: "",
      description: "",
      planned_date: "",
      status: "계획",
      assigned_to: "",
      budget: 0,
      notes: "",
    });
  };

  const handleSave = () => {
    const updatedPlannings = (db.derivative_plannings || []).map((p) =>
      p.id === editingId
        ? {
            ...p,
            type: formData.type,
            title: formData.title,
            description: formData.description,
            planned_date: formData.planned_date,
            status: formData.status,
            assigned_to: formData.assigned_to,
            budget: Number(formData.budget),
            notes: formData.notes,
            updated_at: new Date().toISOString(),
          }
        : p
    );
    setDb((prev) => ({
      ...prev,
      derivative_plannings: updatedPlannings,
    }));
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setDb((prev) => ({
      ...prev,
      derivative_plannings: (prev.derivative_plannings || []).filter((p) => p.id !== id),
    }));
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-manual">⚪ 수동 입력</span>
        {canEdit && <span className="badge badge-editable">✏️ 수정 가능</span>}
      </div>

      {projectPlannings.length === 0 ? (
        <div className="empty-section">
          <p>등록된 파생 기획이 없습니다</p>
        </div>
      ) : (
        <div className="planning-list">
          {projectPlannings.map((planning) => (
            <div key={planning.id} className="planning-item">
              <div className="planning-header">
                <h4>{planning.title}</h4>
                <span className="planning-type">{planning.type}</span>
              </div>
              <div className="planning-info">
                {planning.description && (
                  <p className="planning-desc">{planning.description}</p>
                )}
                <div className="planning-meta">
                  <span>상태: {planning.status}</span>
                  {planning.planned_date && (
                    <span>예정일: {planning.planned_date}</span>
                  )}
                  {planning.assigned_to && (
                    <span>담당자: {planning.assigned_to}</span>
                  )}
                  {planning.budget > 0 && (
                    <span>예산: {planning.budget.toLocaleString()}원</span>
                  )}
                </div>
                {planning.notes && (
                  <p className="planning-notes">비고: {planning.notes}</p>
                )}
              </div>
              {canEdit && (
                <div className="planning-actions">
                  <button
                    onClick={() => handleEdit(planning)}
                    className="btn-edit"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(planning.id)}
                    className="btn-delete"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="section-form">
          <h4 className="form-title">
            {editingId ? "파생 기획 수정" : "새 파생 기획 추가"}
          </h4>

          <div className="form-grid">
            <div className="form-group">
              <label>유형</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
              >
                <option value="">선택</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="기획 제목"
              />
            </div>

            <div className="form-group">
              <label>상태</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>예산 (원)</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    budget: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="기획 설명"
              rows="2"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>예정일</label>
              <input
                type="date"
                value={formData.planned_date}
                onChange={(e) =>
                  setFormData({ ...formData, planned_date: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>담당자</label>
              <input
                type="text"
                value={formData.assigned_to}
                onChange={(e) =>
                  setFormData({ ...formData, assigned_to: e.target.value })
                }
                placeholder="담당자명"
              />
            </div>
          </div>

          <div className="form-group">
            <label>비고</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="추가 정보"
              rows="2"
            />
          </div>

          <div className="form-actions">
            {editingId ? (
              <>
                <button onClick={handleSave} className="btn-save">
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="btn-cancel"
                >
                  취소
                </button>
              </>
            ) : (
              <button onClick={handleAdd} className="btn-add">
                추가
              </button>
            )}
          </div>
        </div>
      )}

      <div className="section-note">
        <p>💡 2차 창작, 이벤트, 굿즈 등 파생 기획을 관리합니다.</p>
      </div>
    </div>
  );
}
