import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  ROLE_LABELS,
  canAccessAllProjectsDirectory,
  canAccessTeamManagement,
  canCreateProject,
} from "../../utils/permissions";
import Button from "../ui/Button.jsx";

const NAV = [
  ["home", "홈"],
  ["weekly-review", "주간 보고"],
  ["writer-db", "작가 DB"],
  ["production-db", "작품 DB"],
  ["team-management", "팀 관리"],
];

export default function Sidebar({
  route,
  setRoute,
  myProjects = [],
  allProjects = [],
  projectId,
  onSelectProject,
  onCreateProject,
  currentUser: currentUserProp,
  teams: teamsProp,
  onLogout,
}) {
  const auth = useAuth();
  const currentUser = currentUserProp || auth.currentUser;
  const teams = teamsProp || auth.teams;
  const handleLogout = onLogout || auth.logout;
  const [allOpen, setAllOpen] = useState(false);
  const [pdSearch, setPdSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const currentTeamName =
    teams.find((team) => team.id === currentUser?.primary_team_id)?.team_name || "미지정 팀";

  const canBrowseAllProjects = canAccessAllProjectsDirectory(currentUser);
  const canCreateProjects = canCreateProject(currentUser);

  const filteredAllProjects = useMemo(() => {
    if (!canBrowseAllProjects) return [];

    return allProjects.filter((project) => {
      if (teamFilter !== "all" && project.team_id !== teamFilter) return false;

      if (pdSearch.trim()) {
        const query = pdSearch.trim().toLowerCase();
        const pdName = String(project.pd_name || "").toLowerCase();
        if (!pdName.includes(query)) return false;
      }

      return true;
    });
  }, [allProjects, canBrowseAllProjects, pdSearch, teamFilter]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="handoff-badge">db_v1.1 전달본</div>
        <h1>PD Workspace</h1>
        <p>담당 작품 중심으로 일정과 문서를 관리합니다.</p>
      </div>

      <nav className="global-nav">
        {NAV.filter(([key]) => {
          if (key === "team-management") return canAccessTeamManagement(currentUser);
          return true;
        }).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`nav-btn ${route === key ? "active" : ""}`}
            onClick={() => setRoute(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="project-nav">
        <header>
          <h2>작품 작업</h2>
          {canCreateProjects ? (
            <Button size="sm" variant="primary" onClick={onCreateProject}>
              작품 등록
            </Button>
          ) : null}
        </header>

        <div className="project-list">
          {myProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-item ${project.id === projectId ? "active" : ""}`}
              onClick={() => onSelectProject?.(project.id)}
            >
              <div className="project-item-title">{project.title || "(제목 없음)"}</div>
            </button>
          ))}
          {canCreateProjects ? (
            <button type="button" className="sidebar-project-add" onClick={onCreateProject}>
              <div className="sidebar-project-add-label">+</div>
            </button>
          ) : null}
        </div>

        {!myProjects.length ? <div className="helper-text">담당 중인 작품이 아직 없습니다.</div> : null}

        {canBrowseAllProjects ? (
          <div className="sidebar-all-projects">
            <button
              type="button"
              className={`nav-btn sidebar-all-toggle ${allOpen ? "active" : ""}`}
              onClick={() => setAllOpen((prev) => !prev)}
            >
              전체 작업
            </button>
            {allOpen ? (
              <div className="sidebar-all-panel">
                <input
                  className="ui-input"
                  placeholder="담당 PD 검색"
                  value={pdSearch}
                  onChange={(event) => setPdSearch(event.target.value)}
                />
                <select
                  className="ui-select"
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                >
                  <option value="all">전체 팀</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
                <div className="project-list compact">
                  {filteredAllProjects.length ? (
                    filteredAllProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className={`project-item ${project.id === projectId ? "active" : ""}`}
                        onClick={() => onSelectProject?.(project.id)}
                      >
                        <div className="project-item-title">{project.title || "(제목 없음)"}</div>
                        <div className="project-item-meta">
                          {project.pd_name || "미지정 PD"} ·{" "}
                          {teams.find((team) => team.id === project.team_id)?.team_name || "미지정 팀"}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="helper-text">조건에 맞는 작품이 없습니다.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="sidebar-user">
        <div>
          <strong>{currentUser?.name || "사용자"}</strong>
          <p className="sidebar-user-copy">
            {ROLE_LABELS[currentUser?.role] || "권한 없음"} · {currentTeamName}
          </p>
          <p className="sidebar-user-copy">{currentUser?.email || ""}</p>
        </div>
        <div className="sidebar-user-actions">
          <Button size="sm" variant="default" onClick={() => setRoute("settings")}>
            설정
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </section>
    </aside>
  );
}
