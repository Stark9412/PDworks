import { useEffect, useState } from "react";
import { todayIso } from "../../data";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import ModalShell from "../ui/ModalShell.jsx";

function makeInitialForm(draft) {
  return {
    ended_at: draft?.ended_at || todayIso(),
    reason: draft?.reason || "",
  };
}

export default function ParticipantEndModal({
  open,
  draft,
  writerLabel,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => makeInitialForm(draft));

  useEffect(() => {
    if (!open) return;
    setForm(makeInitialForm(draft));
  }, [open, draft]);

  const canSubmit = Boolean(form.ended_at && form.reason.trim());

  return (
    <ModalShell
      open={open}
      title="참여 작가 종료"
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
                ended_at: form.ended_at,
                reason: form.reason.trim(),
              });
            }}
          >
            종료 처리
          </Button>
        </>
      }
    >
      <p className="helper-text">대상: {writerLabel || "-"}</p>

      <Field label="종료일">
        <input
          className="ui-input"
          type="date"
          value={form.ended_at}
          onChange={(event) => setForm((prev) => ({ ...prev, ended_at: event.target.value }))}
        />
      </Field>

      <Field label="종료 사유">
        <input
          className="ui-input"
          value={form.reason}
          placeholder="예: 일정 종료, 계약 종료"
          onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
        />
      </Field>
    </ModalShell>
  );
}
