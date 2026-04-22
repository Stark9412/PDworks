import { useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import { getTeamAssignmentInfo } from "../../../features/production-db/mutations/productionDbCalculations";

export default function TeamManagementSection({ projectId, teamId, canEdit }) {
  const { db, writerName } = useWorkspaceDb();

  const assignmentInfo = useMemo(() => {
    return getTeamAssignmentInfo(db, projectId, teamId);
  }, [db, projectId, teamId]);

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-auto">🔵 자동 매칭</span>
        <span className="badge badge-readonly">읽기만</span>
      </div>

      {assignmentInfo.length === 0 ? (
        <div className="empty-section">
          <p>이 프로젝트에 할당된 작업이 없습니다</p>
        </div>
      ) : (
        <table className="section-table">
          <thead>
            <tr>
              <th>파트 (작업 타입)</th>
              <th>담당자</th>
              <th>작업 개수</th>
              <th>시작일</th>
              <th>종료일</th>
            </tr>
          </thead>
          <tbody>
            {assignmentInfo.map((info) => (
              <tr key={info.type}>
                <td className="col-type">{info.type || "-"}</td>
                <td className="col-participants">
                  {info.participants.length === 0 ? (
                    <span className="text-muted">미정</span>
                  ) : (
                    <div className="participant-list">
                      {info.participants.map((pid) => (
                        <span key={pid} className="participant-tag">
                          {writerName(pid)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="col-count">{info.task_count}</td>
                <td className="col-date">{info.start_date || "-"}</td>
                <td className="col-date">{info.end_date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-note">
        <p>💡 이 정보는 프로젝트의 작업(Task)에서 자동으로 수집됩니다. 수정이 필요하면 작업 정보를 변경하세요.</p>
      </div>
    </div>
  );
}
