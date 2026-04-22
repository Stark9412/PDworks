import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeDb } from "../data.js";
import useAuth from "./useAuth.js";
import {
  canUseSupabaseWorkspace,
  createEmptyWorkspaceDb,
  loadWorkspaceState,
  subscribeToWorkspaceChanges,
  syncWorkspaceDiff,
} from "../lib/supabase/workspaceStore.js";
import {
  createTaskState,
  deleteTaskState,
  patchTaskState,
  toggleScheduleChangeTypoState,
  upsertWeeklyReportState,
} from "../features/workspace/mutations/taskMutations.js";
import {
  createParticipantState,
  createProjectState,
  createWriterState,
  deleteWriterState,
  deleteProjectState,
  endParticipantState,
  patchParticipantState,
  patchProjectState,
  patchWriterState,
  reorderParticipantsState,
  replaceParticipantState,
  toggleVisibilityState,
} from "../features/workspace/mutations/entityMutations.js";
import { WAITING_TEAM_ID } from "../utils/permissions.js";

function formatWorkspaceSyncError(error, fallback) {
  const message = String(error?.message || "");
  const parallelStageMatch = message.match(/parallel stage assignment is disabled for stage ([0-9a-f-]+)/i);
  if (message.includes('row-level security policy') && message.includes('project_stage_defs')) {
    return "작품 생성 중 기본 작업 단계(stage) 자동 생성이 권한 정책에 막혔습니다. Supabase migration 적용이 필요합니다.";
  }
  if (message.includes('row-level security policy') && message.includes('projects')) {
    return "작품 생성 권한이 현재 계정 역할 또는 담당 PD 설정과 맞지 않아 저장되지 않았습니다.";
  }
  if (message.includes("tasks_episode_no_check")) {
    return "작업 동기화에 실패했습니다. 회차는 1 이상의 정수만 저장할 수 있습니다.";
  }
  if (message.includes("tasks_stage_def_id_fkey")) {
    return "작업 동기화에 실패했습니다. 작업 단계 정의(stage)가 프로젝트와 맞지 않습니다.";
  }
  if (message.includes("invalid input syntax for type uuid")) {
    return "작업 동기화에 실패했습니다. UUID 형식이 아닌 값이 작업 데이터에 포함되어 있습니다.";
  }
  if (parallelStageMatch) {
    return `동시에 여러 명을 둘 수 없는 작업 단계에 중복 배정이 남아 있어 Supabase 동기화가 실패했습니다. 단계 ID: ${parallelStageMatch[1]}`;
  }
  return message || fallback;
}

function buildRemoteDisabledError() {
  return {
    ok: false,
    reason: "remote_unavailable",
    message: "Supabase workspace is not available.",
  };
}

export default function useWorkspaceDb() {
  const { currentUser } = useAuth();
  const [db, setDbState] = useState(() => createEmptyWorkspaceDb());
  const [isRemoteHydrated, setIsRemoteHydrated] = useState(false);
  const [remoteError, setRemoteError] = useState(null);
  const dbRef = useRef(createEmptyWorkspaceDb());
  const isRefreshingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const isMutatingRef = useRef(false);
  const mutationQueueRef = useRef(Promise.resolve());

  const applyRemoteDb = useCallback((nextDb) => {
    const normalized = normalizeDb(nextDb);
    dbRef.current = normalized;
    setDbState(normalized);
    return normalized;
  }, []);

  const fetchRemoteDb = useCallback(async () => {
    if (!currentUser?.organization_id) {
      return createEmptyWorkspaceDb();
    }

    const loaded = await loadWorkspaceState({
      organizationId: currentUser.organization_id,
    });
    return normalizeDb(loaded);
  }, [currentUser?.organization_id]);

  const flushRemoteRefresh = useCallback(async () => {
    if (!currentUser?.organization_id || currentUser.status !== "active") {
      return;
    }

    if (isRefreshingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    if (isMutatingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    isRefreshingRef.current = true;

    try {
      do {
        refreshQueuedRef.current = false;
        const remoteDb = await fetchRemoteDb();
        applyRemoteDb(remoteDb);
        setRemoteError(null);
      } while (refreshQueuedRef.current && !isMutatingRef.current);
    } catch (error) {
      setRemoteError(
        formatWorkspaceSyncError(error, "Workspace data could not be refreshed from Supabase.")
      );
    } finally {
      isRefreshingRef.current = false;
    }
  }, [applyRemoteDb, currentUser?.organization_id, currentUser?.status, fetchRemoteDb]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspace() {
      if (!canUseSupabaseWorkspace()) {
        if (!cancelled) {
          const empty = createEmptyWorkspaceDb();
          dbRef.current = empty;
          setDbState(empty);
          setRemoteError(
            "Supabase workspace configuration is missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY to .env.local."
          );
          setIsRemoteHydrated(true);
        }
        return;
      }

      if (!currentUser?.organization_id || currentUser.status !== "active") {
        if (!cancelled) {
          const empty = createEmptyWorkspaceDb();
          dbRef.current = empty;
          setDbState(empty);
          setRemoteError(null);
          setIsRemoteHydrated(true);
        }
        return;
      }

      try {
        setIsRemoteHydrated(false);
        const loaded = await fetchRemoteDb();

        if (cancelled) return;

        applyRemoteDb(loaded);
        setRemoteError(null);
      } catch (error) {
        if (!cancelled) {
          setRemoteError(
            formatWorkspaceSyncError(error, "Workspace data could not be loaded from Supabase.")
          );
        }
      } finally {
        if (!cancelled) {
          setIsRemoteHydrated(true);
        }
      }
    }

    hydrateWorkspace();

    return () => {
      cancelled = true;
    };
  }, [applyRemoteDb, currentUser?.organization_id, currentUser?.status, fetchRemoteDb]);

  useEffect(() => {
    if (!isRemoteHydrated || !canUseSupabaseWorkspace()) {
      return undefined;
    }

    if (!currentUser?.organization_id || currentUser.status !== "active") {
      return undefined;
    }

    return subscribeToWorkspaceChanges({
      organizationId: currentUser.organization_id,
      onChange: () => {
        refreshQueuedRef.current = true;
        void flushRemoteRefresh();
      },
    });
  }, [
    currentUser?.organization_id,
    currentUser?.status,
    flushRemoteRefresh,
    isRemoteHydrated,
  ]);

  const runWorkspaceMutation = useCallback(
    async (produceNextDb, fallbackError = "Workspace data could not be synchronized to Supabase.") => {
      if (!canUseSupabaseWorkspace()) {
        const message =
          "Supabase workspace configuration is missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY to .env.local.";
        setRemoteError(message);
        return { ...buildRemoteDisabledError(), message };
      }

      if (!currentUser?.organization_id || currentUser.status !== "active") {
        return buildRemoteDisabledError();
      }

      const previousDb = dbRef.current;
      const outcome = produceNextDb(previousDb);
      const nextCandidate = outcome?.next ?? outcome;
      const response = outcome?.response ?? { ok: true };

      if (!nextCandidate) {
        return response;
      }

      const nextDb = normalizeDb(nextCandidate);
      if (JSON.stringify(previousDb) === JSON.stringify(nextDb)) {
        return response;
      }

      dbRef.current = nextDb;
      setDbState(nextDb);
      isMutatingRef.current = true;

      try {
        await syncWorkspaceDiff({
          organizationId: currentUser.organization_id,
          currentUserId: currentUser.id,
          defaultTeamId: currentUser.primary_team_id,
          previousDb,
          nextDb,
        });
        setRemoteError(null);
      } catch (error) {
        dbRef.current = previousDb;
        setDbState(previousDb);
        const message = formatWorkspaceSyncError(error, fallbackError);
        setRemoteError(message);
        return {
          ...response,
          ok: false,
          reason: response?.reason || "remote_sync_failed",
          message,
        };
      } finally {
        isMutatingRef.current = false;
      }

      await flushRemoteRefresh();
      return response;
    },
    [currentUser?.id, currentUser?.organization_id, currentUser?.primary_team_id, currentUser?.status, flushRemoteRefresh]
  );

  const enqueueWorkspaceMutation = useCallback(
    (produceNextDb, fallbackError) => {
      const queued = mutationQueueRef.current
        .catch(() => undefined)
        .then(() => runWorkspaceMutation(produceNextDb, fallbackError));
      mutationQueueRef.current = queued.then(() => undefined, () => undefined);
      return queued;
    },
    [runWorkspaceMutation]
  );

  const queueMutation = useCallback(
    (produceNextDb, fallbackError) =>
      (...args) =>
        enqueueWorkspaceMutation((prev) => produceNextDb(prev, ...args), fallbackError),
    [enqueueWorkspaceMutation]
  );

  const queueOkMutation = useCallback(
    (produceNextDb, fallbackError) =>
      (...args) =>
        enqueueWorkspaceMutation(
          (prev) => ({
            next: produceNextDb(prev, ...args),
            response: { ok: true },
          }),
          fallbackError
        ),
    [enqueueWorkspaceMutation]
  );

  // Public read helpers
  const setDb = useCallback(
    (updater) =>
      enqueueWorkspaceMutation(
        (prev) => ({
          next: typeof updater === "function" ? updater(prev) : updater,
          response: { ok: true },
        }),
        "Workspace data could not be synchronized to Supabase."
      ),
    [enqueueWorkspaceMutation]
  );

  const writerName = useCallback(
    (writerId) => db.writers.find((writer) => writer.id === writerId)?.name || "-",
    [db.writers]
  );

  // Public mutation helpers
  const patchTask = queueMutation(
    (prev, id, patch, options = {}) => patchTaskState(prev, id, patch, options),
    "Task changes could not be saved to Supabase."
  );

  const createTask = queueMutation(
    (prev, task) => createTaskState(prev, task),
    "Task could not be created in Supabase."
  );

  const deleteTask = queueOkMutation(
    (prev, id) => deleteTaskState(prev, id),
    "Task could not be deleted from Supabase."
  );

  const toggleVisibility = queueOkMutation(
    (prev, participantId) => toggleVisibilityState(prev, participantId),
    "Participant visibility could not be updated in Supabase."
  );

  const reorderParticipants = queueOkMutation(
    (prev, projectId, sourceId, targetId) =>
      reorderParticipantsState(prev, projectId, sourceId, targetId),
    "Participant order could not be updated in Supabase."
  );

  const patchWriter = queueOkMutation(
    (prev, writerId, patch) => patchWriterState(prev, writerId, patch),
    "Writer changes could not be saved to Supabase."
  );

  const createWriter = queueMutation(
    (prev, payload) => createWriterState(prev, payload),
    "Writer could not be created in Supabase."
  );

  const deleteWriter = queueMutation(
    (prev, writerId) => deleteWriterState(prev, writerId),
    "Writer could not be deleted from Supabase."
  );

  const createProject = useCallback(
    (payload) =>
      enqueueWorkspaceMutation(
        (prev) => {
          const resolvedTeamId =
            payload?.team_id ||
            (currentUser?.primary_team_id && currentUser.primary_team_id !== WAITING_TEAM_ID
              ? currentUser.primary_team_id
              : null);
          const nextState = createProjectState(prev, {
            ...payload,
            team_id: resolvedTeamId,
            pd_id: payload?.pd_id || currentUser?.id || null,
            pd_name: payload?.pd_name || currentUser?.name || "미지정 PD",
          });
          return {
            next: nextState.next,
            response: nextState.project ? { ok: true, project: nextState.project } : { ok: false, reason: "invalid_title" },
          };
        },
        "Project could not be created in Supabase."
      ),
    [currentUser?.id, currentUser?.name, currentUser?.primary_team_id, enqueueWorkspaceMutation]
  );

  const patchProject = useCallback(
    (projectId, patch) =>
      enqueueWorkspaceMutation(
        (prev) => ({
          next: patchProjectState(prev, projectId, {
            ...patch,
            actor_id: currentUser?.id || null,
          }),
          response: { ok: true },
        }),
        "Project changes could not be saved to Supabase."
      ),
    [currentUser?.id, enqueueWorkspaceMutation]
  );

  const deleteProject = useCallback(
    (projectId) =>
      enqueueWorkspaceMutation(
        (prev) => {
          const nextState = deleteProjectState(prev, projectId);
          return {
            next: nextState.next,
            response: { ok: nextState.existed, existed: nextState.existed },
          };
        },
        "Project could not be deleted from Supabase."
      ),
    [enqueueWorkspaceMutation]
  );

  const createParticipant = useCallback(
    (payload) =>
      enqueueWorkspaceMutation(
        (prev) => createParticipantState(prev, payload),
        "Participant could not be created in Supabase."
      ),
    [enqueueWorkspaceMutation]
  );

  const patchParticipant = queueMutation(
    (prev, participantId, patch) => patchParticipantState(prev, participantId, patch),
    "Participant could not be updated in Supabase."
  );

  const toggleScheduleChangeTypo = queueOkMutation(
    (prev, changeId) => toggleScheduleChangeTypoState(prev, changeId),
    "Schedule change could not be updated in Supabase."
  );

  const endParticipant = queueMutation(
    (prev, participantId, endedAt, reason) => endParticipantState(prev, participantId, endedAt, reason),
    "Participant end state could not be saved to Supabase."
  );

  const replaceParticipant = queueMutation(
    (prev, payload) => replaceParticipantState(prev, payload),
    "Participant replacement could not be saved to Supabase."
  );

  const upsertWeeklyReport = queueOkMutation(
    (prev, { weekStart, weekEnd, projectId = "all", writerId, patch }) =>
      upsertWeeklyReportState(prev, { weekStart, weekEnd, projectId, writerId, patch }),
    "Weekly report could not be saved to Supabase."
  );

  return {
    db,
    setDb,
    isRemoteHydrated,
    remoteError,
    writerName,
    patchTask,
    createTask,
    deleteTask,
    toggleVisibility,
    reorderParticipants,
    patchWriter,
    createWriter,
    deleteWriter,
    createProject,
    patchProject,
    deleteProject,
    createParticipant,
    patchParticipant,
    toggleScheduleChangeTypo,
    endParticipant,
    replaceParticipant,
    upsertWeeklyReport,
  };
}
