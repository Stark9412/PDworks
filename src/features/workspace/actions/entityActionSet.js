import { WORK_TYPE_OPTIONS } from "../../../data.js";
import { canDeleteProject, canEditProject } from "../../../utils/permissions.js";
import { ISO } from "../../../utils/workspace";

export function createEntityActions(ctx) {
  const {
    db,
    project,
    projectId,
    currentUser,
    cursor,
    visibleParticipants,
    focusParticipantId,
    participantMap,
    createProject,
    patchProject,
    deleteProject,
    createParticipant,
    patchParticipant,
    createWriter,
    endParticipant,
    replaceParticipant,
    setWriterId,
    setRoute,
    setProjectDraft,
    setProjectId,
    setMode,
    setParticipantTab,
    setToast,
    setParticipantDraft,
    setFocusParticipantId,
    setParticipantEndDraft,
    setParticipantReplaceDraft,
    setTaskDrawerMode,
    setTaskId,
  } = ctx;

  const openWriterDetail = (id) => {
    setWriterId(id);
    setRoute("writer-detail");
  };

  const openProjectCreate = () => {
    setProjectDraft({
      id: null,
      title: "",
      pd_id: currentUser?.id || "",
      pd_name: currentUser?.name || "",
      start_date: ISO(cursor),
      end_date: "",
      genre: "",
      serialization_start_date: "",
      serialization_start_episode: 1,
      serialization_weekdays: [],
      serialization_hiatus_ranges: [],
      episode_tracking_types: [...WORK_TYPE_OPTIONS],
    });
  };

  const openProjectEdit = () => {
    if (!project) {
      setToast("수정할 작품을 먼저 선택해 주세요.");
      return;
    }
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 조회만 가능합니다.");
      return;
    }
    setProjectDraft({
      id: project.id,
      title: project.title || "",
      pd_id: project.pd_id || "",
      pd_name: project.pd_name || "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      genre: project.genre || "",
      serialization_start_date: project.serialization_start_date || "",
      serialization_start_episode: Number.isFinite(Number(project.serialization_start_episode))
        ? Number(project.serialization_start_episode)
        : 1,
      serialization_weekdays: Array.isArray(project.serialization_weekdays)
        ? [...project.serialization_weekdays]
        : [],
      serialization_hiatus_ranges: Array.isArray(project.serialization_hiatus_ranges)
        ? project.serialization_hiatus_ranges.map((item) => ({ ...item }))
        : [],
      episode_tracking_types: Array.isArray(project.episode_tracking_types)
        ? [...project.episode_tracking_types]
        : [...WORK_TYPE_OPTIONS],
    });
  };

  const submitProjectForm = async (payload) => {
    if (ctx.projectDraft?.id) {
      if (!canEditProject(currentUser, project)) {
        setToast("이 작품은 수정 권한이 없습니다.");
        return;
      }
      await patchProject(ctx.projectDraft.id, payload);
      setProjectDraft(null);
      setToast("작품 정보를 수정했습니다.");
      return;
    }

    const created = await createProject(payload);
    if (!created?.ok || !created.project) {
      setToast(created?.reason === "invalid_title" ? "작품명을 입력해 주세요." : "작품을 저장하지 못했습니다.");
      return;
    }
    setProjectId(created.project.id);
    setRoute("workspace");
    setMode("timeline");
    setParticipantTab("active");
    setProjectDraft(null);
    setToast("작품을 등록했습니다.");
  };

  const handleDeleteProject = async () => {
    if (!project) {
      setToast("삭제할 작품을 먼저 선택해 주세요.");
      return;
    }
    if (!canDeleteProject(currentUser, project)) {
      setToast("이 작품은 삭제 권한이 없습니다.");
      return;
    }
    const confirmed = window.confirm(
      `작품 "${project.title}"을 삭제하시겠습니까?\n홈에서도 즉시 숨김 처리되고, 연결된 참여 작가/작업/기록도 함께 삭제 예약됩니다.\n실제 데이터는 7일 뒤 영구 삭제됩니다.`
    );
    if (!confirmed) return;

    const nextProjectId = db.projects.find((item) => item.id !== project.id)?.id || null;
    const removed = await deleteProject(project.id);
    if (!removed?.ok) {
      setToast(removed?.existed === false ? "삭제할 작품을 찾지 못했습니다." : "작품 삭제를 반영하지 못했습니다.");
      return;
    }

    setProjectId(nextProjectId);
    setFocusParticipantId(null);
    setParticipantTab("active");
    if (!nextProjectId) setRoute("workspace");
    setToast("작품 삭제를 예약했습니다. 7일 뒤 영구 삭제됩니다.");
  };

  const openParticipantCreate = () => {
    if (!projectId) {
      setToast("먼저 작품을 선택해 주세요.");
      return;
    }
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 조회만 가능합니다.");
      return;
    }
    setParticipantDraft({
      participant_id: null,
      project_id: projectId,
      mode: db.writers.length ? "existing" : "new_writer",
      writer_id: visibleParticipants[0]?.writer_id || db.writers[0]?.id || "",
      role: "",
      roles: [],
      started_at: ISO(cursor),
      fee_label: "",
      rs_ratio: "",
    });
  };

  const openParticipantEdit = (participantId) => {
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }
    const participant = participantMap.get(participantId);
    if (!participant) {
      setToast("수정할 참여 작가를 찾지 못했습니다.");
      return;
    }
    setParticipantDraft({
      participant_id: participant.id,
      project_id: participant.project_id,
      mode: "existing",
      writer_id: participant.writer_id,
      role: participant.role || "",
      roles: participant.role ? [participant.role] : [],
      started_at: participant.started_at || ISO(cursor),
      fee_label: participant.fee_label || "",
      rs_ratio: participant.rs_ratio ?? "",
    });
  };

  const submitParticipantForm = async (payload) => {
    if (!projectId) return;
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }

    const selectedRoles = Array.isArray(payload.roles)
      ? [...new Set(payload.roles.filter(Boolean))]
      : payload.role
        ? [payload.role]
        : [];

    if (!selectedRoles.length) {
      setToast("역할을 하나 이상 선택해 주세요.");
      return;
    }

    if (payload.participant_id) {
      const result = await patchParticipant(payload.participant_id, {
        role: selectedRoles[0],
        started_at: payload.started_at,
        fee_label: payload.fee_label,
        rs_ratio: payload.rs_ratio,
      });
      if (!result?.ok) {
        if (result?.reason === "duplicate_role") {
          setToast("이미 이 역할로 참여 중인 작가입니다.");
          return;
        }
        setToast("참여 작가 수정 입력값을 확인해 주세요.");
        return;
      }

      setParticipantDraft(null);
      setParticipantTab("active");
      setFocusParticipantId(payload.participant_id);
      setToast("참여 작가 정보를 수정했습니다.");
      return;
    }

    let writerId = payload.writer_id;
    if (payload.mode === "new_writer") {
      const created = await createWriter({
        name: payload.writer_name,
        pen_names: payload.writer_pen_names,
        phone: payload.writer_phone,
        email: payload.writer_email,
        employment_type: payload.writer_employment_type,
        profile_link: payload.writer_profile_link,
        career_note: payload.writer_career_note,
        primary_genres: payload.writer_primary_genres,
        fit_genres: payload.writer_fit_genres,
        contract_link: payload.writer_contract_link,
        legacy_note: payload.writer_legacy_note,
        main_work_types: selectedRoles,
      });
      if (!created?.ok) {
        if (created?.reason === "duplicate" && created.writer?.name) {
          setToast(`이미 등록된 작가입니다. ${created.writer.name}`);
          return;
        }
        setToast("신규 작가 정보를 확인해 주세요.");
        return;
      }
      writerId = created.writer.id;
    }

    const duplicateRoles = db.participants
      .filter(
        (participant) =>
          participant.project_id === projectId &&
          participant.writer_id === writerId &&
          participant.status === "active"
      )
      .map((participant) => participant.role)
      .filter((role) => selectedRoles.includes(role));

    if (duplicateRoles.length) {
      setToast(`이미 참여 중인 역할입니다: ${duplicateRoles.join(", ")}`);
      return;
    }

    const blockedRoles = selectedRoles.filter((role) => {
      const stageDef = (db.project_stage_defs || []).find(
        (item) => item.project_id === projectId && item.stage_code === role && item.is_active !== false
      );
      if (!stageDef || stageDef.allow_parallel_workers) return false;
      return (db.project_stage_assignments || []).some(
        (assignment) =>
          assignment.project_id === projectId &&
          assignment.stage_def_id === stageDef.id &&
          assignment.status === "active"
      );
    });

    if (blockedRoles.length) {
      setToast(`이미 작업 중인 참여 작가가 있어 등록할 수 없는 역할입니다: ${blockedRoles.join(", ")}`);
      return;
    }

    const createdParticipants = [];
    for (const role of selectedRoles) {
      const result = await createParticipant({
        ...payload,
        writer_id: writerId,
        project_id: projectId,
        role,
      });

      if (!result?.ok) {
        if (result?.reason === "duplicate_role") {
          setToast(`이미 이 역할로 참여 중인 작가입니다: ${role}`);
          return;
        }
        if (result?.reason === "parallel_blocked") {
          setToast(`이미 작업 중인 참여 작가가 있어 등록할 수 없습니다: ${role}`);
          return;
        }
        if (result?.reason === "invalid") {
          setToast("필수 항목을 확인해 주세요. 역할과 참여 시작일, 신규 작가 등록 시 이름·필명·전화번호·근무형태가 필요합니다.");
          return;
        }
        setToast("참여 작가 등록 입력값을 확인해 주세요.");
        return;
      }

      createdParticipants.push(result.participant);
    }

    setParticipantDraft(null);
    setParticipantTab("active");
    setFocusParticipantId(createdParticipants[createdParticipants.length - 1]?.id || null);
    setToast(
      createdParticipants.length > 1
        ? `참여 작가를 ${createdParticipants.length}개 역할로 등록했습니다.`
        : "참여 작가를 등록했습니다."
    );
  };

  const openParticipantEnd = (participantId) => {
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }
    const participant = participantMap.get(participantId);
    if (!participant) {
      setToast("종료할 참여 작가를 찾지 못했습니다.");
      return;
    }
    setParticipantEndDraft({ participant_id: participant.id, ended_at: ISO(cursor), reason: "" });
  };

  const submitParticipantEnd = async (payload) => {
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }
    const result = await endParticipant(payload.participant_id, payload.ended_at, payload.reason);
    if (!result?.ok) {
      setToast("종료 처리 입력값을 확인해 주세요.");
      return;
    }
    if (focusParticipantId === payload.participant_id) setFocusParticipantId(null);
    setParticipantEndDraft(null);
    setParticipantTab("ended");
    setToast("참여 작가 종료를 처리했습니다.");
  };

  const openParticipantReplace = (participantId) => {
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }
    const participant = participantMap.get(participantId);
    if (!participant) {
      setToast("교체할 참여 작가를 찾지 못했습니다.");
      return;
    }
    setParticipantReplaceDraft({
      participant_id: participant.id,
      replaced_at: ISO(cursor),
      next_writer_id: "",
      reason: "교체",
    });
  };

  const submitParticipantReplace = async (payload) => {
    if (!canEditProject(currentUser, project)) {
      setToast("이 작품은 참여 작가를 수정할 권한이 없습니다.");
      return;
    }
    const result = await replaceParticipant({
      participantId: payload.participant_id,
      replacedAt: payload.replaced_at,
      nextWriterId: payload.next_writer_id,
      reason: payload.reason,
    });

    if (!result?.ok) {
      if (result?.reason === "same_writer") {
        setToast("기존 작가와 다른 신규 작가를 선택해 주세요.");
        return;
      }
      if (result?.reason === "schedule_conflict") {
        setToast("교체 후 실행 일정이 충돌합니다. 일정을 조정한 뒤 다시 시도해 주세요.");
        return;
      }
      setToast("교체 처리 입력값을 확인해 주세요.");
      return;
    }

    setParticipantReplaceDraft(null);
    setParticipantTab("active");
    setFocusParticipantId(result.participant.id);
    setToast(`참여 작가를 교체했습니다. 작업 ${result.transferredCount}건이 이동되었습니다.`);
  };

  const handleHomeQuickAction = (action) => {
    if (action === "project") {
      openProjectCreate();
      return;
    }
    if (action === "participant") {
      if (projectId) {
        setRoute("workspace");
        setMode("timeline");
        openParticipantCreate();
        return;
      }
      setRoute("workspace");
      return;
    }
    if (action === "timeline") {
      setRoute("workspace");
      if (projectId) setMode("timeline");
      return;
    }
    if (action === "review") {
      setRoute("weekly-review");
    }
  };

  const openTaskFromHomeQueue = (id) => {
    const task = db.tasks.find((item) => item.id === id);
    if (!task) return;
    setProjectId(task.project_id);
    setRoute("workspace");
    setMode("timeline");
    setParticipantTab("active");
    setTaskDrawerMode(task.cs && task.ce ? "actual" : "planned");
    setTaskId(task.id);
    if (task.participant_id) setFocusParticipantId(task.participant_id);
  };

  return {
    openWriterDetail,
    openProjectCreate,
    openProjectEdit,
    submitProjectForm,
    handleDeleteProject,
    openParticipantCreate,
    openParticipantEdit,
    submitParticipantForm,
    openParticipantEnd,
    submitParticipantEnd,
    openParticipantReplace,
    submitParticipantReplace,
    handleHomeQuickAction,
    openTaskFromHomeQueue,
  };
}
