import { useMemo, useState } from "react";
import {
  STATUS,
  getLabelStatus,
  needsTaskFeedback,
  normalizeEpisodeNo,
  normalizeTaskStatus,
} from "../../data";
import Button from "../ui/Button.jsx";
import DateRangeFields from "../ui/DateRangeFields.jsx";
import Field from "../ui/Field.jsx";
import FormBlock from "../ui/FormBlock.jsx";
import { deadlineSignal } from "../../utils/workspace";
import { resolveTaskSerializationDate } from "../../utils/serialization.js";

const CHANGE_LABEL = {
  ps: "예정 시작",
  pe: "예정 종료",
  cs: "실행 시작",
  ce: "실행 종료",
  planned_range: "예정 일정",
  actual_range: "실행 일정",
};

const TYPO_HIDE_AFTER_DAYS = 7;

function formatChangeDate(value) {
  return String(value || "").slice(0, 16).replace("T", " ") || "-";
}

function formatChangeValue(change) {
  return `${change?.from_value || "-"} → ${change?.to_value || "-"}`;
}

export default function TaskDrawer({
  task,
  detailMode = "actual",
  scheduleChanges = [],
  serializationMap,
  onClose,
  onPatch,
  onToggleTypo,
  onDelete,
  onDeletePlan,
}) {
  const hasActual = Boolean(task.cs && task.ce);
  const hasPlanned = Boolean(task.ps && task.pe);
  const plannedOnly = detailMode === "planned" ? true : !hasActual;
  const deadline = deadlineSignal(task);
  const [showTypo, setShowTypo] = useState(false);
  const serializationDate = resolveTaskSerializationDate(task, serializationMap);

  const visibleChanges = useMemo(() => {
    if (showTypo) return scheduleChanges;
    return scheduleChanges.filter((change) => {
      if (!change.is_typo) return true;
      if (!change.typo_marked_at) return false;
      const diff = Date.now() - new Date(change.typo_marked_at).getTime();
      return diff < TYPO_HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    });
  }, [scheduleChanges, showTypo]);

  const latestChange = visibleChanges[0] || null;
  const hiddenChangeCount = Math.max(visibleChanges.length - 1, 0);

  return (
    <aside className="drawer">
      <header>
        <h3>{plannedOnly ? "예정 상세" : "작업 상세"}</h3>
        {deadline?.label && <span className={`chip ${deadline.tone}`}>{deadline.label}</span>}
        <Button onClick={onClose}>닫기</Button>
      </header>

      <div className="drawer-body">
        <Field label="회차">
          <input
            className="ui-input"
            type="number"
            min="1"
            value={task.episode_no || ""}
            onChange={(e) =>
              onPatch(
                task.id,
                { episode_no: normalizeEpisodeNo(e.target.value) },
                "drawer_episode_edit"
              )
            }
          />
        </Field>

        <Field label="연재일">
          <input className="ui-input" type="date" value={serializationDate || ""} readOnly disabled />
        </Field>
        <div className="helper-text">프로젝트 연재 설정 기준으로 회차와 자동 연동됩니다.</div>

        <Field label="작업 상태">
          <select
            className="ui-select"
            value={normalizeTaskStatus(task.status)}
            onChange={(e) => onPatch(task.id, { status: e.target.value }, "drawer_status_edit")}
          >
            {STATUS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="예정 메모">
          <textarea
            className="ui-textarea"
            rows={3}
            value={task.planned_memo || ""}
            onChange={(e) => onPatch(task.id, { planned_memo: e.target.value }, "drawer_plan_memo_edit")}
          />
        </Field>

        <Field label="확인 일시">
          <input
            className="ui-input"
            type="datetime-local"
            value={String(task.approved_at || "").slice(0, 16)}
            onChange={(e) =>
              onPatch(
                task.id,
                { approved_at: e.target.value ? new Date(e.target.value).toISOString() : null },
                "drawer_approved_at_edit"
              )
            }
          />
        </Field>

        {!plannedOnly && (
          <label className="ui-checkbox-wrap">
            <input
              className="ui-checkbox"
              type="checkbox"
              checked={Boolean(needsTaskFeedback(task))}
              onChange={() =>
                onPatch(
                  task.id,
                  { status: needsTaskFeedback(task) ? "submitted" : "feedback_requested", feedback_done: false },
                  "drawer_feedback_toggle"
                )
              }
            />
            <span className="ui-checkbox-label">피드백 필요</span>
          </label>
        )}

        <FormBlock title="실행 일정">
          <DateRangeFields
            startLabel="실행 시작"
            endLabel="실행 종료"
            startValue={task.cs || ""}
            endValue={task.ce || ""}
            onStartChange={(event) =>
              onPatch(task.id, { cs: event.target.value || null }, "drawer_actual_edit")
            }
            onEndChange={(event) =>
              onPatch(task.id, { ce: event.target.value || null }, "drawer_actual_edit")
            }
          />
        </FormBlock>

        <FormBlock title="예정 일정">
          <DateRangeFields
            startLabel="예정 시작"
            endLabel="예정 종료"
            startValue={task.ps || ""}
            endValue={task.pe || ""}
            onStartChange={(event) =>
              onPatch(task.id, { ps: event.target.value || null }, "drawer_plan_edit")
            }
            onEndChange={(event) =>
              onPatch(task.id, { pe: event.target.value || null }, "drawer_plan_edit")
            }
          />
        </FormBlock>

        <FormBlock title="일정 변경 기록">
          {!latestChange ? (
            <p className="helper-text">표시할 변경 기록이 없습니다.</p>
          ) : (
            <>
              <div className="history-item compact">
                <div className="history-meta">
                  <strong>{CHANGE_LABEL[latestChange.change_type] || latestChange.change_type}</strong>
                  <span>{formatChangeDate(latestChange.changed_at)}</span>
                </div>
                <div className="history-values">
                  <code>{formatChangeValue(latestChange)}</code>
                </div>
              </div>

              <div className="helper-text">
                최근 변경 1건만 표시합니다.
                {hiddenChangeCount > 0 ? ` 숨겨진 기록 ${hiddenChangeCount}건` : ""}
              </div>

              <details>
                <summary>전체 기록 보기 ({visibleChanges.length}건)</summary>
                <div className="history-head" style={{ marginTop: 12 }}>
                  <div className="helper-text">오기입은 기본 숨김입니다.</div>
                  <Button onClick={() => setShowTypo((prev) => !prev)}>
                    {showTypo ? "오기입 제외" : "오기입 포함"}
                  </Button>
                </div>

                <div className="history-list">
                  {visibleChanges.map((change) => (
                    <div key={change.id} className="history-item">
                      <div className="history-meta">
                        <strong>{CHANGE_LABEL[change.change_type] || change.change_type}</strong>
                        <span>
                          {formatChangeDate(change.changed_at)}
                          {change.source ? ` · ${change.source}` : ""}
                        </span>
                      </div>

                      <div className="history-values">
                        <code>{change.from_value || "-"}</code>
                        <span>→</span>
                        <code>{change.to_value || "-"}</code>
                      </div>

                      <div className="history-actions">
                        {change.is_typo && <span className="chip tone-yellow">오기입</span>}
                        <Button onClick={() => onToggleTypo?.(change.id)}>
                          {change.is_typo ? "오기입 해제" : "오기입 표시"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </FormBlock>

        <div className="row gap-8">
          {hasPlanned && (
            <Button className="danger" onClick={() => onDeletePlan?.(task)}>
              예정 삭제
            </Button>
          )}
          <Button className="danger" onClick={() => onDelete(task.id)}>
            작업 삭제
          </Button>
        </div>
      </div>

      <footer className="drawer-foot">
        {getLabelStatus(task.status)}
        {deadline?.label ? ` · ${deadline.label}` : ""}
      </footer>
    </aside>
  );
}
