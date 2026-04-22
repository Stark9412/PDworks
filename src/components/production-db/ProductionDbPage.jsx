import { useMemo } from "react";
import useAuth from "../../hooks/useAuth";
import { canDeleteProject, canEditProductionDb, canViewProductionDb } from "../../utils/permissions";
import ProductionDbDocument from "./ProductionDbDocument.jsx";
import "../../styles/production-db.css";

export default function ProductionDbPage({
  db,
  setDb,
  projectId,
  onBack,
  onOpenWriter,
  onDeleteProject,
}) {
  const { currentUser } = useAuth();

  const project = useMemo(
    () => db.projects?.find((item) => item.id === projectId) || null,
    [db.projects, projectId]
  );

  if (!project) {
    return (
      <div className="production-db-page">
        <div className="empty">작품을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const canEdit = canEditProductionDb(currentUser, project);
  const canDelete = canDeleteProject(currentUser, project);

  if (!canViewProductionDb(currentUser, project)) {
    return (
      <div className="production-db-page">
        <div className="empty">이 작품 DB를 볼 권한이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="production-db-page">
      <ProductionDbDocument
        db={db}
        setDb={setDb}
        project={project}
        onBack={onBack}
        onOpenWriter={onOpenWriter}
        currentUser={currentUser}
        canEdit={canEdit}
        canDelete={canDelete}
        onDeleteProject={onDeleteProject}
      />
    </div>
  );
}
