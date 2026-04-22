import { createTaskState, deleteTaskState, patchTaskState } from "../src/features/workspace/mutations/taskMutations.js";
import {
  createParticipantState,
  createProjectState,
  createWriterState,
  replaceParticipantState,
} from "../src/features/workspace/mutations/entityMutations.js";
import {
  ensureTimelineWindow,
  extendTimelineWindow,
} from "../src/features/workspace/domain/timelineWindowPolicy.js";
import {
  monthEventsForDate,
  statusLabel,
  taskTouchesRange,
} from "../src/features/workspace/domain/viewCore.js";
import { buildSerializationMap, timelineReleaseLabel } from "../src/utils/serialization.js";
import { buildDefaultProjectStageDefs } from "../src/data.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function seedDb() {
  return {
    projects: [],
    writers: [],
    participants: [],
    tasks: [],
    records: [],
    schedule_changes: [],
    weekly_reports: [],
    project_stage_defs: [],
    project_stage_assignments: [],
    rs_contract_terms: [],
    work_submission_cycles: [],
    production_cost_entries: [],
    production_costs: [],
    service_platforms: [],
    derivative_plannings: [],
    change_histories: [],
    writer_evaluations: [],
    pd_evaluations: [],
  };
}

function runSmoke() {
  let db = seedDb();

  const writerRes = createWriterState(db, {
    name: "테스트작가",
    phone: "01012341234",
    email: "smoke@test.local",
  });
  assert(writerRes.response.ok, "writer create failed");
  db = writerRes.next;
  const writerId = writerRes.response.writer.id;

  const projectRes = createProjectState(db, {
    title: "스모크 작품",
    start_date: "2026-04-01",
    end_date: "2026-12-31",
  });
  assert(projectRes.project, "project create failed");
  db = projectRes.next;
  const projectId = projectRes.project.id;
  db = {
    ...db,
    project_stage_defs: buildDefaultProjectStageDefs(projectId),
  };

  const participantRes = createParticipantState(db, {
    project_id: projectId,
    writer_id: writerId,
    role: "콘티",
    started_at: "2026-04-01",
  });
  assert(participantRes.response.ok, "participant create failed");
  db = participantRes.next;
  const participantId = participantRes.response.participant.id;

  const taskCreateRes = createTaskState(db, {
    project_id: projectId,
    participant_id: participantId,
    writer_id: writerId,
    type: "콘티",
    title: "1화 콘티",
    episode_no: 1,
    ps: "2026-04-02",
    pe: "2026-04-04",
    cs: null,
    ce: null,
    status: "not_started",
    feedback_done: false,
  });
  assert(taskCreateRes.response.ok, "task create failed");
  db = taskCreateRes.next;
  const taskId = taskCreateRes.response.task.id;

  const patchStartRes = patchTaskState(
    db,
    taskId,
    { cs: "2026-04-03", ce: "2026-04-05", status: "in_progress" },
    { source: "smoke" }
  );
  assert(patchStartRes.response.ok, "task patch failed");
  db = patchStartRes.next;
  assert(db.schedule_changes.length >= 1, "schedule change not created");

  const deleteResDb = deleteTaskState(db, taskId);
  assert(deleteResDb.tasks.length === 0, "task delete failed");
  db = deleteResDb;

  const writer2Res = createWriterState(db, {
    name: "교체작가",
    phone: "01099998888",
    email: "replace@test.local",
  });
  assert(writer2Res.response.ok, "writer2 create failed");
  db = writer2Res.next;
  const writer2Id = writer2Res.response.writer.id;

  const task2Res = createTaskState(db, {
    project_id: projectId,
    participant_id: participantId,
    writer_id: writerId,
    type: "콘티",
    title: "2화 콘티",
    episode_no: 2,
    ps: "2026-04-06",
    pe: "2026-04-08",
    cs: "2026-04-06",
    ce: "2026-04-08",
    status: "in_progress",
    feedback_done: false,
  });
  assert(task2Res.response.ok, "task2 create failed");
  db = task2Res.next;
  const task2Id = task2Res.response.task.id;

  const replaceRes = replaceParticipantState(db, {
    participantId,
    replacedAt: "2026-04-07",
    nextWriterId: writer2Id,
    reason: "스모크교체",
  });
  assert(replaceRes.response.ok, "participant replace failed");
  db = replaceRes.next;
  const replacedParticipantId = replaceRes.response.participant.id;

  const movedTask = db.tasks.find((task) => task.id === task2Id);
  assert(Boolean(movedTask), "moved task lookup failed");
  assert(
    taskTouchesRange(movedTask, "2026-04-01", "2026-04-30"),
    "cross-view range visibility guard failed"
  );
  const monthEvents = monthEventsForDate(db.tasks, "2026-04-06");
  const monthEvent = monthEvents.find((entry) => entry.task.id === task2Id);
  assert(monthEvent?.point?.kind === "actual_start", "month event mapping failed");
  assert(statusLabel("in_progress") === "진행", "status label mapping failed");

  const task3Res = createTaskState(db, {
    project_id: projectId,
    participant_id: replacedParticipantId,
    writer_id: writer2Id,
    type: "콘티",
    title: "3화 콘티",
    episode_no: 3,
    ps: "2026-04-10",
    pe: "2026-04-12",
    cs: null,
    ce: null,
    status: "not_started",
    feedback_done: false,
  });
  assert(task3Res.response.ok, "task3 create failed");
  db = task3Res.next;
  const task3Id = task3Res.response.task.id;

  const invalidRangeRes = patchTaskState(
    db,
    task3Id,
    { cs: "2026-04-15", ce: "2026-04-14" },
    { source: "smoke_invalid_range" }
  );
  assert(
    invalidRangeRes.response.reason === "invalid_actual_range",
    "invalid actual range guard failed"
  );

  const conflictCreateRes = createTaskState(db, {
    project_id: projectId,
    participant_id: replacedParticipantId,
    writer_id: writer2Id,
    type: "선화",
    title: "3화 선화",
    episode_no: 3,
    ps: null,
    pe: null,
    cs: "2026-04-07",
    ce: "2026-04-09",
    status: "in_progress",
    feedback_done: false,
  });
  assert(conflictCreateRes.response.reason === "schedule_conflict", "schedule conflict guard failed");
  assert(conflictCreateRes.response.mode === "actual", "schedule conflict mode mismatch");

  const boundedWindow = ensureTimelineWindow(
    { start: "2026-01-01", end: "2026-01-31" },
    "2026-03-15",
    { min: "2026-01-01", max: "2026-03-31" }
  );
  assert(boundedWindow.changed, "timeline ensure should extend right");
  assert(
    boundedWindow.window.start === "2026-01-01" && boundedWindow.window.end === "2026-03-31",
    "timeline ensure bounds mismatch"
  );

  const boundedExtend = extendTimelineWindow(
    { start: "2026-01-01", end: "2026-03-31" },
    "right",
    { min: "2026-01-01", max: "2026-03-31" }
  );
  assert(!boundedExtend.changed, "timeline extend should stop at max bound");

  const serializationMap = buildSerializationMap(
    {
      serialization_start_date: "2026-04-01",
      serialization_start_episode: 1,
      serialization_weekdays: [3], // 수요일
      serialization_hiatus_ranges: [{ start: "2026-04-08", end: "2026-04-08" }],
    },
    4
  );
  assert(
    serializationMap.byEpisode.get(1) === "2026-04-01",
    "serialization base episode mapping failed"
  );
  assert(
    serializationMap.byEpisode.get(2) === "2026-04-15",
    "serialization hiatus skip mapping failed"
  );
  assert(
    timelineReleaseLabel("2026-04-15", serializationMap) === "연재 2화",
    "serialization release label failed"
  );

  console.log("[SMOKE PASS] workspace mutations are operational");
}

runSmoke();
