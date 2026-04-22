import { useCallback, useEffect, useState } from "react";
import { ISO, addDays } from "../../../utils/workspace";
import {
  monthStartIso,
} from "../domain/workspaceWindowCore";
import {
  ensureTimelineWindow,
  extendTimelineWindow as extendTimelineWindowPolicy,
  timelineBoundsIso,
} from "../domain/timelineWindowPolicy";

export default function useWorkspaceController(initialProjectId = null) {
  // Route and view mode selection
  const [route, setRoute] = useState("home");
  const [mode, setMode] = useState("timeline");
  const [participantTab, setParticipantTab] = useState("active");

  // Primary entity selection
  const [projectId, setProjectId] = useState(initialProjectId);
  const [reviewProjectId, setReviewProjectId] = useState("all");
  const [focusParticipantId, setFocusParticipantId] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [writerId, setWriterId] = useState(null);

  // Overlay and draft state
  const [taskDrawerMode, setTaskDrawerMode] = useState("actual");
  const [projectDraft, setProjectDraft] = useState(null);
  const [participantDraft, setParticipantDraft] = useState(null);
  const [participantEndDraft, setParticipantEndDraft] = useState(null);
  const [participantReplaceDraft, setParticipantReplaceDraft] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [dragParticipantId, setDragParticipantId] = useState(null);

  // Date navigation and feedback
  const [cursor, setCursor] = useState(new Date());
  const [toast, setToast] = useState("");

  // Timeline and month navigation contracts
  const [timelineWindow, setTimelineWindow] = useState(null);
  const [timelineNavCommand, setTimelineNavCommand] = useState(null);
  const [timelineWindowAdjust, setTimelineWindowAdjust] = useState(null);
  const [monthFocusTodayToken, setMonthFocusTodayToken] = useState(0);
  const [monthJumpTarget, setMonthJumpTarget] = useState(null);
  const [monthJumpYear, setMonthJumpYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (mode !== "kanban") {
      setDragParticipantId(null);
    }
  }, [mode]);

  useEffect(() => {
    setTimelineWindow(null);
    setTimelineNavCommand(null);
    setTimelineWindowAdjust(null);
  }, [projectId]);

  const ensureDateInTimelineWindow = useCallback((dateIso) => {
    setTimelineWindow((prev) => {
      const resolved = ensureTimelineWindow(prev, dateIso, timelineBoundsIso());
      if (!resolved.changed) return prev;
      return resolved.window;
    });
  }, []);

  useEffect(() => {
    if (route !== "workspace") return;
    const today = ISO(new Date());

    if (mode === "timeline") {
      setCursor(new Date(today));
      ensureDateInTimelineWindow(today);
      setTimelineNavCommand({
        id: `nav_${Date.now()}`,
        type: "scrollToToday",
      });
      return;
    }

    if (mode === "month") {
      const now = new Date(today);
      setMonthJumpYear(now.getFullYear());
      setMonthJumpTarget({
        id: `jump_boot_${Date.now()}`,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      setMonthFocusTodayToken((prev) => prev + 1);
    }
  }, [route, mode, projectId, ensureDateInTimelineWindow]);

  const extendTimelineWindow = useCallback((direction) => {
    setTimelineWindow((prev) => {
      const resolved = extendTimelineWindowPolicy(prev, direction, timelineBoundsIso());
      if (!resolved.changed) return prev;
      if (direction === "left") {
        setTimelineWindowAdjust({
          id: `adjust_${Date.now()}`,
          direction: "left",
          days: resolved.adjustDays,
        });
        return resolved.window;
      }
      setTimelineWindowAdjust({
        id: `adjust_${Date.now()}`,
        direction: "right",
        days: 0,
      });
      return resolved.window;
    });
  }, []);

  const shiftTimeline = useCallback(
    (direction) => {
      if (mode === "timeline") {
        const nextCursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
        const targetMonthDate = ISO(nextCursor);
        ensureDateInTimelineWindow(targetMonthDate);
        setCursor(nextCursor);
        setTimelineNavCommand({
          id: `nav_${Date.now()}`,
          type: "scrollToDate",
          date: monthStartIso(targetMonthDate),
        });
        return;
      }

      if (mode === "kanban") {
        setCursor((prev) => addDays(prev, direction * 7));
        return;
      }

      setCursor((prev) => addDays(prev, direction));
    },
    [cursor, mode, ensureDateInTimelineWindow]
  );

  const shiftMonth = useCallback((months) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + months, 1));
  }, []);

  const shiftMonthJumpYear = useCallback((delta) => {
    setMonthJumpYear((prev) => prev + delta);
  }, []);

  const moveToToday = useCallback(() => {
    const today = ISO(new Date());

    if (mode === "timeline") {
      setCursor(new Date(today));
      ensureDateInTimelineWindow(today);
      setTimelineNavCommand({
        id: `nav_${Date.now()}`,
        type: "scrollToToday",
      });
      return;
    }

    if (mode === "month") {
      setCursor(new Date(today));
      setMonthJumpYear(new Date(today).getFullYear());
      setMonthFocusTodayToken((prev) => prev + 1);
      setMonthJumpTarget({
        id: `jump_today_${Date.now()}`,
        year: new Date(today).getFullYear(),
        month: new Date(today).getMonth() + 1,
      });
      return;
    }

    setCursor(new Date(today));
  }, [mode, ensureDateInTimelineWindow]);

  const moveTimelineToStart = useCallback(() => {
    if (mode !== "timeline") return;
    setTimelineNavCommand({
      id: `nav_${Date.now()}`,
      type: "scrollToStart",
    });
  }, [mode]);

  return {
    route,
    setRoute,
    mode,
    setMode,
    participantTab,
    setParticipantTab,
    projectId,
    setProjectId,
    reviewProjectId,
    setReviewProjectId,
    focusParticipantId,
    setFocusParticipantId,
    taskId,
    setTaskId,
    taskDrawerMode,
    setTaskDrawerMode,
    projectDraft,
    setProjectDraft,
    participantDraft,
    setParticipantDraft,
    participantEndDraft,
    setParticipantEndDraft,
    participantReplaceDraft,
    setParticipantReplaceDraft,
    createDraft,
    setCreateDraft,
    dragParticipantId,
    setDragParticipantId,
    writerId,
    setWriterId,
    cursor,
    setCursor,
    toast,
    setToast,
    timelineWindow,
    setTimelineWindow,
    timelineNavCommand,
    setTimelineNavCommand,
    timelineWindowAdjust,
    setTimelineWindowAdjust,
    monthFocusTodayToken,
    setMonthFocusTodayToken,
    monthJumpTarget,
    setMonthJumpTarget,
    monthJumpYear,
    setMonthJumpYear,
    ensureDateInTimelineWindow,
    extendTimelineWindow,
    shiftTimeline,
    shiftMonth,
    shiftMonthJumpYear,
    moveToToday,
    moveTimelineToStart,
  };
}
