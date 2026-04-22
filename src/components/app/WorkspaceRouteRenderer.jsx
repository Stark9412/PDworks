import { Suspense, lazy } from "react";
import RouteFallback from "./RouteFallback.jsx";

const HomeDashboard = lazy(() => import("../home/HomeDashboard.jsx"));
const ProjectDirectoryPage = lazy(() => import("../workspace/ProjectDirectoryPage.jsx"));
const WorkspaceRoute = lazy(() => import("../workspace/WorkspaceRoute.jsx"));
const ProductionDbPage = lazy(() => import("../production-db/ProductionDbPage.jsx"));
const TeamManagementPage = lazy(() => import("../team/TeamManagementPage.jsx"));
const WeeklyReviewPage = lazy(() => import("../review/WeeklyReviewPage.jsx"));
const WriterDbPage = lazy(() => import("../writer/WriterDbPage.jsx"));
const WriterDetailPage = lazy(() => import("../writer/WriterDetailPage.jsx"));
const SettingsPage = lazy(() => import("../settings/SettingsPage.jsx"));

function ProjectDirectoryRoute(props) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProjectDirectoryPage {...props} />
    </Suspense>
  );
}

export default function WorkspaceRouteRenderer({
  auth,
  dbApi,
  controller,
  derived,
  actions,
  selectedProject,
  visibleProjects,
  productionDbProjects,
  openWorkspaceProject,
  runRouteTransition,
}) {
  if (controller.route === "home") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <HomeDashboard
          metrics={derived.metrics}
          quick={derived.homeQuickSteps}
          queue={derived.homeQueue}
          onQuickAction={actions.handleHomeQuickAction}
          onOpenTask={actions.openTaskFromHomeQueue}
        />
      </Suspense>
    );
  }

  if (controller.route === "workspace") {
    if (!selectedProject) {
      return (
        <ProjectDirectoryRoute
          projects={visibleProjects}
          teams={auth.teams}
          users={auth.users}
          scope="my"
          onCreateProject={actions.openProjectCreate}
          onSelectProject={openWorkspaceProject}
        />
      );
    }

    return (
      <Suspense fallback={<RouteFallback />}>
        <WorkspaceRoute
          db={dbApi.db}
          writerName={dbApi.writerName}
          patchTask={dbApi.patchTask}
          toggleVisibility={dbApi.toggleVisibility}
          reorderParticipants={dbApi.reorderParticipants}
          toggleScheduleChangeTypo={dbApi.toggleScheduleChangeTypo}
          controller={controller}
          derived={derived}
          actions={actions}
        />
      </Suspense>
    );
  }

  if (controller.route === "weekly-review") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <WeeklyReviewPage
          db={{ ...dbApi.db, projects: visibleProjects }}
          writerName={dbApi.writerName}
          currentUser={auth.currentUser}
          projectId={controller.reviewProjectId}
          setProjectId={controller.setReviewProjectId}
          upsertWeeklyReport={dbApi.upsertWeeklyReport}
          onOpenWriter={actions.openWriterDetail}
        />
      </Suspense>
    );
  }

  if (controller.route === "writer-db") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <WriterDbPage db={dbApi.db} createWriter={dbApi.createWriter} onOpenWriter={actions.openWriterDetail} />
      </Suspense>
    );
  }

  if (controller.route === "writer-detail") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <WriterDetailPage
          db={dbApi.db}
          writerId={controller.writerId}
          patchWriter={dbApi.patchWriter}
          deleteWriter={dbApi.deleteWriter}
          onBack={() => runRouteTransition(() => controller.setRoute("writer-db"))}
        />
      </Suspense>
    );
  }

  if (controller.route === "production-db") {
    if (selectedProject) {
      return (
        <Suspense fallback={<RouteFallback />}>
          <ProductionDbPage
            db={dbApi.db}
            setDb={dbApi.setDb}
            projectId={selectedProject.id}
            onBack={() => runRouteTransition(() => controller.setProjectId(null))}
            onOpenWriter={actions.openWriterDetail}
            onDeleteProject={actions.handleDeleteProject}
          />
        </Suspense>
      );
    }

    return (
      <ProjectDirectoryRoute
        projects={productionDbProjects}
        teams={auth.teams}
        users={auth.users}
        scope="all"
        title="작품 DB 리서치"
        onCreateProject={actions.openProjectCreate}
        onSelectProject={(id) => {
          runRouteTransition(() => {
            controller.setProjectId(id);
            controller.setRoute("production-db");
          });
        }}
      />
    );
  }

  if (controller.route === "team-management") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <TeamManagementPage />
      </Suspense>
    );
  }

  if (controller.route === "settings") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SettingsPage />
      </Suspense>
    );
  }

  return <RouteFallback />;
}
