import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import { uid } from "../../../data.js";

const GRADES = ["A", "B", "C"];

export default function WriterEvaluationSection({ projectId, canEdit }) {
  const { db, setDb, writerName } = useWorkspaceDb();
  const [editingId, setEditingId] = useState(null);
  const [editingWriterId, setEditingWriterId] = useState(null);
  const [formData, setFormData] = useState({
    work_ability: "",
    deadline_ability: "",
    communication_ability: "",
    overall_assessment: "",
    notes: "",
  });

  // 프로젝트의 모든 작가 수집
  const writers = useMemo(() => {
    const writerIds = new Set();
    (db.tasks || []).forEach((task) => {
      if (
        task.project_id === projectId &&
        task.writer_id &&
        !task.is_archived
      ) {
        writerIds.add(task.writer_id);
      }
    });
    return Array.from(writerIds);
  }, [db.tasks, projectId]);

  const projectEvaluations = useMemo(() => {
    return (db.writer_evaluations || []).filter((e) => e.project_id === projectId);
  }, [db.writer_evaluations, projectId]);

  const handleEdit = (writerId) => {
    const evaluation = projectEvaluations.find(
      (e) => e.writer_id === writerId
    );
    if (evaluation) {
      setEditingId(evaluation.id);
      setFormData({
        work_ability: evaluation.work_ability,
        deadline_ability: evaluation.deadline_ability,
        communication_ability: evaluation.communication_ability,
        overall_assessment: evaluation.overall_assessment,
        notes: evaluation.notes,
      });
    } else {
      setFormData({
        work_ability: "",
        deadline_ability: "",
        communication_ability: "",
        overall_assessment: "",
        notes: "",
      });
    }
    setEditingWriterId(writerId);
  };

  const handleSave = () => {
    if (!editingWriterId) return;

    const existing = projectEvaluations.find(
      (e) => e.writer_id === editingWriterId
    );

    if (existing) {
      // 기존 평가 업데이트
      const updated = (db.writer_evaluations || []).map((e) =>
        e.id === editingId
          ? {
              ...e,
              work_ability: formData.work_ability,
              deadline_ability: formData.deadline_ability,
              communication_ability: formData.communication_ability,
              overall_assessment: formData.overall_assessment,
              notes: formData.notes,
              updated_at: new Date().toISOString(),
            }
          : e
      );
      setDb((prev) => ({
        ...prev,
        writer_evaluations: updated,
      }));
    } else {
      // 새 평가 추가
      const newEval = {
        id: uid("weval"),
        project_id: projectId,
        writer_id: editingWriterId,
        work_ability: formData.work_ability,
        deadline_ability: formData.deadline_ability,
        communication_ability: formData.communication_ability,
        overall_assessment: formData.overall_assessment,
        notes: formData.notes,
        evaluated_by: null,
        evaluated_at: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDb((prev) => ({
        ...prev,
        writer_evaluations: [...(prev.writer_evaluations || []), newEval],
      }));
    }

    setEditingWriterId(null);
    setFormData({
      work_ability: "",
      deadline_ability: "",
      communication_ability: "",
      overall_assessment: "",
      notes: "",
    });
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-manual">⚪ 수동 입력</span>
        {canEdit && <span className="badge badge-editable">✏️ 수정 가능</span>}
      </div>

      {writers.length === 0 ? (
        <div className="empty-section">
          <p>평가할 작가가 없습니다</p>
        </div>
      ) : (
        <div className="evaluation-list">
          {writers.map((writerId) => {
            const evaluation = projectEvaluations.find(
              (e) => e.writer_id === writerId
            );
            const isEditing = editingWriterId === writerId;

            return (
              <div
                key={writerId}
                className={`evaluation-card ${isEditing ? "editing" : ""}`}
              >
                <div className="evaluation-header">
                  <h4>{writerName(writerId)}</h4>
                  {!isEditing && canEdit && (
                    <button
                      onClick={() => handleEdit(writerId)}
                      className="btn-edit"
                    >
                      {evaluation ? "수정" : "평가"}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="evaluation-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>작업 능력</label>
                        <select
                          value={formData.work_ability}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              work_ability: e.target.value,
                            })
                          }
                        >
                          <option value="">선택</option>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>마감 능력</label>
                        <select
                          value={formData.deadline_ability}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deadline_ability: e.target.value,
                            })
                          }
                        >
                          <option value="">선택</option>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>소통 능력</label>
                        <select
                          value={formData.communication_ability}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              communication_ability: e.target.value,
                            })
                          }
                        >
                          <option value="">선택</option>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>평가 의견</label>
                      <textarea
                        value={formData.overall_assessment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            overall_assessment: e.target.value,
                          })
                        }
                        placeholder="전체 평가"
                        rows="2"
                      />
                    </div>

                    <div className="form-group">
                      <label>비고</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="추가 메모"
                        rows="2"
                      />
                    </div>

                    <div className="form-actions">
                      <button onClick={handleSave} className="btn-save">
                        저장
                      </button>
                      <button
                        onClick={() => setEditingWriterId(null)}
                        className="btn-cancel"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : evaluation ? (
                  <div className="evaluation-display">
                    <div className="grades">
                      <div className="grade-item">
                        <span className="grade-label">작업:</span>
                        <span className="grade-value">
                          {evaluation.work_ability || "-"}
                        </span>
                      </div>
                      <div className="grade-item">
                        <span className="grade-label">마감:</span>
                        <span className="grade-value">
                          {evaluation.deadline_ability || "-"}
                        </span>
                      </div>
                      <div className="grade-item">
                        <span className="grade-label">소통:</span>
                        <span className="grade-value">
                          {evaluation.communication_ability || "-"}
                        </span>
                      </div>
                    </div>

                    {evaluation.overall_assessment && (
                      <p className="evaluation-text">
                        {evaluation.overall_assessment}
                      </p>
                    )}

                    {evaluation.notes && (
                      <p className="evaluation-notes">
                        비고: {evaluation.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">평가 대기 중</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="section-note">
        <p>💡 A/B/C로 능력을 평가합니다 (A: 우수, B: 보통, C: 개선 필요)</p>
      </div>
    </div>
  );
}
