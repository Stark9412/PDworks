import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import { uid } from "../../../data.js";

export default function PDEvaluationSection({ projectId, canEdit }) {
  const { db, setDb } = useWorkspaceDb();
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    positive_assessment: "",
    negative_assessment: "",
    notes: "",
  });

  const projectEvaluations = useMemo(() => {
    return (db.pd_evaluations || []).filter((e) => e.project_id === projectId);
  }, [db.pd_evaluations, projectId]);

  const project = useMemo(
    () => db.projects?.find((p) => p.id === projectId),
    [db.projects, projectId]
  );

  const handleEdit = () => {
    const evaluation = projectEvaluations[0];
    if (evaluation) {
      setEditingId(evaluation.id);
      setFormData({
        positive_assessment: evaluation.positive_assessment,
        negative_assessment: evaluation.negative_assessment,
        notes: evaluation.notes,
      });
    } else {
      setFormData({
        positive_assessment: "",
        negative_assessment: "",
        notes: "",
      });
      setEditingId(null);
    }
  };

  const handleSave = () => {
    const existing = projectEvaluations[0];

    if (existing) {
      // 기존 평가 업데이트
      const updated = (db.pd_evaluations || []).map((e) =>
        e.id === editingId
          ? {
              ...e,
              positive_assessment: formData.positive_assessment,
              negative_assessment: formData.negative_assessment,
              notes: formData.notes,
              updated_at: new Date().toISOString(),
            }
          : e
      );
      setDb((prev) => ({
        ...prev,
        pd_evaluations: updated,
      }));
    } else {
      // 새 평가 추가
      const newEval = {
        id: uid("pdeval"),
        project_id: projectId,
        positive_assessment: formData.positive_assessment,
        negative_assessment: formData.negative_assessment,
        notes: formData.notes,
        evaluated_at: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDb((prev) => ({
        ...prev,
        pd_evaluations: [...(prev.pd_evaluations || []), newEval],
      }));
    }

    setEditingId(null);
    setFormData({
      positive_assessment: "",
      negative_assessment: "",
      notes: "",
    });
  };

  const evaluation = projectEvaluations[0];
  const isEditing = editingId !== null;

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-manual">⚪ 수동 입력</span>
        {canEdit && <span className="badge badge-editable">✏️ 수정 가능</span>}
      </div>

      {!isEditing && evaluation ? (
        <div className="evaluation-display">
          <div className="evaluation-card">
            <div className="evaluation-header">
              <h4>프로젝트 PD 평가</h4>
              {canEdit && (
                <button onClick={handleEdit} className="btn-edit">
                  수정
                </button>
              )}
            </div>

            <div className="evaluation-content">
              {evaluation.positive_assessment && (
                <div className="assessment-block">
                  <h5>긍정적 평가</h5>
                  <p>{evaluation.positive_assessment}</p>
                </div>
              )}

              {evaluation.negative_assessment && (
                <div className="assessment-block">
                  <h5>부정적 평가</h5>
                  <p>{evaluation.negative_assessment}</p>
                </div>
              )}

              {evaluation.notes && (
                <div className="assessment-block">
                  <h5>비고</h5>
                  <p>{evaluation.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isEditing || canEdit ? (
        <div className="evaluation-form">
          <h4>{evaluation ? "PD 평가 수정" : "PD 평가 입력"}</h4>

          <div className="form-group">
            <label>긍정적 평가</label>
            <textarea
              value={formData.positive_assessment}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  positive_assessment: e.target.value,
                })
              }
              placeholder="PD의 긍정적 평가를 입력하세요"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>부정적 평가</label>
            <textarea
              value={formData.negative_assessment}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  negative_assessment: e.target.value,
                })
              }
              placeholder="PD의 부정적 평가를 입력하세요"
              rows="3"
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
              onClick={() => {
                setEditingId(null);
                setFormData({
                  positive_assessment: "",
                  negative_assessment: "",
                  notes: "",
                });
              }}
              className="btn-cancel"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-section">
          <p>평가가 등록되지 않았습니다</p>
        </div>
      )}

      <div className="section-note">
        <p>💡 프로젝트 PD의 전체 평가를 기록합니다</p>
      </div>
    </div>
  );
}
