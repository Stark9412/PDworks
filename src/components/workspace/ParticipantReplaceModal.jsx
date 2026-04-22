import { useEffect, useMemo, useState } from "react";
import { todayIso } from "../../data";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import ModalShell from "../ui/ModalShell.jsx";

function initialForm(draft, options) {
  return {
    replaced_at: draft?.replaced_at || todayIso(),
    next_writer_id: draft?.next_writer_id || options[0]?.id || "",
    reason: draft?.reason || "교체",
  };
}

export default function ParticipantReplaceModal({
  open,
  draft,
  currentWriterId,
  currentWriterLabel,
  writers,
  onCancel,
  onSubmit,
}) {
  const candidates = useMemo(
    () =>
      writers
        .filter((writer) => writer.id !== currentWriterId)
        .map((writer) => ({
          id: writer.id,
          label: `${writer.name}${writer.pen_names?.length ? ` (${writer.pen_names.join(", ")})` : ""}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [writers, currentWriterId]
  );

  const [form, setForm] = useState(() => initialForm(draft, candidates));

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(draft, candidates));
  }, [open, draft, candidates]);

  const canSubmit = Boolean(form.replaced_at && form.next_writer_id);

  return (
    <ModalShell
      open={open}
      title="참여 작가 교체"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>취소</Button>
          <Button
            active
            onClick={() => {
              if (!canSubmit) return;
              onSubmit({
                participant_id: draft?.participant_id,
                replaced_at: form.replaced_at,
                next_writer_id: form.next_writer_id,
                reason: form.reason.trim() || "교체",
              });
            }}
          >
            교체 처리
          </Button>
        </>
      }
    >
      <p className="helper-text">기존 작가: {currentWriterLabel || "-"}</p>

      <Field label="교체일">
        <input
          className="ui-input"
          type="date"
          value={form.replaced_at}
          onChange={(event) => setForm((prev) => ({ ...prev, replaced_at: event.target.value }))}
        />
      </Field>

      <Field label="신규 작가">
        <select
          className="ui-select"
          value={form.next_writer_id}
          onChange={(event) => setForm((prev) => ({ ...prev, next_writer_id: event.target.value }))}
        >
          {candidates.length === 0 && <option value="">선택 가능한 작가 없음</option>}
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="교체 사유">
        <input
          className="ui-input"
          value={form.reason}
          onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
        />
      </Field>
    </ModalShell>
  );
}
