import { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUS,
  getLabelStatus,
  getStatusVisualKey,
  needsTaskFeedback,
  normalizeTaskStatus,
} from "../../data";
import EmptyState from "../ui/EmptyState.jsx";
import { monthStart, ISO, deadlineSignal } from "../../utils/workspace";
import { monthEventsForDate } from "../../features/workspace/domain/viewCore";
import { timelineReleaseLabel } from "../../utils/serialization";
import { formatEpisodeLabel } from "../../utils/taskPresentation.js";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function pointLabel(point) {
  if (point?.kind === "actual_start") return "실행";
  if (point?.kind === "planned_start") return "예정";
  return "마감";
}

function pointTone(point) {
  if (point?.kind === "actual_start") return "actual";
  if (point?.kind === "planned_start") return "planned";
  return "deadline";
}

function normalizeRange(a, b) {
  if (!a || !b) return null;
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

function addMonths(dateValue, offset) {
  const base = monthStart(dateValue);
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function monthKeyFromDate(dateValue) {
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, "0")}`;
}

function monthMeta(dateValue) {
  const base = monthStart(dateValue);
  const year = base.getFullYear();
  const month = base.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  return {
    key: monthKeyFromDate(base),
    year,
    month,
    days,
    firstOffset,
    date: base,
  };
}

function initializeMonths() {
  const today = monthStart(new Date());
  return [addMonths(today, -1), today, addMonths(today, 1)].map((item) => monthStart(item));
}

function buildMonthInlineAnchor(scroller, date, fallbackPoint = null) {
  if (!(scroller instanceof HTMLElement)) return fallbackPoint;
  const cell = scroller.querySelector(`[data-date="${date}"]`);
  const cellRect = cell instanceof HTMLElement ? cell.getBoundingClientRect() : null;
  const pointX =
    fallbackPoint && Number.isFinite(Number(fallbackPoint.x))
      ? Number(fallbackPoint.x)
      : (cellRect?.left || scroller.getBoundingClientRect().left) + 24;
  const pointY =
    fallbackPoint && Number.isFinite(Number(fallbackPoint.y))
      ? Number(fallbackPoint.y)
      : (cellRect?.bottom || scroller.getBoundingClientRect().top) - 8;
  return {
    x: pointX,
    y: pointY,
    mode: "month",
    container: scroller,
    cellRect: cellRect
      ? {
          left: cellRect.left,
          top: cellRect.top,
          right: cellRect.right,
          bottom: cellRect.bottom,
        }
      : null,
  };
}

export default function MonthView({
  project,
  participants,
  visibleParticipants,
  tasks,
  writerName,
  serializationMap,
  onOpenTask,
  onCreateAtDate,
  onCreateRange,
  onSetStatus,
  onToggleFeedback,
  onMarkDone,
  dragParticipantId,
  onDropParticipant,
  focusTodayToken,
  jumpTarget,
  onJumpHandled,
}) {
  const [dragRange, setDragRange] = useState(null);
  const [months, setMonths] = useState(() => initializeMonths());
  const [pendingJump, setPendingJump] = useState(null);
  const scrollRef = useRef(null);
  const todayRef = useRef(null);
  const monthRefs = useRef(new Map());
  const prependingRef = useRef(false);
  const appendingRef = useRef(false);
  const firstAlignDoneRef = useRef(false);
  const programmaticScrollLockUntilRef = useRef(0);

  useEffect(() => {
    if (!dragRange?.active) return;

    const endDrag = (event) => {
      setDragRange((prev) => {
        if (!prev?.active) return prev;
        const range = normalizeRange(prev.start, prev.end);
        if (!range) return null;
        const anchor = buildMonthInlineAnchor(
          scrollRef.current,
          range.end,
          event && Number.isFinite(Number(event.clientX)) && Number.isFinite(Number(event.clientY))
            ? { x: event.clientX, y: event.clientY }
            : null
        );
        if (range.start === range.end) {
          onCreateAtDate?.(range.start, anchor);
        } else {
          onCreateRange?.(range.start, range.end, anchor);
        }
        return null;
      });
    };

    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    return () => {
      window.removeEventListener("pointerup", endDrag, true);
      window.removeEventListener("pointercancel", endDrag, true);
    };
  }, [dragRange, onCreateAtDate, onCreateRange]);

  useEffect(() => {
    if (!focusTodayToken || pendingJump || jumpTarget) return;
    let raf = null;
    const run = () => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    raf = requestAnimationFrame(run);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [focusTodayToken, pendingJump, jumpTarget]);

  useEffect(() => {
    if (firstAlignDoneRef.current) return;
    if (pendingJump || jumpTarget) return;
    const today = monthStart(new Date());
    const targetKey = monthKeyFromDate(today);
    const node = monthRefs.current.get(targetKey);
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ block: "start", behavior: "auto" });
      firstAlignDoneRef.current = true;
    });
  }, [months, pendingJump, jumpTarget]);

  useEffect(() => {
    if (!jumpTarget) return;
    const targetDate = new Date(jumpTarget.year, Math.max(0, Number(jumpTarget.month) - 1), 1);
    const targetKey = monthKeyFromDate(targetDate);

    setMonths([
      monthStart(addMonths(targetDate, -1)),
      monthStart(targetDate),
      monthStart(addMonths(targetDate, 1)),
    ]);
    programmaticScrollLockUntilRef.current = Date.now() + 700;
    setPendingJump({ id: jumpTarget.id, key: targetKey });
  }, [jumpTarget]);

  useEffect(() => {
    if (!pendingJump) return;
    const node = monthRefs.current.get(pendingJump.key);
    const scroller = scrollRef.current;
    if (!node || !scroller) return;
    requestAnimationFrame(() => {
      const targetTop = Math.max(0, node.offsetTop - scroller.offsetTop - 6);
      scroller.scrollTo({ top: targetTop, behavior: "auto" });
      programmaticScrollLockUntilRef.current = Date.now() + 450;
      onJumpHandled?.(pendingJump.id);
      setPendingJump(null);
    });
  }, [months, pendingJump, onJumpHandled]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      if (Date.now() < programmaticScrollLockUntilRef.current) return;
      if (pendingJump) return;
      if (!months.length) return;
      const topGap = scroller.scrollTop;
      const bottomGap = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);

      if (topGap < 120 && !prependingRef.current) {
        prependingRef.current = true;
        const before = scroller.scrollHeight;
        setMonths((prev) => {
          const first = prev[0];
          return [addMonths(first, -1), ...prev];
        });
        requestAnimationFrame(() => {
          const after = scroller.scrollHeight;
          scroller.scrollTop += Math.max(0, after - before);
          prependingRef.current = false;
        });
      }

      if (bottomGap < 120 && !appendingRef.current) {
        appendingRef.current = true;
        setMonths((prev) => {
          const last = prev[prev.length - 1];
          return [...prev, addMonths(last, 1)];
        });
        requestAnimationFrame(() => {
          appendingRef.current = false;
        });
      }
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [months, pendingJump]);

  if (!project) {
    return <EmptyState>작품을 선택하세요.</EmptyState>;
  }

  if (participants.length && !visibleParticipants.length) {
    return <EmptyState>표시 중인 참여 작가가 없습니다. 눈 아이콘을 켜주세요.</EmptyState>;
  }

  const visibleSet = new Set(visibleParticipants.map((participant) => participant.id));
  const sourceTasks = tasks.filter((task) => visibleSet.has(task.participant_id));
  const selectedRange = useMemo(() => {
    if (!dragRange?.active) return null;
    return normalizeRange(dragRange.start, dragRange.end);
  }, [dragRange]);
  const monthList = useMemo(() => months.map((item) => monthMeta(item)), [months]);
  const today = ISO(new Date());

  return (
    <div ref={scrollRef} className="month-scroll-v2">
      {monthList.map((meta) => (
        <section
          key={meta.key}
          className="month-block-v2"
          ref={(node) => {
            if (!node) {
              monthRefs.current.delete(meta.key);
            } else {
              monthRefs.current.set(meta.key, node);
            }
          }}
        >
          <header className="month-block-head-v2">
            <h4>{meta.key}</h4>
          </header>

          <div className="month-v2">
            <div className="month-weekdays-v2">
              {WEEKDAYS.map((day) => (
                <div key={day} className="month-weekday-v2">
                  {day}
                </div>
              ))}
            </div>

            <div className="month-grid-v2">
              {Array.from({ length: meta.firstOffset }).map((_, idx) => (
                <div key={`${meta.key}-ghost-${idx}`} className="month-cell-v2 ghost" />
              ))}

              {Array.from({ length: meta.days }, (_, idx) => {
                const dateNumber = idx + 1;
                const date = `${meta.year}-${String(meta.month + 1).padStart(2, "0")}-${String(dateNumber).padStart(2, "0")}`;

                const events = monthEventsForDate(sourceTasks, date);
                const clipped = events.slice(0, 5);
                const isInSelectedRange = Boolean(
                  selectedRange && selectedRange.start <= date && date <= selectedRange.end
                );

                return (
                  <div
                    key={date}
                    ref={date === today ? todayRef : null}
                    data-date={date}
                    className={`month-cell-v2 ${isInSelectedRange ? "range-active" : ""}`}
                    onDragOver={(event) => {
                      if (!dragParticipantId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(event) => {
                      const participantId =
                        event.dataTransfer.getData("application/x-participant-id") || dragParticipantId;
                      if (!participantId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onDropParticipant?.(
                        participantId,
                        date,
                        buildMonthInlineAnchor(scrollRef.current, date, {
                          x: event.clientX,
                          y: event.clientY,
                        })
                      );
                    }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      if (event.target.closest(".month-task-v2")) return;
                      setDragRange({ active: true, start: date, end: date });
                    }}
                    onPointerEnter={() => {
                      setDragRange((prev) => (prev?.active ? { ...prev, end: date } : prev));
                    }}
                  >
                    <div className="month-cell-head-v2">
                      <span className="day-num">{dateNumber}일</span>
                      {timelineReleaseLabel(date, serializationMap) && (
                        <span className="release-inline">{timelineReleaseLabel(date, serializationMap)}</span>
                      )}
                    </div>

                    {events.length > 0 && (
                      <div className="month-list-v2">
                        {clipped.map(({ task, point }) => {
                          const deadline = deadlineSignal(task, today);
                          const normalizedStatus = normalizeTaskStatus(task.status);
                          const visualStatus = getStatusVisualKey(normalizedStatus);
                          return (
                            <button
                              key={`${date}_${task.id}_${point?.kind || "point"}`}
                              type="button"
                              className={`month-task-v2 tone-${pointTone(point)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTask(task.id);
                              }}
                              title={pointLabel(point)}
                            >
                              <div className="line-top">
                                <span className="episode-text">{formatEpisodeLabel(task.episode_no)}</span>
                                <span className="task-strong">{task.type || "-"}</span>
                                <span className="line-spacer" />
                                <span className={`month-status-chip status-${visualStatus}`}>
                                  {getLabelStatus(normalizedStatus)}
                                </span>
                              </div>
                              <div className="line-bottom">
                                <span className="writer-muted">{writerName(task.writer_id)}</span>
                                <span className="line-spacer" />
                                {deadline?.label && <span className={`chip ${deadline.tone}`}>{deadline.label}</span>}
                              </div>
                              <div className="line-note" />
                              <div className="month-hover-actions">
                                <select
                                  className="month-inline-status ui-select"
                                  value={normalizedStatus}
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
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="month-mini-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleFeedback?.(task);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.stopPropagation();
                                      onToggleFeedback?.(task);
                                    }
                                  }}
                                >
                                  {needsTaskFeedback(task) ? "피드백 해제" : "피드백"}
                                </div>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="month-mini-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onMarkDone?.(task);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.stopPropagation();
                                      onMarkDone?.(task);
                                    }
                                  }}
                                >
                                  완료
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {events.length > clipped.length && (
                          <div className="more-mini">+{events.length - clipped.length}건 더 있음</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
