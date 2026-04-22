import { Suspense, lazy, startTransition, useEffect, useMemo } from "react";
import { AuthProvider } from "./context/AuthContext";
import AuthGateway from "./components/AuthGateway";
import RouteFallback from "./components/app/RouteFallback.jsx";
import WorkspaceRouteRenderer from "./components/app/WorkspaceRouteRenderer.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import useAuth from "./hooks/useAuth";
import useWorkspaceDb from "./hooks/useWorkspaceDb";
import useWorkspaceController from "./features/workspace/hooks/useWorkspaceController";
import useWorkspaceDerivedData from "./features/workspace/hooks/useWorkspaceDerivedData";
import useWorkspaceActions from "./features/workspace/hooks/useWorkspaceActions";
import {
  canAssignProjectPd,
  canCreateProject,
  canViewProductionDb,
  canViewProject,
} from "./utils/permissions";

const ProjectFormModal = lazy(() => import("./components/workspace/ProjectFormModal.jsx"));

function WorkspaceApp() {
  const auth = useAuth();
  const dbApi = useWorkspaceDb();
  const { db, remoteError: workspaceRemoteError, writerName } = dbApi;
  const controller = useWorkspaceController(null);

  const visibleProjects = useMemo(
    () => (db.projects || []).filter((project) => canViewProject(auth.currentUser, project)),
    [auth.currentUser, db.projects]
  );

  const productionDbProjects = useMemo(
    () => (db.projects || []).filter((project) => canViewProductionDb(auth.currentUser, project)),
    [auth.currentUser, db.projects]
  );

  const myProjects = useMemo(
    () => visibleProjects.filter((project) => project.pd_id === auth.currentUser?.id),
    [auth.currentUser?.id, visibleProjects]
  );

  const selectedWorkspaceProject = useMemo(
    () => visibleProjects.find((item) => item.id === controller.projectId) || null,
    [visibleProjects, controller.projectId]
  );

  const selectedProductionDbProject = useMemo(
    () => productionDbProjects.find((item) => item.id === controller.projectId) || null,
    [productionDbProjects, controller.projectId]
  );

  useEffect(() => {
    const selectedProject =
      controller.route === "production-db" ? selectedProductionDbProject : selectedWorkspaceProject;
    if (!controller.projectId || selectedProject) return;
    controller.setProjectId(null);
    if (controller.route === "workspace") controller.setRoute("workspace");
    if (controller.route === "production-db") controller.setRoute("production-db");
  }, [
    controller.projectId,
    controller.route,
    controller.setProjectId,
    controller.setRoute,
    selectedProductionDbProject,
    selectedWorkspaceProject,
  ]);

  const derived = useWorkspaceDerivedData({
    db,
    projectId: selectedWorkspaceProject?.id || null,
    taskId: controller.taskId,
    cursor: controller.cursor,
    timelineWindow: controller.timelineWindow,
    setTimelineWindow: controller.setTimelineWindow,
    writerName,
  });

  const actions = useWorkspaceActions({
    db,
    writerName,
    currentUser: auth.currentUser,
    project: derived.project,
    projectId: selectedWorkspaceProject?.id || null,
    cursor: controller.cursor,
    activeParticipants: derived.activeParticipants,
    visibleParticipants: derived.visibleParticipants,
    focusParticipantId: controller.focusParticipantId,
    typeOptions: derived.typeOptions,
    participantMap: derived.participantMap,
    createTask: dbApi.createTask,
    patchTask: dbApi.patchTask,
    deleteTask: dbApi.deleteTask,
    createProject: dbApi.createProject,
    patchProject: dbApi.patchProject,
    deleteProject: dbApi.deleteProject,
    createParticipant: dbApi.createParticipant,
    createWriter: dbApi.createWriter,
    endParticipant: dbApi.endParticipant,
    replaceParticipant: dbApi.replaceParticipant,
    projectDraft: controller.projectDraft,
    setTaskId: controller.setTaskId,
    setTaskDrawerMode: controller.setTaskDrawerMode,
    setWriterId: controller.setWriterId,
    setRoute: controller.setRoute,
    setProjectDraft: controller.setProjectDraft,
    setProjectId: controller.setProjectId,
    setMode: controller.setMode,
    setParticipantTab: controller.setParticipantTab,
    setToast: controller.setToast,
    setParticipantDraft: controller.setParticipantDraft,
    setFocusParticipantId: controller.setFocusParticipantId,
    setParticipantEndDraft: controller.setParticipantEndDraft,
    setParticipantReplaceDraft: controller.setParticipantReplaceDraft,
    setCreateDraft: controller.setCreateDraft,
    setDragParticipantId: controller.setDragParticipantId,
  });

  const runRouteTransition = (callback) => {
    startTransition(() => {
      callback();
    });
  };

  const openWorkspaceProject = (id) => {
    runRouteTransition(() => {
      controller.setProjectId(id);
      controller.setRoute("workspace");
      controller.setFocusParticipantId(null);
      controller.setParticipantTab("active");
      controller.setMode("timeline");
    });
  };

  const handleSidebarRouteChange = (nextRoute) => {
    runRouteTransition(() => {
      if (nextRoute !== "workspace") {
        controller.setProjectId(null);
      }

      if (nextRoute !== "writer-detail") {
        controller.setWriterId(null);
      }

      controller.setRoute(nextRoute);
    });
  };

  const showProjectCreatePanel = Boolean(controller.projectDraft && !controller.projectDraft.id);
  const canCreateProjects = canCreateProject(auth.currentUser);

  return (
    <div className="app">
        <Sidebar
        route={controller.route}
        setRoute={handleSidebarRouteChange}
        myProjects={myProjects}
        allProjects={visibleProjects}
        projectId={controller.projectId}
        onSelectProject={openWorkspaceProject}
        onCreateProject={canCreateProjects ? actions.openProjectCreate : undefined}
        currentUser={auth.currentUser}
        teams={auth.teams}
        onLogout={auth.logout}
      />

      <main className="main">
        {workspaceRemoteError ? (
          <div className="workspace-sync-banner">
            <strong>Supabase sync issue</strong>
            <span>{workspaceRemoteError}</span>
          </div>
        ) : null}
        {showProjectCreatePanel ? (
          <div className="main-project-create">
            <Suspense fallback={<RouteFallback />}>
              <ProjectFormModal
                open
                draft={controller.projectDraft}
                currentUser={auth.currentUser}
                users={auth.users}
                canAssignPd={canAssignProjectPd(auth.currentUser)}
                onCancel={() => controller.setProjectDraft(null)}
                onSubmit={actions.submitProjectForm}
              />
            </Suspense>
          </div>
        ) : null}
        <WorkspaceRouteRenderer
          auth={auth}
          dbApi={dbApi}
          controller={controller}
          derived={derived}
          actions={actions}
          selectedProject={
            controller.route === "production-db" ? selectedProductionDbProject : selectedWorkspaceProject
          }
          visibleProjects={visibleProjects}
          productionDbProjects={productionDbProjects}
          openWorkspaceProject={openWorkspaceProject}
          runRouteTransition={runRouteTransition}
        />
      </main>

      {controller.toast ? <div className="toast">{controller.toast}</div> : null}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGateway>
        <WorkspaceApp />
      </AuthGateway>
    </AuthProvider>
  );
}
