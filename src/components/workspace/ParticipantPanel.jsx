import { useEffect, useMemo, useState } from "react";
import Panel from "../ui/Panel.jsx";
import Button from "../ui/Button.jsx";

const TABS = [
  ["active", "참여중"],
  ["ended", "종료"],
  ["replaced", "교체"],
];

export default function ParticipantPanel({
  participants,
  writerName,
  tasks,
  tab,
  onChangeTab,
  onCreateParticipant,
  focusParticipantId,
  setFocusParticipantId,
  toggleVisibility,
  reorderParticipants,
  enableTaskDrag = false,
  onTaskDragStart,
  onTaskDragEnd,
  onOpenEnd,
  onOpenReplace,
  onOpenEdit,
}) {
  const [drag, setDrag] = useState(null);

  const applySingleDragImage = (event) => {
    const card = event.currentTarget;
    if (!card?.cloneNode || !event.dataTransfer?.setDragImage) return;
    const ghost = card.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = `${card.getBoundingClientRect().width}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.94";
    ghost.style.margin = "0";
    ghost.classList.add("drag-ghost-card");
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 24, 18);
    setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 0);
  };

  useEffect(() => {
    if (!drag) return;

    const onMove = (event) => {
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest?.("[data-participant-id]");
      if (!hit) return;
      const targetId = hit.getAttribute("data-participant-id");
      if (!targetId || targetId === drag.sourceId) return;
      setDrag((prev) => (prev ? { ...prev, overId: targetId } : prev));
    };

    const onEnd = () => {
      if (drag.overId && drag.overId !== drag.sourceId) {
        reorderParticipants(drag.sourceId, drag.overId);
      }
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
    };
  }, [drag, reorderParticipants]);

  const list = useMemo(
    () => participants.filter((participant) => participant.status === tab),
    [participants, tab]
  );
  const currentTabLabel = TABS.find(([key]) => key === tab)?.[1] || "참여중";

  return (
    <Panel className="participant-panel">
      <header className="section-title-row">
        <h3>참여 작가</h3>
      </header>

      <div className="participant-toolbar">
        <div className="participant-status-fixed">{currentTabLabel} (상태)</div>
        <Button size="sm" onClick={() => onCreateParticipant?.()}>참여 작가 등록</Button>
      </div>

      <div className="tab-chips">
        <select
          className="participant-tab-select ui-select"
          value={tab}
          onChange={(event) => onChangeTab(event.target.value)}
        >
          {TABS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="participant-list">
        {list.length === 0 && <div className="empty">표시할 작가가 없습니다.</div>}

        {list.map((participant) => {
          const count = tasks.filter((task) => task.participant_id === participant.id).length;
          const selected = focusParticipantId === participant.id;
          const dragOver = tab === "active" && drag?.overId === participant.id;
          const dragging = tab === "active" && drag?.sourceId === participant.id;

          return (
            <article
              key={participant.id}
              data-participant-id={participant.id}
              draggable={tab === "active" && enableTaskDrag}
              className={[
                "participant-card",
                selected ? "selected" : "",
                dragOver ? "drag-over" : "",
                dragging ? "dragging" : "",
                tab !== "active" ? "no-drag" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (tab !== "active") return;
                setFocusParticipantId(selected ? null : participant.id);
              }}
              onDragStart={(event) => {
                if (!(tab === "active" && enableTaskDrag)) return;
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("application/x-participant-id", participant.id);
                applySingleDragImage(event);
                onTaskDragStart?.(participant.id);
              }}
              onDragEnd={() => {
                if (!(tab === "active" && enableTaskDrag)) return;
                onTaskDragEnd?.();
              }}
            >
              {tab === "active" && (
                <Button
                  type="button"
                  size="sm"
                  className="drag-handle"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDrag({ sourceId: participant.id, overId: null });
                  }}
                >
                  ⋮⋮
                </Button>
              )}

              <div className="participant-main">
                <div className="participant-head">
                  <strong>{writerName(participant.writer_id)}</strong>
                  <span>{participant.role}</span>
                </div>

                <div className="participant-sub">
                  작업 {count}건
                  {participant.ended_at ? ` · ${participant.ended_at}` : ""}
                </div>

                {(participant.fee_label || participant.rs_ratio != null) && (
                  <div className="participant-sub">
                    계약 {participant.fee_label || "-"} / RS {participant.rs_ratio ?? "-"}
                  </div>
                )}

                {participant.end_reason && (
                  <div className="participant-sub">사유: {participant.end_reason}</div>
                )}

                {tab === "active" && (
                  <div className="participant-actions">
                    <Button
                      type="button"
                      size="sm"
                      className="participant-eye-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleVisibility(participant.id);
                      }}
                    >
                      {participant.hidden_from_ops ? "표시" : "숨김"}
                    </Button>

                    <details
                      className="participant-more"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <summary className="participant-more-trigger">⋯</summary>
                      <div className="participant-more-menu">
                        <Button
                          type="button"
                          size="sm"
                          className="participant-ops-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenEdit?.(participant.id);
                          }}
                        >
                          수정
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          className="participant-ops-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenEnd?.(participant.id);
                          }}
                        >
                          종료
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          className="participant-ops-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenReplace?.(participant.id);
                          }}
                        >
                          교체
                        </Button>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
