import { createEmptyWorkspaceDb } from "../src/lib/supabase/workspaceStore.js";
import { normalizeDb, normalizeEpisodeNo } from "../src/data.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildProject() {
  const id = crypto.randomUUID();
  return {
    id,
    title: "Supabase QA 작품",
    team_id: crypto.randomUUID(),
    pd_id: crypto.randomUUID(),
    pd_name: "QA PD",
    genre: "판타지",
    start_date: "2026-04-01",
    end_date: "2026-12-31",
    serialization_start_date: "2026-04-07",
    serialization_start_episode: 1,
    serialization_weekdays: [2, 5],
    serialization_hiatus_ranges: [],
    episode_tracking_types: ["콘티", "선화"],
  };
}

function runSmoke() {
  const empty = createEmptyWorkspaceDb();
  assert(Array.isArray(empty.projects), "workspace state should expose project collection");
  assert(Array.isArray(empty.tasks), "workspace state should expose task collection");

  const project = buildProject();
  const writerId = crypto.randomUUID();
  const participantId = crypto.randomUUID();
  const taskId = crypto.randomUUID();

  const normalized = normalizeDb({
    ...empty,
    projects: [project],
    project_stage_defs: [
      {
        id: `${project.id}_story`,
        project_id: project.id,
        stage_code: "story",
        stage_name: "글",
        sort_order: 1,
        is_active: true,
      },
    ],
    writers: [
      {
        id: writerId,
        name: "테스트 작가",
        team_id: project.team_id,
        pen_names: ["테작"],
        email: "writer@test.local",
        phone: "01012345678",
      },
    ],
    participants: [
      {
        id: participantId,
        project_id: project.id,
        writer_id: writerId,
        team_id: project.team_id,
        role: "콘티",
        status: "active",
        started_at: "2026-04-01",
        sort_order: 1,
        hidden_from_ops: false,
      },
    ],
    tasks: [
      {
        id: taskId,
        project_id: project.id,
        participant_id: participantId,
        writer_id: writerId,
        team_id: project.team_id,
        title: "1화 콘티",
        type: "콘티",
        episode_no: 1,
        ps: "2026-04-02",
        pe: "2026-04-04",
        cs: "2026-04-02",
        ce: "2026-04-04",
        status: "in_progress",
        feedback_done: false,
      },
      {
        id: crypto.randomUUID(),
        project_id: project.id,
        participant_id: participantId,
        writer_id: writerId,
        team_id: project.team_id,
        title: "레거시 작업",
        type: "콘티",
        episode_no: "0",
        ps: "2026-04-05",
        pe: "2026-04-05",
        status: "planned",
        feedback_done: false,
      },
    ],
    weekly_reports: [
      {
        id: crypto.randomUUID(),
        week_start: "2026-04-06",
        week_end: "2026-04-10",
        project_id: project.id,
        writer_id: writerId,
        team_id: project.team_id,
        recommendation: "maintain",
        score: 3,
        weekly_note: "QA",
      },
    ],
  });

  assert(normalized.projects[0].id === project.id, "project id should survive normalization");
  assert(normalized.writers[0].id === writerId, "writer id should survive normalization");
  assert(normalized.tasks[0].id === taskId, "task id should survive normalization");
  assert(normalizeEpisodeNo("0") === null, "episode normalization should reject zero");
  assert(normalized.tasks[1].episode_no === null, "legacy zero episode should normalize to null");
  assert(
    /^[0-9a-f-]{36}$/i.test(normalized.project_stage_defs[0].id),
    "stage definition ids should be UUID-compatible for Supabase rows"
  );
  assert(
    /^[0-9a-f-]{36}$/i.test(normalized.projects[0].id),
    "workspace ids should be UUID-compatible for Supabase rows"
  );

  console.log("[SUPABASE SMOKE PASS] normalized workspace state is ready for Supabase auth and table sync");
}

runSmoke();
