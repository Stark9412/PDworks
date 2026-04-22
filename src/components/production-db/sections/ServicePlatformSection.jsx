import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import { uid } from "../../../data.js";

const REGIONS = ["국내", "일본", "독일", "인도", "기타"];
const PLATFORMS = ["카카오페이지", "네이버웹툰", "라인만가", "WEBTOON"];
const STATUSES = ["계획", "운영", "종료"];

export default function ServicePlatformSection({ projectId, canEdit }) {
  const { db, setDb } = useWorkspaceDb();
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    region: "국내",
    platform: "",
    launch_date: "",
    status: "계획",
    notes: "",
  });

  const projectPlatforms = useMemo(() => {
    return (db.service_platforms || []).filter((p) => p.project_id === projectId);
  }, [db.service_platforms, projectId]);

  const handleEdit = (platform) => {
    setEditingId(platform.id);
    setFormData({
      region: platform.region,
      platform: platform.platform,
      launch_date: platform.launch_date,
      status: platform.status,
      notes: platform.notes,
    });
  };

  const handleAdd = () => {
    if (!formData.platform) {
      alert("플랫폼을 선택하세요");
      return;
    }

    const newPlatform = {
      id: uid("splatform"),
      project_id: projectId,
      region: formData.region,
      platform: formData.platform,
      launch_date: formData.launch_date,
      status: formData.status,
      notes: formData.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      service_platforms: [...(prev.service_platforms || []), newPlatform],
    }));
    setFormData({
      region: "국내",
      platform: "",
      launch_date: "",
      status: "계획",
      notes: "",
    });
  };

  const handleSave = () => {
    const updatedPlatforms = (db.service_platforms || []).map((p) =>
      p.id === editingId
        ? {
            ...p,
            region: formData.region,
            platform: formData.platform,
            launch_date: formData.launch_date,
            status: formData.status,
            notes: formData.notes,
            updated_at: new Date().toISOString(),
          }
        : p
    );
    setDb((prev) => ({
      ...prev,
      service_platforms: updatedPlatforms,
    }));
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setDb((prev) => ({
      ...prev,
      service_platforms: (prev.service_platforms || []).filter((p) => p.id !== id),
    }));
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-manual">⚪ 수동 입력</span>
        {canEdit && <span className="badge badge-editable">✏️ 수정 가능</span>}
      </div>

      {projectPlatforms.length === 0 ? (
        <div className="empty-section">
          <p>등록된 서비스 플랫폼이 없습니다</p>
        </div>
      ) : (
        <div className="platform-list">
          {projectPlatforms.map((platform) => (
            <div key={platform.id} className="platform-item">
              <div className="platform-info">
                <h4>{platform.platform}</h4>
                <p className="platform-meta">
                  지역: <strong>{platform.region}</strong> • 상태:{" "}
                  <strong>{platform.status}</strong>
                </p>
                {platform.launch_date && (
                  <p className="platform-date">런칭일: {platform.launch_date}</p>
                )}
                {platform.notes && (
                  <p className="platform-notes">비고: {platform.notes}</p>
                )}
              </div>
              {canEdit && (
                <div className="platform-actions">
                  <button
                    onClick={() => handleEdit(platform)}
                    className="btn-edit"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(platform.id)}
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
            {editingId ? "플랫폼 수정" : "새 플랫폼 추가"}
          </h4>

          <div className="form-grid">
            <div className="form-group">
              <label>지역</label>
              <select
                value={formData.region}
                onChange={(e) =>
                  setFormData({ ...formData, region: e.target.value })
                }
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>플랫폼</label>
              <select
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value })
                }
              >
                <option value="">선택</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>런칭일</label>
              <input
                type="date"
                value={formData.launch_date}
                onChange={(e) =>
                  setFormData({ ...formData, launch_date: e.target.value })
                }
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
          </div>

          <div className="form-group">
            <label>비고</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="추가 정보를 입력하세요"
              rows="3"
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
        <p>💡 서비스 플랫폼 정보를 관리합니다. Task와 무관하게 독립적으로 입력합니다.</p>
      </div>
    </div>
  );
}
