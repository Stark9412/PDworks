import { useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";

export default function ChangeHistorySection({ projectId }) {
  const { db, writerName } = useWorkspaceDb();

  const histories = useMemo(() => {
    return (db.change_histories || [])
      .filter((h) => h.project_id === projectId)
      .sort((a, b) => new Date(b.changed_date) - new Date(a.changed_date));
  }, [db.change_histories, projectId]);

  const getChangeLabel = (changeType, oldValue, newValue) => {
    if (changeType === "상태변경") {
      return `상태 변경: ${oldValue || "없음"} → ${newValue || "없음"}`;
    }
    if (changeType === "일정조정") {
      return `일정 조정: ${oldValue || "없음"} → ${newValue || "없음"}`;
    }
    if (changeType === "삭제") {
      return `작업 삭제`;
    }
    return `${changeType}: ${oldValue || "없음"} → ${newValue || "없음"}`;
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-auto">🔵 자동 기록</span>
        <span className="badge badge-readonly">읽기만</span>
      </div>

      {histories.length === 0 ? (
        <div className="empty-section">
          <p>변경 이력이 없습니다</p>
        </div>
      ) : (
        <div className="history-list">
          {histories.map((history) => (
            <div key={history.id} className="history-item">
              <div className="history-header">
                <span className="history-date">{history.changed_date}</span>
                <span className="history-task-id">{history.task_id}</span>
                <span className="history-type">{history.change_type}</span>
              </div>

              <div className="history-content">
                <p className="history-change">
                  {getChangeLabel(history.change_type, history.old_value, history.new_value)}
                </p>

                {history.task_type && (
                  <p className="history-meta">
                    파트: <strong>{history.task_type}</strong>
                    {history.episode_no && ` • 회차: ${history.episode_no}`}
                  </p>
                )}

                <p className="history-user">
                  변경자: <strong>{writerName(history.changed_by)}</strong>
                </p>

                {history.notes && <p className="history-notes">메모: {history.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-note">
        <p>💡 이 정보는 작업(Task) 상태 변경, 일정 조정, 삭제 시 자동으로 기록됩니다</p>
      </div>
    </div>
  );
}
