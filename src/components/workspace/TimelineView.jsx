import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STATUS,
  diffDays,
  getStatusVisualKey,
  needsTaskFeedback,
  normalizeEpisodeNo,
  normalizeTaskStatus,
  todayIso,
} from "../../data";
import EmptyState from "../ui/EmptyState.jsx";
import { deadlineSignal } from "../../utils/workspace";
import { applyDragRange, clampDragRange, hasActualSchedule } from "../../domain/timelineCore";
import { tasksForParticipantInRange } from "../../features/timeline/domain/selectors";
import { resolveTaskSerializationDate, timelineReleaseLabel } from "../../utils/serialization";
import { buildTaskSummary, formatEpisodeLabel } from "../../utils/taskPresentation.js";
import {
  dayCaption,
  inRange,
  laneFromOffset,
  laneMetrics,
  placeStyle,
  resolveCellWidth,
  resolveLabelWidth,
  roleToType,
  statusLabel,
  taskTone,
} from "./timelineViewHelpers.js";

export default function TimelineView({
  participants,
  visibleParticipants,
  tasks,
  writerName,
  range,
  focusParticipantId,
  selectedTaskId,
  typeOptions,
  onOpenTask,
  onInlineCreateTask,
  onPatchTask,
  onDeleteTask,
  onToggleFeedbackDone,
  onMarkDone,
  onSetStatus,
  serializationMap,
  navCommand,
  onNavHandled,
  onEnsureDateInRange,
  onEdgeExtend,
  windowAdjust,
  onWindowAdjustHandled,
}) {
  const [cellWidth, setCellWidth] = useState(() => resolveCellWidth());
  const [labelWidth, setLabelWidth] = useState(() => resolveLabelWidth());
  const [dragPreview, setDragPreview] = useState(null);
  const [createRange, setCreateRange] = useState(null);
  const [creator, setCreator] = useState(null);
  const [creatorOffset, setCreatorOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const creatorRef = useRef(null);
  const gridRef = useRef(null);
  const leftArmedRef = useRef(true);
  const rightArmedRef = useRef(true);
  const edgeCooldownRef = useRef(0);
  const edgeLockRef = useRef(false);
  const edgeUnlockTimerRef = useRef(null);
  const initialTodayScrolledRef = useRef(false);

  useEffect(() => {
    const onResize = () => {
      setCellWidth(resolveCellWidth());
      setLabelWidth(resolveLabelWidth());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    initialTodayScrolledRef.current = false;
  }, [range.start, range.end]);

  useEffect(() => {
    if (!creator) return;
    const onDown = (event) => {
      if (creatorRef.current?.contains(event.target)) return;
      setCreator(null);
    };
    setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => document.removeEventListener("mousedown", onDown);
  }, [creator]);

  useEffect(() => {
    if (!creator) {
      setCreatorOffset({ x: 0, y: 0 });
      return;
    }
    setCreatorOffset({ x: 0, y: 0 });
  }, [creator?.participant_id, creator?.left, creator?.top, creator?.lane]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const enableEdgeExtend = true;

    const onScroll = () => {
      if (edgeLockRef.current) return;
      const threshold = Math.max(cellWidth * 2, 96);
      const atLeft = grid.scrollLeft <= threshold;
      const atRight = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - threshold;
      if (!atLeft) leftArmedRef.current = true;
      if (!atRight) rightArmedRef.current = true;
      if (!enableEdgeExtend) return;
      if (Date.now() - edgeCooldownRef.current < 180) return;

      if (atLeft && leftArmedRef.current) {
        leftArmedRef.current = false;
        edgeCooldownRef.current = Date.now();
        edgeLockRef.current = true;
        if (edgeUnlockTimerRef.current) {
          clearTimeout(edgeUnlockTimerRef.current);
        }
        edgeUnlockTimerRef.current = setTimeout(() => {
          edgeLockRef.current = false;
          edgeUnlockTimerRef.current = null;
        }, 700);
        onEdgeExtend?.("left");
        return;
      }

      if (atRight && rightArmedRef.current) {
        rightArmedRef.current = false;
        edgeCooldownRef.current = Date.now();
        edgeLockRef.current = true;
        if (edgeUnlockTimerRef.current) {
          clearTimeout(edgeUnlockTimerRef.current);
        }
        edgeUnlockTimerRef.current = setTimeout(() => {
          edgeLockRef.current = false;
          edgeUnlockTimerRef.current = null;
        }, 700);
        onEdgeExtend?.("right");
      }
    };

    grid.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      grid.removeEventListener("scroll", onScroll);
      if (edgeUnlockTimerRef.current) {
        clearTimeout(edgeUnlockTimerRef.current);
        edgeUnlockTimerRef.current = null;
      }
    };
  }, [cellWidth, onEdgeExtend]);

  useEffect(() => {
    if (!creator || !creatorRef.current || !gridRef.current) return;
    const grid = gridRef.current;
    const popup = creatorRef.current;
    requestAnimationFrame(() => {
      if (!grid || !popup) return;
      const gridRect = grid.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.bottom > gridRect.bottom - 8) {
        const diff = popupRect.bottom - (gridRect.bottom - 8);
        grid.scrollTop += diff + 10;
      }
      if (popupRect.top < gridRect.top + 8) {
        const diff = gridRect.top + 8 - popupRect.top;
        grid.scrollTop -= diff + 10;
      }
      if (popupRect.right > gridRect.right - 8) {
        const diff = popupRect.right - (gridRect.right - 8);
        grid.scrollLeft += diff + 10;
      }
      if (popupRect.left < gridRect.left + 8) {
        const diff = gridRect.left + 8 - popupRect.left;
        grid.scrollLeft -= diff + 10;
      }

      requestAnimationFrame(() => {
        if (!creatorRef.current || !gridRef.current) return;
        const postGridRect = gridRef.current.getBoundingClientRect();
        const postPopupRect = creatorRef.current.getBoundingClientRect();
        const margin = 8;
        let offsetX = 0;
        let offsetY = 0;
        if (postPopupRect.right > postGridRect.right - margin) {
          offsetX -= postPopupRect.right - (postGridRect.right - margin);
        }
        if (postPopupRect.left < postGridRect.left + margin) {
          offsetX += postGridRect.left + margin - postPopupRect.left;
        }
        if (postPopupRect.bottom > postGridRect.bottom - margin) {
          offsetY -= postPopupRect.bottom - (postGridRect.bottom - margin);
        }
        if (postPopupRect.top < postGridRect.top + margin) {
          offsetY += postGridRect.top + margin - postPopupRect.top;
        }
        if (Math.abs(offsetX) < 1) offsetX = 0;
        if (Math.abs(offsetY) < 1) offsetY = 0;
        setCreatorOffset((prev) => {
          if (prev.x === offsetX && prev.y === offsetY) return prev;
          return { x: offsetX, y: offsetY };
        });
      });
    });
  }, [creator]);

  useEffect(() => {
    if (!windowAdjust || !gridRef.current) return;
    if (windowAdjust.direction === "left" && Number(windowAdjust.days || 0) > 0) {
      const offset = Number(windowAdjust.days) * cellWidth;
      requestAnimationFrame(() => {
        if (!gridRef.current) return;
        gridRef.current.scrollLeft += offset;
        edgeLockRef.current = false;
        onWindowAdjustHandled?.(windowAdjust.id);
      });
      return;
    }
    edgeLockRef.current = false;
    onWindowAdjustHandled?.(windowAdjust.id);
  }, [windowAdjust, cellWidth, onWindowAdjustHandled]);

  useEffect(() => {
    if (!navCommand || !gridRef.current) return;
    const grid = gridRef.current;

    if (navCommand.type === "scrollToStart") {
      grid.scrollTo({ left: 0, behavior: "smooth" });
      onNavHandled?.(navCommand.id);
      return;
    }

    if (navCommand.type === "scrollByDays") {
      grid.scrollBy({ left: Number(navCommand.days || 0) * cellWidth, behavior: "smooth" });
      onNavHandled?.(navCommand.id);
      return;
    }

    if (navCommand.type === "scrollToDate") {
      const targetDate = String(navCommand.date || "").slice(0, 10);
      const idx = range.days.indexOf(targetDate);
      if (idx >= 0) {
        const target = Math.max(idx * cellWidth - cellWidth * 1.5, 0);
        grid.scrollTo({ left: target, behavior: "smooth" });
        onNavHandled?.(navCommand.id);
      } else if (targetDate) {
        onEnsureDateInRange?.(targetDate);
      }
      return;
    }

    if (navCommand.type === "scrollToToday") {
      const today = todayIso();
      const idx = range.days.indexOf(today);
      if (idx >= 0) {
        const target = Math.max(idx * cellWidth - cellWidth * 1.5, 0);
        grid.scrollTo({ left: target, behavior: "smooth" });
        onNavHandled?.(navCommand.id);
      } else {
        onEnsureDateInRange?.(today);
      }
    }
  }, [navCommand, range.days, cellWidth, onEnsureDateInRange, onNavHandled]);

  useEffect(() => {
    if (initialTodayScrolledRef.current) return;
    if (!gridRef.current || !range?.days?.length) return;
    const today = todayIso();
    const idx = range.days.indexOf(today);
    if (idx < 0) return;
    const target = Math.max(idx * cellWidth - cellWidth * 1.5, 0);
    gridRef.current.scrollLeft = target;
    initialTodayScrolledRef.current = true;
  }, [range.days, cellWidth]);

  const resolveLaneRange = useCallback((task, lane) => {
    if (lane === "planned") {
      return { start: task.ps, end: task.pe };
    }
    return { start: task.cs, end: task.ce };
  }, []);

  const resolveRenderedRange = useCallback(
    (task, lane) => {
      const base = resolveLaneRange(task, lane);
      if (
        dragPreview &&
        dragPreview.taskId === task.id &&
        dragPreview.lane === lane &&
        dragPreview.deltaDays
      ) {
        return applyDragRange(base, dragPreview.mode, dragPreview.deltaDays);
      }
      return base;
    },
    [dragPreview, resolveLaneRange]
  );

  const startCardDrag = useCallback(
    (event, task, lane, mode, laneStart, laneEnd) => {
      if (!onPatchTask || !laneStart || !laneEnd) return;
      event.preventDefault();
      event.stopPropagation();
      setCreator(null);

      const state = {
        task,
        taskId: task.id,
        lane,
        mode,
        startX: event.clientX,
        deltaDays: 0,
        range: { start: laneStart, end: laneEnd },
      };
      dragRef.current = state;
      setDragPreview({ taskId: task.id, lane, mode, deltaDays: 0 });

      const onMove = (moveEvent) => {
        if (!dragRef.current) return;
        const normalizedCellWidth = cellWidth || 1;
        const deltaDays = Math.round((moveEvent.clientX - state.startX) / normalizedCellWidth);
        dragRef.current.deltaDays = deltaDays;
        const rawRange = applyDragRange(state.range, state.mode, deltaDays);
        const clamped = clampDragRange(rawRange, state.range, state.mode, range.start, range.end);
        const clampedDays =
          state.mode === "end"
            ? diffDays(state.range.end, clamped.end)
            : diffDays(state.range.start, clamped.start);
        setDragPreview({
          taskId: state.taskId,
          lane: state.lane,
          mode: state.mode,
          deltaDays: clampedDays,
        });
      };

      const onUp = () => {
        const final = dragRef.current;
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        setDragPreview(null);

        if (!final || !final.deltaDays) return;

        const rawRange = applyDragRange(final.range, final.mode, final.deltaDays);
        const nextRange = clampDragRange(rawRange, final.range, final.mode, range.start, range.end);
        if (!nextRange.start || !nextRange.end) return;

        if (final.lane === "planned") {
          const plannedSource = final.mode === "move" ? "timeline_plan_drag" : "timeline_plan_resize";
          onPatchTask(final.taskId, { ps: nextRange.start, pe: nextRange.end }, plannedSource);
          return;
        }

        const actualSource = final.mode === "move" ? "timeline_drag" : "timeline_resize";
        onPatchTask(final.taskId, {
          cs: nextRange.start,
          ce: nextRange.end,
          status:
            normalizeTaskStatus(final.task.status) === "planned"
              ? "in_progress"
              : normalizeTaskStatus(final.task.status),
        }, actualSource);
      };

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },
    [onPatchTask, cellWidth, range.end, range.start]
  );

  const startRangeCreate = useCallback(
    (event, participantId, track) => {
      if (event.button !== 0) return;
      if (event.target !== track) return;

      event.preventDefault();
      event.stopPropagation();
      setCreator(null);

      const rect = track.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(event.clientX - rect.left, rect.width - 1));
      const idx = Math.max(0, Math.min(range.days.length - 1, Math.floor(offsetX / cellWidth)));
      const lane = laneFromOffset(track, event.clientY - rect.top);
      const metrics = laneMetrics(track, lane);

      const state = {
        participantId,
        lane,
        startIdx: idx,
        endIdx: idx,
        previewTop: metrics.top,
        previewHeight: metrics.height,
      };
      setCreateRange(state);

      const onMove = (moveEvent) => {
        const moveRect = track.getBoundingClientRect();
        const moveOffsetX = Math.max(0, Math.min(moveEvent.clientX - moveRect.left, moveRect.width - 1));
        const nextIdx = Math.max(
          0,
          Math.min(range.days.length - 1, Math.floor(moveOffsetX / cellWidth))
        );
        state.endIdx = nextIdx;
        setCreateRange({ ...state });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);

        const a = Math.min(state.startIdx, state.endIdx);
        const b = Math.max(state.startIdx, state.endIdx);
        const startDate = range.days[a];
        const endDate = range.days[b];
        const metrics = laneMetrics(track, state.lane);

        setCreateRange(null);
        setCreator({
          participant_id: participantId,
          lane: state.lane,
          startDate,
          endDate,
          left: a * cellWidth + 4,
          top: Math.max(metrics.top - 2, 8),
          type: roleToType(participants.find((item) => item.id === participantId)?.role || ""),
          episode_no: "",
          status: state.lane === "planned" ? "planned" : "in_progress",
        });
      };

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    },
    [range.days, participants, cellWidth]
  );

  if (!participants.length) {
    return <EmptyState>참여 작가를 먼저 등록하세요.</EmptyState>;
  }

  if (!visibleParticipants.length) {
    return <EmptyState>표시 중인 참여 작가가 없습니다. 눈 아이콘을 켜주세요.</EmptyState>;
  }

  const today = todayIso();
  const todayIdx = range.days.indexOf(today);
  const trackWidth = range.days.length * cellWidth;

  return (
    <div className="timeline-v2">
      <div
        ref={gridRef}
        className="timeline-grid-v2"
        style={{ "--timeline-label-width": `${labelWidth}px` }}
      >
        <div className="timeline-head-v2">
          <div className="timeline-head-left-v2">참여 작가</div>
          <div
            className="timeline-days-v2"
            style={{
              width: `${trackWidth}px`,
              gridTemplateColumns: `repeat(${range.days.length}, ${cellWidth}px)`,
            }}
          >
            {range.days.map((day) => (
              <div key={day} className={`timeline-day-v2 ${day === today ? "today" : ""}`}>
                <span>{dayCaption(day)}</span>
                {timelineReleaseLabel(day, serializationMap) && (
                  <small>{timelineReleaseLabel(day, serializationMap)}</small>
                )}
              </div>
            ))}
          </div>
        </div>

        {participants.map((participant) => {
          if (participant.hidden_from_ops) return null;

          const rowTasks = tasksForParticipantInRange(
            tasks,
            participant.id,
            range.start,
            range.end
          );

          const selected = focusParticipantId === participant.id;
          const dimmed = Boolean(focusParticipantId && focusParticipantId !== participant.id);

          const rangePreviewForRow =
            createRange && createRange.participantId === participant.id
              ? {
                  lane: createRange.lane,
                  startIdx: Math.min(createRange.startIdx, createRange.endIdx),
                  endIdx: Math.max(createRange.startIdx, createRange.endIdx),
                  top: createRange.previewTop,
                  height: createRange.previewHeight,
                }
              : null;

          return (
            <div
              key={participant.id}
              className={`timeline-row-v2 ${selected ? "focus-selected" : ""} ${
                dimmed ? "focus-dimmed" : ""
              }`}
            >
              <div className="timeline-row-label-v2">
                <div className="timeline-person-name-v2">{writerName(participant.writer_id)}</div>
                <div className="timeline-lane-chip-v2 planned">예정</div>
                <div className="timeline-person-role-v2">{participant.role}</div>
                <div className="timeline-lane-chip-v2 actual">실행</div>
              </div>

              <div
                className={`timeline-track-v2 ${rangePreviewForRow ? "create-range" : ""}`}
                style={{ width: `${trackWidth}px`, "--day-width": `${cellWidth}px` }}
                onPointerDown={(event) => startRangeCreate(event, participant.id, event.currentTarget)}
              >
                {todayIdx >= 0 && (
                  <div
                    className="timeline-today-slot-v2"
                    style={{ left: `${todayIdx * cellWidth - 4}px`, width: `${cellWidth + 8}px` }}
                  />
                )}

                {rangePreviewForRow && (
                  <div
                    className={`range-preview-v2 lane-${rangePreviewForRow.lane}`}
                    style={{
                      left: `${rangePreviewForRow.startIdx * cellWidth + 2}px`,
                      width: `${(rangePreviewForRow.endIdx - rangePreviewForRow.startIdx + 1) * cellWidth - 4}px`,
                      top: `${rangePreviewForRow.top}px`,
                      height: `${rangePreviewForRow.height}px`,
                    }}
                  />
                )}

                {rowTasks.map((task) => {
                  const plannedRange = resolveRenderedRange(task, "planned");
                  const plannedVisible = inRange(plannedRange.start, plannedRange.end, range.start, range.end);
                  if (!plannedVisible) return null;
                  const style = placeStyle(
                    plannedRange.start,
                    plannedRange.end,
                    range.start,
                    range.days.length,
                    cellWidth
                  );
                  if (!style) return null;

                  return (
                    <div
                      key={`${task.id}-planned`}
                      className={`timeline-plan-band-v2 ${selectedTaskId === task.id ? "selected" : ""}`}
                      style={style}
                    >
                      <button
                        type="button"
                        className="timeline-grip left"
                        onPointerDown={(event) =>
                          startCardDrag(event, task, "planned", "start", task.ps, task.pe)
                        }
                      />
                      <button
                        type="button"
                        className="timeline-plan-main-v2"
                        onClick={() => onOpenTask(task.id, "planned")}
                      >
                        <span
                          className="timeline-plan-pill-v2"
                          onPointerDown={(event) =>
                            startCardDrag(event, task, "planned", "move", task.ps, task.pe)
                          }
                          title="좌우 드래그로 예정 이동"
                        >
                          예정
                        </span>
                        <span className="timeline-plan-text-v2">{buildTaskSummary(task)}</span>
                      </button>
                      <button
                        type="button"
                        className="timeline-grip right"
                        onPointerDown={(event) =>
                          startCardDrag(event, task, "planned", "end", task.ps, task.pe)
                        }
                      />
                    </div>
                  );
                })}

                {rowTasks.map((task) => {
                  if (!hasActualSchedule(task)) return null;
                  const actualRange = resolveRenderedRange(task, "actual");
                  const actualVisible = inRange(actualRange.start, actualRange.end, range.start, range.end);
                  if (!actualVisible) return null;
                  const style = placeStyle(
                    actualRange.start,
                    actualRange.end,
                    range.start,
                    range.days.length,
                    cellWidth
                  );
                  if (!style) return null;
                  const deadline = deadlineSignal(task, today);
                  const tone = taskTone(task, today);

                  return (
                    <div
                      key={`${task.id}-actual`}
                      className={`timeline-task-block-v2 status-${getStatusVisualKey(task.status)} tone-${tone} ${
                        selectedTaskId === task.id ? "selected" : ""
                      }`}
                      style={style}
                    >
                      <div
                        className="timeline-card-main-v2"
                        onPointerDown={(event) =>
                          startCardDrag(
                            event,
                            task,
                            "actual",
                            "move",
                            task.cs,
                            task.ce
                          )
                        }
                        onClick={() => onOpenTask(task.id, "actual")}
                      >
                        <div className="title">{buildTaskSummary(task)}</div>
                        <div className="meta top-row">
                          <span className="episode-text">{formatEpisodeLabel(task.episode_no)}</span>
                          <span className="task-strong">{task.type || "-"}</span>
                          <span className="spacer" />
                          <span className={`status-chip status-${getStatusVisualKey(task.status)}`}>
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <div className="meta">
                          <span className="writer-muted">{writerName(task.writer_id)}</span>
                          <span className="spacer" />
                          <span>{deadline?.label || "-"}</span>
                        </div>
                        <div className="meta note">
                          <span>{resolveTaskSerializationDate(task, serializationMap) || "연재일 미정"}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="timeline-grip left"
                        onPointerDown={(event) =>
                          startCardDrag(
                            event,
                            task,
                            "actual",
                            "start",
                            task.cs,
                            task.ce
                          )
                        }
                      />
                      <div className="month-hover-actions timeline-hover-actions">
                        <select
                          className="month-inline-status ui-select"
                          value={normalizeTaskStatus(task.status)}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                          onChange={(event) => onSetStatus?.(task.id, event.target.value)}
                        >
                          {STATUS.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="month-mini-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFeedbackDone?.(task);
                          }}
                        >
                          {needsTaskFeedback(task) ? "피드백 해제" : "피드백"}
                        </button>
                        <button
                          type="button"
                          className="month-mini-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkDone?.(task);
                          }}
                        >
                          완료
                        </button>
                        <button
                          type="button"
                          className="month-mini-btn danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTask?.(task.id);
                          }}
                        >
                          삭제
                        </button>
                      </div>
                      <button
                        type="button"
                        className="timeline-grip right"
                        onPointerDown={(event) =>
                          startCardDrag(
                            event,
                            task,
                            "actual",
                            "end",
                            task.cs,
                            task.ce
                          )
                        }
                      />
                    </div>
                  );
                })}

                {creator && creator.participant_id === participant.id && (
                  <div
                    ref={creatorRef}
                    className={`inline-create-pop-v2 lane-${creator.lane}`}
                    style={{
                      left: `${creator.left + creatorOffset.x}px`,
                      top: `${creator.top + creatorOffset.y}px`,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="inline-create-head-v2">
                      <strong>{creator.lane === "planned" ? "예정 입력" : "실행 입력"}</strong>
                    </div>

                    <div className="inline-create-grid-v2">
                      <label>
                        작가
                        <select
                          value={creator.participant_id}
                          onChange={(event) =>
                            setCreator((prev) => (prev ? { ...prev, participant_id: event.target.value } : prev))
                          }
                        >
                          {participants.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {writerName(pt.writer_id)} · {pt.role}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        역할
                        <input
                          type="text"
                          readOnly
                          value={participants.find((pt) => pt.id === creator.participant_id)?.role || ""}
                        />
                      </label>
                    </div>

                    <div className="inline-create-grid-v2">
                      <label>
                        작업구분
                        <select
                          value={creator.type}
                          onChange={(event) =>
                            setCreator((prev) => (prev ? { ...prev, type: event.target.value } : prev))
                          }
                        >
                          {typeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        회차
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={creator.episode_no}
                          onChange={(event) =>
                            setCreator((prev) => (prev ? { ...prev, episode_no: event.target.value } : prev))
                          }
                        />
                      </label>
                    </div>

                    <div className="inline-create-range-v2">
                      {creator.startDate} ~ {creator.endDate}
                    </div>
                    <div className="inline-create-range-v2">
                      {buildTaskSummary({
                        episode_no: normalizeEpisodeNo(creator.episode_no),
                        type: creator.type,
                      })}
                      {" · "}
                      {resolveTaskSerializationDate(
                        { episode_no: normalizeEpisodeNo(creator.episode_no) },
                        serializationMap
                      ) || "연재일 미정"}
                    </div>

                    <div className="inline-create-actions-v2">
                      <button type="button" className="timeline-add-btn" onClick={() => setCreator(null)}>
                        취소
                      </button>
                      <button
                        type="button"
                        className="timeline-add-btn"
                        onClick={() => {
                          onInlineCreateTask?.({
                            participantId: creator.participant_id,
                            start: creator.startDate,
                            end: creator.endDate,
                            mode: creator.lane,
                            status: creator.lane === "planned" ? "planned" : "in_progress",
                            type: creator.type,
                            episodeNo: normalizeEpisodeNo(creator.episode_no),
                          });
                          setCreator(null);
                        }}
                      >
                        생성
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



