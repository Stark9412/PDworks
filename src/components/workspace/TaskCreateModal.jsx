import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import {
  STATUS,
  WORK_TYPE_OPTIONS,
  normalizeEpisodeNo,
  normalizeTaskStatus,
  normalizeWorkType,
} from "../../data";
import { createPortal } from "react-dom";
import Button from "../ui/Button.jsx";
import DateRangeFields from "../ui/DateRangeFields.jsx";
import Field from "../ui/Field.jsx";
import ModalShell from "../ui/ModalShell.jsx";
import { resolveTaskSerializationDate } from "../../utils/serialization.js";
import { buildTaskSummary } from "../../utils/taskPresentation.js";

const K_TASK = "작업";

function roleToTaskType(role = "", fallback = K_TASK) {
  return normalizeWorkType(role, fallback);
}

function buildInitialForm(draft, participants, typeOptions) {
  const fallbackParticipantId = participants[0]?.id || "";
  const selectedParticipant =
    participants.find((item) => item.id === (draft?.participant_id || fallbackParticipantId)) || null;
  const inferredType = roleToTaskType(
    selectedParticipant?.role,
    typeOptions[0] || WORK_TYPE_OPTIONS[0] || K_TASK
  );

  return {
    participant_id: draft?.participant_id || fallbackParticipantId,
    planned_memo: draft?.planned_memo || "",
    type: normalizeWorkType(draft?.type, inferredType),
    episode_no: normalizeEpisodeNo(draft?.episode_no),
    status: normalizeTaskStatus(draft?.status || "planned"),
    ps: draft?.ps || "",
    pe: draft?.pe || draft?.ps || "",
    cs: draft?.cs || "",
    ce: draft?.ce || "",
    feedback_done: Boolean(draft?.feedback_done),
  };
}

export default function TaskCreateModal({
  open,
  draft,
  participants,
  writerName,
  typeOptions,
  serializationMap,
  onCancel,
  onCreate,
}) {
  const [form, setForm] = useState(() => buildInitialForm(draft, participants, typeOptions));
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(draft, participants, typeOptions));
  }, [open, draft, participants, typeOptions]);

  const inlineMode = Boolean(draft?.inline);
  const monthPortalTarget =
    inlineMode &&
    draft?.anchor?.mode === "month" &&
    draft?.anchor?.container instanceof HTMLElement
      ? draft.anchor.container
      : null;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 900;
  const monthContainerRect = monthPortalTarget?.getBoundingClientRect?.() || null;
  const monthCellRect = draft?.anchor?.cellRect || null;
  const MODAL_WIDTH = 640;
  const MODAL_HEIGHT = 560;

  const panelStyle = inlineMode
    ? monthPortalTarget && monthContainerRect
      ? {
          position: "fixed",
          width: `min(${MODAL_WIDTH}px, calc(100vw - 32px))`,
          left: `${Math.max(
            16,
            Math.min(
              viewportW - MODAL_WIDTH - 16,
              (monthCellRect?.left || Number(draft?.anchor?.x || 24)) - 40
            )
          )}px`,
          top: `${(() => {
            const belowTop = (monthCellRect?.bottom || Number(draft?.anchor?.y || 120)) + 8;
            const aboveTop = (monthCellRect?.top || Number(draft?.anchor?.y || 120)) - MODAL_HEIGHT - 8;
            if (belowTop + MODAL_HEIGHT > viewportH - 16 && aboveTop > 72) {
              return Math.max(72, aboveTop);
            }
            return Math.max(72, belowTop);
          })()}px`,
          maxHeight: `min(${MODAL_HEIGHT}px, calc(100vh - 88px))`,
          zIndex: 1400,
        }
      : (() => {
          const anchorY = Number(draft?.anchor?.y || 120);
          const belowY = anchorY + 8;
          const aboveY = anchorY - MODAL_HEIGHT - 8;
          const topFixed = belowY + MODAL_HEIGHT > viewportH - 16 && aboveY > 72
            ? Math.max(72, aboveY)
            : Math.max(72, belowY);
          return {
            position: "fixed",
            width: `min(${MODAL_WIDTH}px, calc(100vw - 32px))`,
            left: `${Math.max(16, Math.min(viewportW - MODAL_WIDTH - 16, Number(draft?.anchor?.x || 24) - 40))}px`,
            top: `${topFixed}px`,
            maxHeight: `min(${MODAL_HEIGHT}px, calc(100vh - 88px))`,
            zIndex: 1400,
          };
        })()
    : null;

  useEffect(() => {
    if (!open || !inlineMode) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".inline-create-pop-global")) return;
      onCancel?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, inlineMode, onCancel]);


  const participantOptions = useMemo(
    () =>
      participants.map((participant) => ({
        id: participant.id,
        role: participant.role,
        label: `${writerName(participant.writer_id)} · ${participant.role}`,
      })),
    [participants, writerName]
  );

  const selectedParticipant = useMemo(
    () => participants.find((item) => item.id === form.participant_id) || null,
    [participants, form.participant_id]
  );

  const inferredTaskType = roleToTaskType(
    selectedParticipant?.role,
    typeOptions[0] || WORK_TYPE_OPTIONS[0] || K_TASK
  );
  const resolvedType = normalizeWorkType(form.type, inferredTaskType);
  const normalizedEpisodeNo = normalizeEpisodeNo(form.episode_no);
  const canSubmit = Boolean(form.participant_id && normalizedEpisodeNo);
  const heading = draft?.heading || "작업 생성";
  const scheduleMode = form.status === "in_progress" ? "actual" : "planned";
  const taskPreview = buildTaskSummary({ episode_no: normalizedEpisodeNo, type: resolvedType });
  const serializationDate = resolveTaskSerializationDate(
    { episode_no: normalizedEpisodeNo },
    serializationMap
  );
  const availableTypes = typeOptions?.length ? typeOptions : WORK_TYPE_OPTIONS;

  const modalNode = (
    <ModalShell
      open={open}
      title={heading}
      className={`task-create-compact-modal ${inlineMode ? "inline-create-pop-global" : ""}`}
      backdrop={!inlineMode}
      panelStyle={panelStyle}
      panelRef={panelRef}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>취소</Button>
          <Button
            active
            onClick={() => {
              if (!canSubmit) return;
              onCreate({
                ...form,
                type: resolvedType,
                episode_no: normalizedEpisodeNo,
                planned_memo: form.planned_memo.trim(),
                ps: form.ps || null,
                pe: form.pe || null,
                cs: form.cs || null,
                ce: form.ce || null,
              });
            }}
          >
            생성
          </Button>
        </>
      }
    >
      <div className="helper-text">{taskPreview}</div>

      <div className="split-2 compact-row">
        <Field label="참여 작가">
          <select
            className="ui-select"
            value={form.participant_id}
            onChange={(event) => setForm((prev) => ({ ...prev, participant_id: event.target.value }))}
          >
            {participantOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="작업 상태">
          <select
            className="ui-select"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: normalizeTaskStatus(event.target.value) }))}
          >
            {STATUS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="split-2 compact-row">
        <Field label="역할">
          <input className="ui-input" value={selectedParticipant?.role || "-"} readOnly />
        </Field>
        <Field label="작업구분">
          <select
            className="ui-select"
            value={resolvedType}
            onChange={(event) => setForm((prev) => ({ ...prev, type: normalizeWorkType(event.target.value, inferredTaskType) }))}
          >
            {availableTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="split-2 compact-row">
        <Field label="회차">
          <input
            className="ui-input"
            type="number"
            min="1"
            max="999"
            value={form.episode_no || ""}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                episode_no: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="연재일">
          <input className="ui-input" type="date" value={serializationDate || ""} readOnly disabled />
        </Field>
      </div>

      <Field label="예정 메모">
        <textarea
          className="ui-textarea"
          rows={3}
          value={form.planned_memo}
          onChange={(event) => setForm((prev) => ({ ...prev, planned_memo: event.target.value }))}
        />
      </Field>

      <div className="compact-range-block">
        <div className="compact-range-head">{scheduleMode === "actual" ? "실행 일정" : "예정 일정"}</div>
        <DateRangeFields
          startLabel={scheduleMode === "actual" ? "실행 시작" : "예정 시작"}
          endLabel={scheduleMode === "actual" ? "실행 종료" : "예정 종료"}
          startValue={scheduleMode === "actual" ? form.cs || "" : form.ps || ""}
          endValue={scheduleMode === "actual" ? form.ce || "" : form.pe || ""}
          onStartChange={(event) =>
            scheduleMode === "actual"
              ? setForm((prev) => ({ ...prev, cs: event.target.value || "" }))
              : setForm((prev) => ({ ...prev, ps: event.target.value || "" }))
          }
          onEndChange={(event) =>
            scheduleMode === "actual"
              ? setForm((prev) => ({ ...prev, ce: event.target.value || "" }))
              : setForm((prev) => ({ ...prev, pe: event.target.value || "" }))
          }
        />
      </div>
    </ModalShell>
  );

  return monthPortalTarget ? createPortal(modalNode, monthPortalTarget) : modalNode;
}
