import { useEffect, useMemo, useState } from "react";
import { WORK_TYPE_OPTIONS } from "../../data.js";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import DateRangeFields from "../ui/DateRangeFields.jsx";
import ModalShell from "../ui/ModalShell.jsx";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 7, label: "일" },
];

function initialForm(draft) {
  return {
    title: draft?.title || "",
    pd_id: draft?.pd_id || "",
    pd_name: draft?.pd_name || "",
    start_date: draft?.start_date || "",
    end_date: draft?.end_date || "",
    genre: draft?.genre || "",
    serialization_start_date: draft?.serialization_start_date || "",
    serialization_start_episode: Number.isFinite(Number(draft?.serialization_start_episode))
      ? Number(draft.serialization_start_episode)
      : 1,
    serialization_weekdays: Array.isArray(draft?.serialization_weekdays)
      ? draft.serialization_weekdays
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
      : [],
    serialization_hiatus_ranges: Array.isArray(draft?.serialization_hiatus_ranges)
      ? draft.serialization_hiatus_ranges
          .map((item) => {
            const start = item?.start ? String(item.start).slice(0, 10) : "";
            const end = item?.end ? String(item.end).slice(0, 10) : "";
            return { start, end };
          })
          .filter((item) => item.start || item.end)
      : [],
    episode_tracking_types: Array.isArray(draft?.episode_tracking_types)
      ? draft.episode_tracking_types.filter((item) => WORK_TYPE_OPTIONS.includes(item))
      : [...WORK_TYPE_OPTIONS],
  };
}

export default function ProjectFormModal({
  open,
  draft,
  currentUser,
  users = [],
  canAssignPd = false,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => initialForm(draft));

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(draft));
  }, [open, draft]);

  const pdOptions = useMemo(
    () =>
      users
        .filter((user) => user?.status === "active")
        .map((user) => ({
          id: user.id,
          name: user.name || user.email || "미지정",
        })),
    [users]
  );

  useEffect(() => {
    if (!open) return;
    setForm((prev) => {
      const fallbackPdId = draft?.pd_id || currentUser?.id || pdOptions[0]?.id || "";
      const fallbackPdName =
        draft?.pd_name ||
        pdOptions.find((item) => item.id === fallbackPdId)?.name ||
        currentUser?.name ||
        "";

      if (canAssignPd) {
        if (prev.pd_id && prev.pd_name) return prev;
        return { ...prev, pd_id: fallbackPdId, pd_name: fallbackPdName };
      }

      return {
        ...prev,
        pd_id: currentUser?.id || fallbackPdId,
        pd_name: currentUser?.name || fallbackPdName,
      };
    });
  }, [
    open,
    draft?.pd_id,
    draft?.pd_name,
    currentUser?.id,
    currentUser?.name,
    pdOptions,
    canAssignPd,
  ]);

  const isEdit = Boolean(draft?.id);
  const canSubmit = Boolean(form.title.trim());

  const toggleWeekday = (weekday) => {
    setForm((prev) => {
      const current = Array.isArray(prev.serialization_weekdays) ? prev.serialization_weekdays : [];
      const exists = current.includes(weekday);
      const next = exists ? current.filter((value) => value !== weekday) : [...current, weekday];
      return { ...prev, serialization_weekdays: next.sort((a, b) => a - b) };
    });
  };

  const toggleEpisodeTrackingType = (type) => {
    setForm((prev) => {
      const current = Array.isArray(prev.episode_tracking_types) ? prev.episode_tracking_types : [];
      const exists = current.includes(type);
      return {
        ...prev,
        episode_tracking_types: exists ? current.filter((item) => item !== type) : [...current, type],
      };
    });
  };

  return (
    <ModalShell
      open={open}
      title={isEdit ? "작품 수정" : "작품 등록"}
      onClose={onCancel}
      className="project-form-modal-shell"
      backdrop
      footer={
        <>
          <Button onClick={onCancel}>취소</Button>
          <Button
            active
            onClick={() => {
              if (!canSubmit) return;
              onSubmit({
                ...form,
                title: form.title.trim(),
                pd_id: form.pd_id || currentUser?.id || null,
                pd_name:
                  pdOptions.find((item) => item.id === form.pd_id)?.name ||
                  form.pd_name ||
                  currentUser?.name ||
                  "",
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                genre: form.genre.trim() || null,
                serialization_start_date: form.serialization_start_date || null,
                serialization_start_episode: Number.isFinite(Number(form.serialization_start_episode))
                  ? Math.max(1, Number(form.serialization_start_episode))
                  : 1,
                serialization_weekdays: Array.isArray(form.serialization_weekdays)
                  ? form.serialization_weekdays
                      .map((value) => Number(value))
                      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
                  : [],
                serialization_hiatus_ranges: Array.isArray(form.serialization_hiatus_ranges)
                  ? form.serialization_hiatus_ranges
                      .map((item) => {
                        const start = item?.start ? String(item.start).slice(0, 10) : null;
                        const end = item?.end ? String(item.end).slice(0, 10) : null;
                        if (!start || !end) return null;
                        return start <= end ? { start, end } : { start: end, end: start };
                      })
                      .filter(Boolean)
                  : [],
                episode_tracking_types: Array.isArray(form.episode_tracking_types)
                  ? form.episode_tracking_types.filter((item) => WORK_TYPE_OPTIONS.includes(item))
                  : [...WORK_TYPE_OPTIONS],
              });
            }}
          >
            {isEdit ? "수정 완료" : "등록"}
          </Button>
        </>
      }
    >
      <section className="form-block participant-result-block">
        <div className="form-block-head participant-block-head">
          <div>
            <h4>기본 정보</h4>
            <p className="helper-text">작품명, 담당 PD, 기간과 장르를 먼저 정리합니다.</p>
          </div>
        </div>

        <div className="split-2">
          <Field label="작품명">
            <input
              className="ui-input"
              value={form.title}
              placeholder="예: 바다의 시편"
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Field>

          <Field label="담당 PD">
            <select
              className="ui-select"
              value={form.pd_id}
              disabled={!canAssignPd}
              onChange={(event) => {
                const nextPd = pdOptions.find((item) => item.id === event.target.value) || null;
                setForm((prev) => ({
                  ...prev,
                  pd_id: event.target.value,
                  pd_name: nextPd?.name || prev.pd_name,
                }));
              }}
            >
              {pdOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <DateRangeFields
          startLabel="시작일"
          endLabel="종료일"
          startValue={form.start_date}
          endValue={form.end_date}
          onStartChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
          onEndChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
        />

        <Field label="장르">
          <input
            className="ui-input"
            value={form.genre}
            placeholder="예: 로맨스 판타지"
            onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
          />
        </Field>
      </section>

      <section className="form-block participant-filter-block">
        <div className="form-block-head participant-block-head">
          <div>
            <h4>연재 설정</h4>
            <p className="helper-text">연재 시작 기준과 휴재 구간, 회차별 추적 작업을 설정합니다.</p>
          </div>
        </div>

        <div className="split-2">
          <Field label="연재 시작일(1화 기준)">
            <input
              className="ui-input"
              type="date"
              value={form.serialization_start_date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, serialization_start_date: event.target.value || "" }))
              }
            />
          </Field>

          <Field label="연재 시작 회차">
            <input
              className="ui-input"
              type="number"
              min="1"
              value={form.serialization_start_episode}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  serialization_start_episode: event.target.value ? Number(event.target.value) : "",
                }))
              }
            />
          </Field>
        </div>

        <Field label="주간 연재 요일">
          <div className="project-weekday-picker">
            {WEEKDAY_OPTIONS.map((item) => {
              const active = form.serialization_weekdays.includes(item.value);
              return (
                <button
                  key={`wd_${item.value}`}
                  type="button"
                  className={`weekday-chip ${active ? "active" : ""}`}
                  onClick={() => toggleWeekday(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="휴재 기간">
          <div className="project-hiatus-list">
            {form.serialization_hiatus_ranges.map((range, idx) => (
              <div key={`hiatus_${idx}`} className="project-hiatus-row">
                <input
                  className="ui-input"
                  type="date"
                  value={range.start || ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      serialization_hiatus_ranges: prev.serialization_hiatus_ranges.map((item, itemIdx) =>
                        itemIdx === idx ? { ...item, start: event.target.value || "" } : item
                      ),
                    }))
                  }
                />
                <span>~</span>
                <input
                  className="ui-input"
                  type="date"
                  value={range.end || ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      serialization_hiatus_ranges: prev.serialization_hiatus_ranges.map((item, itemIdx) =>
                        itemIdx === idx ? { ...item, end: event.target.value || "" } : item
                      ),
                    }))
                  }
                />
                <Button
                  size="sm"
                  className="danger"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      serialization_hiatus_ranges: prev.serialization_hiatus_ranges.filter(
                        (_, itemIdx) => itemIdx !== idx
                      ),
                    }))
                  }
                >
                  삭제
                </Button>
              </div>
            ))}

            <Button
              size="sm"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  serialization_hiatus_ranges: [
                    ...(Array.isArray(prev.serialization_hiatus_ranges)
                      ? prev.serialization_hiatus_ranges
                      : []),
                    { start: "", end: "" },
                  ],
                }))
              }
            >
              + 휴재 기간 추가
            </Button>
          </div>
        </Field>

        <Field label="회차 트래킹 작업 구분">
          <div className="project-weekday-picker">
            {WORK_TYPE_OPTIONS.map((item) => {
              const active = form.episode_tracking_types.includes(item);
              return (
                <button
                  key={`track_${item}`}
                  type="button"
                  className={`weekday-chip ${active ? "active" : ""}`}
                  onClick={() => toggleEpisodeTrackingType(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </Field>
      </section>
    </ModalShell>
  );
}
