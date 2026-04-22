import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  canViewProductionDb,
  canViewProject,
  canViewProjectDirectoryScope,
} from "../../utils/permissions";
import Button from "../ui/Button.jsx";
import ClickableCard from "../ui/ClickableCard.jsx";
import Panel from "../ui/Panel.jsx";

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "진행중" },
  { value: "scheduled", label: "예정" },
  { value: "ended", label: "종료" },
];

const SORT_OPTIONS = [
  { value: "updated_desc", label: "최근 업데이트" },
  { value: "title_asc", label: "이름순" },
  { value: "start_desc", label: "시작일 최신순" },
  { value: "start_asc", label: "시작일 오래된순" },
];

function detectProjectStatus(project) {
  if (!project?.end_date) return "active";
  const today = new Date().toISOString().slice(0, 10);
  if (project.start_date && project.start_date > today) return "scheduled";
  if (project.end_date < today) return "ended";
  return "active";
}

function getStatusMeta(project) {
  const status = detectProjectStatus(project);
  if (status === "scheduled") return { value: status, label: "예정", className: "is-scheduled" };
  if (status === "ended") return { value: status, label: "종료", className: "is-ended" };
  return { value: status, label: "진행중", className: "is-active" };
}

function inDateRange(project, startDate, endDate) {
  const projectStart = project?.start_date || "";
  const projectEnd = project?.end_date || projectStart || "";
  if (startDate && projectEnd && projectEnd < startDate) return false;
  if (endDate && projectStart && projectStart > endDate) return false;
  return true;
}

function formatSchedule(project) {
  return `${project?.start_date || "-"} ~ ${project?.end_date || "-"}`;
}

function getDisplayTitle(title) {
  const normalized = String(title || "(제목 없음)").trim();
  if (normalized.length <= 30) return normalized;
  return `${normalized.slice(0, 29)}…`;
}

function getSelectToneClass(value, placeholderValue = "all") {
  return value === placeholderValue ? "ui-select is-placeholder" : "ui-select";
}

export default function ProjectDirectoryPage({
  projects,
  teams,
  users,
  scope = "my",
  title,
  onSelectProject,
  onCreateProject,
}) {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [pdFilter, setPdFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [mineOnly, setMineOnly] = useState(scope === "my");
  const [sortBy, setSortBy] = useState("updated_desc");

  const pdOptions = useMemo(
    () =>
      users
        .filter((user) => user?.status === "active")
        .map((user) => ({ id: user.id, name: user.name || user.email || "미지정" })),
    [users]
  );

  const teamNameById = useMemo(
    () => new Map((teams || []).map((team) => [team.id, team.team_name || "미지정 팀"])),
    [teams]
  );

  const visibleProjects = useMemo(() => {
    if (!canViewProjectDirectoryScope(currentUser, scope)) return [];

    const base = (projects || []).filter((project) =>
      scope === "all" ? canViewProductionDb(currentUser, project) : canViewProject(currentUser, project)
    );

    return base.filter((project) => {
      const teamName = teamNameById.get(project.team_id) || "미지정 팀";

      if (mineOnly && project.pd_id !== currentUser?.id) return false;
      if (pdFilter !== "all" && project.pd_id !== pdFilter) return false;
      if (teamFilter !== "all" && (project.team_id || "") !== teamFilter) return false;
      if (statusFilter !== "all" && detectProjectStatus(project) !== statusFilter) return false;
      if (genreFilter.trim()) {
        const normalizedGenre = String(project.genre || "").toLowerCase();
        if (!normalizedGenre.includes(genreFilter.trim().toLowerCase())) return false;
      }
      if (!inDateRange(project, dateStart, dateEnd)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [project.title, project.genre, project.pd_name, teamName].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    currentUser,
    dateEnd,
    dateStart,
    genreFilter,
    mineOnly,
    pdFilter,
    projects,
    scope,
    search,
    statusFilter,
    teamFilter,
    teamNameById,
  ]);

  const sortedProjects = useMemo(() => {
    const list = [...visibleProjects];
    list.sort((a, b) => {
      if (sortBy === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""), "ko");
      if (sortBy === "start_asc") return String(a.start_date || "").localeCompare(String(b.start_date || ""));
      if (sortBy === "start_desc") return String(b.start_date || "").localeCompare(String(a.start_date || ""));
      return String(b.updated_at || b.start_date || "").localeCompare(String(a.updated_at || a.start_date || ""));
    });
    return list;
  }, [visibleProjects, sortBy]);

  const resolvedTitle = title || (scope === "all" ? "작품 DB 리서치" : "내 작품");
  const activeFilterCount = [
    search.trim(),
    pdFilter !== "all",
    teamFilter !== "all",
    statusFilter !== "all",
    genreFilter.trim(),
    dateStart,
    dateEnd,
    mineOnly,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setPdFilter("all");
    setTeamFilter("all");
    setStatusFilter("all");
    setGenreFilter("");
    setDateStart("");
    setDateEnd("");
    setMineOnly(scope === "my");
    setSortBy("updated_desc");
  };

  return (
    <section className="project-directory-page">
      <div className="project-directory-header writer-db-hero">
        <div>
          <h1>{resolvedTitle}</h1>
        </div>
        {currentUser?.status === "active" ? (
          <Button variant="primary" onClick={onCreateProject}>
            작품 등록
          </Button>
        ) : null}
      </div>

      <div className="project-directory-shell">
        <Panel className="project-directory-sidebar-shell">
          <aside className="project-directory-sidebar">
            <div className="project-filter-stack">
              <label className="project-filter-field">
                <span className="project-filter-label">검색</span>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="작품명, 장르, 담당 PD 검색"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <label className="project-filter-field">
                <span className="project-filter-label">담당 PD</span>
                <select
                  className={getSelectToneClass(pdFilter)}
                  value={pdFilter}
                  onChange={(event) => setPdFilter(event.target.value)}
                >
                  <option value="all">전체 담당 PD</option>
                  {pdOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-filter-field">
                <span className="project-filter-label">팀</span>
                <select
                  className={getSelectToneClass(teamFilter)}
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                >
                  <option value="all">전체 팀</option>
                  {(teams || []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-filter-field">
                <span className="project-filter-label">상태</span>
                <select
                  className={getSelectToneClass(statusFilter)}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-filter-field">
                <span className="project-filter-label">장르</span>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="장르 필터"
                  value={genreFilter}
                  onChange={(event) => setGenreFilter(event.target.value)}
                />
              </label>

              <div className="project-filter-inline">
                <label className="project-filter-field">
                  <span className="project-filter-label">시작일</span>
                  <input
                    type="date"
                    className="ui-input"
                    value={dateStart}
                    onChange={(event) => setDateStart(event.target.value)}
                  />
                </label>
                <label className="project-filter-field">
                  <span className="project-filter-label">종료일</span>
                  <input
                    type="date"
                    className="ui-input"
                    value={dateEnd}
                    onChange={(event) => setDateEnd(event.target.value)}
                  />
                </label>
              </div>

              <label className="project-filter-field">
                <span className="project-filter-label">정렬 기준</span>
                <select className="ui-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  {SORT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="project-directory-toggle">
              <input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
              <span>내 담당만</span>
            </label>

            <div className="writer-search-actions">
              <Button onClick={resetFilters}>초기화</Button>
              {currentUser?.status === "active" ? (
                <Button active onClick={onCreateProject}>
                  작품 등록
                </Button>
              ) : (
                <div />
              )}
            </div>
          </aside>
        </Panel>

        <div className="project-directory-content writer-db-results">
          <div className="project-directory-summary writer-result-stats">
            <div className="writer-stat-box">
              <small>작품 결과</small>
              <strong>{sortedProjects.length}</strong>
            </div>
            <div className="writer-stat-box">
              <small>전체 작품</small>
              <strong>{projects?.length || 0}</strong>
            </div>
            <div className="writer-stat-box">
              <small>적용 필터</small>
              <strong>{activeFilterCount}</strong>
            </div>
          </div>

          <div className="project-directory-list entity-card-grid">
            {sortedProjects.length === 0 ? (
              <div className="empty">조건에 맞는 작품이 없습니다.</div>
            ) : (
              sortedProjects.map((project) => {
                const statusMeta = getStatusMeta(project);
                const teamName = teamNameById.get(project.team_id) || "미지정 팀";
                const fullTitle = String(project.title || "(제목 없음)");
                const displayTitle = getDisplayTitle(project.title);

                return (
                  <ClickableCard
                    key={project.id}
                    className="project-directory-card panel"
                    title={fullTitle}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="project-directory-card-top">
                      <h3 className="project-directory-card-title">{displayTitle}</h3>
                      <div className="chip-row">
                        <span className={`chip project-status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
                        <span className="chip project-soft-chip">{project.genre || "장르 미지정"}</span>
                      </div>
                    </div>

                    <div className="project-directory-card-body">
                      <div className="project-directory-meta-grid">
                        <div>
                          <span className="project-directory-meta-label">담당 PD</span>
                          <strong>{project.pd_name || "미지정"}</strong>
                        </div>
                        <div>
                          <span className="project-directory-meta-label">팀</span>
                          <strong>{teamName}</strong>
                        </div>
                        <div>
                          <span className="project-directory-meta-label">일정</span>
                          <strong>{formatSchedule(project)}</strong>
                        </div>
                      </div>
                    </div>
                  </ClickableCard>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
