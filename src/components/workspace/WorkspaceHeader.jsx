import Button from "../ui/Button.jsx";

export default function WorkspaceHeader({
  projectTitle,
  mode,
  setMode,
}) {
  const hasProject = Boolean(projectTitle);

  return (
    <div className="workspace-head-row">
      <div className="workspace-head-meta">
        <h3>{projectTitle || "작품 선택 필요"}</h3>
        <p>상단은 현재 화면 실행, 좌측은 이동/선택 전용</p>
      </div>

      <div className="mode-switch" role="tablist" aria-label="workspace modes">
        <Button size="sm" active={mode === "timeline"} onClick={() => setMode("timeline")}>타임라인</Button>
        <Button size="sm" active={mode === "month"} onClick={() => setMode("month")}>캘린더</Button>
        <Button size="sm" active={mode === "kanban"} onClick={() => setMode("kanban")}>칸반</Button>
        <Button size="sm" active={mode === "episode"} onClick={() => setMode("episode")}>회차 트래킹</Button>
      </div>
    </div>
  );
}
