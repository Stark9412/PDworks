import {
  STATUS,
  WORK_TYPE_OPTIONS,
  getLabelStatus,
  normalizeEpisodeNo,
  normalizeTaskStatus,
  normalizeWorkType,
} from "../../../data.js";
import { canEditProject } from "../../../utils/permissions.js";
import { ISO } from "../../../utils/workspace";
import { buildSerializationMap, resolveTaskSerializationDate } from "../../../utils/serialization";
import { taskErrorMessage } from "../domain/workspaceWindowCore";

function roleToTaskType(role = "", fallback = WORK_TYPE_OPTIONS[0]) {
  return normalizeWorkType(role, fallback);
}

const STATUS_OPTIONS = new Set(STATUS.map(([key]) => key));

function safeStatus(value, fallback = "planned") {
  const normalized = normalizeTaskStatus(value || fallback);
  return STATUS_OPTIONS.has(normalized) ? normalized : fallback;
}

export function createTaskActions(ctx) {
  const {
    writerName,
    currentUser,
    project,
    projectId,
    activeParticipants,
    visibleParticipants,
    focusParticipantId,
    typeOptions,
    createTask,
    patchTask,
    deleteTask,
    setTaskId,
    setTaskDrawerMode,
    setToast,
    setCreateDraft,
  } = ctx;

  const assertProjectEditable = (message = "이 작품은 조회만 가능합니다.") => {
    if (canEditProject(currentUser, project)) return true;
    setToast(message);
    return false;
  };

  const handleDeleteTask = async (id) => {
    if (!assertProjectEditable("이 작품은 작업을 삭제할 권한이 없습니다.")) return;
    const result = await deleteTask(id);
    if (!result?.ok) {
      setToast(taskErrorMessage(result, writerName));
      return;
    }
    setTaskId(null);
    setToast("작업을 삭제했습니다.");
  };

  const openTaskDrawer = (id, mode = "actual") => {
    setTaskDrawerMode(mode === "planned" ? "planned" : "actual");
    setTaskId(id);
  };

  const openTaskCreate = ({
    status = "planned",
    participantId = null,
    date = null,
    startDate = null,
    endDate = null,
    type = null,
    episodeNo = null,
    title = "",
    heading = "",
    inline = false,
    anchor = null,
  } = {}) => {
    if (!assertProjectEditable()) return;
    if (!projectId || !activeParticipants.length) {
      setToast("참여 작가를 먼저 등록하세요.");
      return;
    }

    const candidate =
      participantId ||
      focusParticipantId ||
      visibleParticipants[0]?.id ||
      activeParticipants[0]?.id ||
      "";

    const start = startDate || date || ISO(new Date());
    const end = endDate || start;
    const selectedParticipant = activeParticipants.find((item) => item.id === candidate);
    const inferredType = roleToTaskType(
      selectedParticipant?.role,
      typeOptions[0] || WORK_TYPE_OPTIONS[0]
    );
    setCreateDraft({
      heading: heading || "작업 생성",
      inline: Boolean(inline),
      anchor:
        anchor && Number.isFinite(Number(anchor.x)) && Number.isFinite(Number(anchor.y))
          ? { ...anchor, x: Number(anchor.x), y: Number(anchor.y) }
          : anchor || null,
      participant_id: candidate,
      title,
      type: normalizeWorkType(type, inferredType),
      status: safeStatus(status),
      episode_no: normalizeEpisodeNo(episodeNo),
      ps: start,
      pe: end,
      cs: null,
      ce: null,
      serialization_date: null,
      feedback_done: false,
      planned_memo: "",
      scope_label: title || "",
      approved_at: null,
    });
  };

  const submitTaskCreate = async (payload) => {
    if (!assertProjectEditable("이 작품은 작업을 생성할 권한이 없습니다.")) return;
    const participant = activeParticipants.find((item) => item.id === payload.participant_id);
    if (!participant) {
      setToast("참여 작가를 다시 선택하세요.");
      return;
    }
    const draftEpisodeNo = normalizeEpisodeNo(payload.episode_no);
    if (!draftEpisodeNo) {
      setToast("회차는 1 이상의 정수로 입력하세요.");
      return;
    }
    const expectedSerializationDate =
      payload.serialization_date ||
      resolveTaskSerializationDate(
        { episode_no: draftEpisodeNo, serialization_date: null },
        buildSerializationMap(project, draftEpisodeNo)
      );

    const result = await createTask({
      project_id: projectId,
      participant_id: participant.id,
      writer_id: participant.writer_id,
      title: payload.title,
      type: normalizeWorkType(payload.type, WORK_TYPE_OPTIONS[0]),
      episode_no: draftEpisodeNo,
      ps: payload.ps,
      pe: payload.pe,
      cs: payload.cs,
      ce: payload.ce,
      status: safeStatus(payload.status),
      feedback_done: Boolean(payload.feedback_done),
      planned_memo: payload.planned_memo || "",
      scope_label: payload.scope_label || payload.title,
      approved_at: payload.approved_at || null,
      serialization_date: expectedSerializationDate,
      is_archived: false,
    });
    if (!result?.ok) {
      setToast(taskErrorMessage(result, writerName));
      return;
    }

    setCreateDraft(null);
    setToast("작업을 생성했습니다.");
  };

  const applyTaskPatch = async (taskIdValue, patch, successMessage = "", source = "manual_edit") => {
    if (!assertProjectEditable("이 작품은 작업을 수정할 권한이 없습니다.")) return false;
    const result = await patchTask(taskIdValue, patch, { source });
    if (!result?.ok) {
      setToast(taskErrorMessage(result, writerName));
      return false;
    }
    if (successMessage) setToast(successMessage);
    return true;
  };

  const submitInlineTimelineTask = async ({
    participantId,
    start,
    end,
    mode,
    status,
    type,
    title,
    episodeNo,
  }) => {
    if (!assertProjectEditable("이 작품은 작업을 생성할 권한이 없습니다.")) return;
    const participant = activeParticipants.find((item) => item.id === participantId);
    if (!participant) {
      setToast("참여 작가를 다시 선택하세요.");
      return;
    }

    const plannedStart = start || ISO(new Date());
    const plannedEnd = end || plannedStart;
    const isActualMode = mode === "actual";
    const parsedEpisodeNo = normalizeEpisodeNo(episodeNo);
    if (!parsedEpisodeNo) {
      setToast("회차는 1 이상의 정수로 입력하세요.");
      return;
    }
    const expectedSerializationDate = resolveTaskSerializationDate(
      { episode_no: parsedEpisodeNo, serialization_date: null },
      buildSerializationMap(project, parsedEpisodeNo)
    );

    const normalizedType = normalizeWorkType(type, WORK_TYPE_OPTIONS[0]);
    const taskTitle =
      String(title || "").trim() ||
      `${parsedEpisodeNo ? `${parsedEpisodeNo}회차 ` : ""}${normalizedType} ${isActualMode ? "작업" : "예정"}`;

    const result = await createTask({
      project_id: projectId,
      participant_id: participant.id,
      writer_id: participant.writer_id,
      title: taskTitle,
      type: normalizedType,
      episode_no: parsedEpisodeNo,
      ps: plannedStart,
      pe: plannedEnd,
      cs: plannedStart,
      ce: plannedEnd,
      status: safeStatus(status || (isActualMode ? "in_progress" : "planned")),
      feedback_done: false,
      planned_memo: "",
      scope_label: taskTitle,
      serialization_date: expectedSerializationDate,
      is_archived: false,
    });
    if (!result?.ok) {
      setToast(taskErrorMessage(result, writerName));
      return;
    }

    setToast("타임라인에 작업을 생성했습니다.");
  };

  const archiveTask = (id) => {
    void applyTaskPatch(id, { is_archived: true, status: "completed" }, "최종보관으로 이동했습니다.");
  };

  const restoreTask = (id) => {
    void applyTaskPatch(
      id,
      { is_archived: false, status: "completed" },
      `${getLabelStatus("completed")} 상태로 복원했습니다.`
    );
  };

  return {
    handleDeleteTask,
    openTaskDrawer,
    openTaskCreate,
    submitTaskCreate,
    applyTaskPatch,
    submitInlineTimelineTask,
    archiveTask,
    restoreTask,
  };
}
