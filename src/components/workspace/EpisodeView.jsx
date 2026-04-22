import { useMemo, useState } from "react";
import {
  STATUS,
  WORK_TYPE_OPTIONS,
  getLabelStatus,
  getStatusVisualKey,
  isCompletedStatus,
  needsTaskFeedback,
  normalizeTaskStatus,
  todayIso,
} from "../../data";
import Button from "../ui/Button.jsx";
import { overdueDays, deadlineSignal } from "../../utils/workspace";
import { buildTaskSummary, formatEpisodeLabel } from "../../utils/taskPresentation.js";

const FIXED_PARTS = WORK_TYPE_OPTIONS;

function episodeKey(value) {
  return Number.isFinite(Number(value)) ? Number(value) : "미정";
}

function normalizeEpisodeQuery(value) {
  return String(value || "")
    .trim()
    .replace(/회차|화/g, "")
    .trim();
}

export default function EpisodeView({
  project,
  tasks,
  participants,
  writerName,
  serializationMap,
  onOpenTask,
  onCreateEpisode,
  onCreateAtCell,
  dragParticipantId,
  onDropParticipantAtCell,
  onSetStatus,
}) {
  const todayValue = todayIso();
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [showCompletedEpisodes, setShowCompletedEpisodes] = useState(false);
  const hiddenSet = new Set(
    participants.filter((participant) => participant.hidden_from_ops).map((participant) => participant.id)
  );

  const source = tasks.filter((task) => !hiddenSet.has(task.participant_id));
  const configuredParts =
    Array.isArray(project?.episode_tracking_types) && project.episode_tracking_types.length
      ? project.episode_tracking_types
      : FIXED_PARTS;
  const parts = [
    ...configuredParts,
    ...Array.from(new Set(source.map((task) => task.type).filter((type) => type && !FIXED_PARTS.includes(type)))),
  ];

  const allEpisodes = useMemo(
    () =>
      Array.from(new Set(source.map((task) => episodeKey(task.episode_no)))).sort((a, b) => {
        const av = a === "미정" ? Number.MAX_SAFE_INTEGER : Number(a);
        const bv = b === "미정" ? Number.MAX_SAFE_INTEGER : Number(b);
        return av - bv;
      }),
    [source]
  );
  const numericEpisodes = allEpisodes.filter((episode) => episode !== "미정");
  const nextEpisodeNo = numericEpisodes.length
    ? Math.max(...numericEpisodes.map((episode) => Number(episode))) + 1
    : 1;
  const normalizedQuery = normalizeEpisodeQuery(episodeQuery);
  const shouldShowPlaceholderEpisode = source.length === 0 && !normalizedQuery;
  const episodes = allEpisodes.filter((episode) => {
    const episodeTasks = source.filter((task) => episodeKey(task.episode_no) === episode);
    const isCompletedEpisode =
      episodeTasks.length > 0 && episodeTasks.every((task) => isCompletedStatus(task.status));
    if (!showCompletedEpisodes && isCompletedEpisode) return false;
    if (!normalizedQuery) return true;
    const episodeLabel = episode === "미정" ? "미정" : `${episode}회차`;
    return episodeLabel.includes(normalizedQuery) || String(episode).includes(normalizedQuery);
  });
  const displayEpisodes = shouldShowPlaceholderEpisode ? [nextEpisodeNo] : episodes;

  return (
    <div className="episode-v2">
      <div className="episode-toolbar-v2">
        <div className="episode-toolbar-left">
          <div className="episode-tip-v2">카드를 열면 상세를 보고 상태를 바로 바꿀 수 있습니다.</div>
          <div className="episode-toolbar-meta">기본값은 완료된 회차 숨김입니다.</div>
        </div>
        <div className="episode-toolbar-actions">
          <input
            className="episode-search-input ui-input"
            type="text"
            placeholder="회차 검색"
            value={episodeQuery}
            onChange={(event) => setEpisodeQuery(event.target.value)}
          />
          <Button size="sm" active={showCompletedEpisodes} onClick={() => setShowCompletedEpisodes((prev) => !prev)}>
            완료 회차 보기
          </Button>
          <Button size="sm" onClick={() => onCreateEpisode?.(nextEpisodeNo)}>
            + 회차 추가
          </Button>
        </div>
      </div>

      {episodes.length === 0 && source.length > 0 ? (
        <div className="empty">조건에 맞는 회차가 없습니다.</div>
      ) : (
        <div className="episode-table-wrap-v2">
          <table className="episode-table-v2">
            <thead>
              <tr>
                <th className="ep-col">회차</th>
                {parts.map((part) => (
                  <th key={part}>{part}</th>
                ))}
                <th className="sum-col">요약</th>
              </tr>
            </thead>
            <tbody>
              {displayEpisodes.map((episode) => {
                const episodeTasks = source.filter((task) => episodeKey(task.episode_no) === episode);
                const done = episodeTasks.filter((task) => isCompletedStatus(task.status)).length;
                const delayed = episodeTasks.filter((task) => overdueDays(task) > 0).length;
                const pendingFeedback = episodeTasks.filter((task) => needsTaskFeedback(task)).length;
                const isPlaceholderRow = shouldShowPlaceholderEpisode && episode === nextEpisodeNo;

                return (
                  <tr key={String(episode)}>
                    <td className="ep-col">
                      <strong>{episode === "미정" ? "미정" : `${episode}회차`}</strong>
                      {episode !== "미정" && !isPlaceholderRow && (
                        <div className="episode-serial-date">
                          {serializationMap?.byEpisode?.get?.(Number(episode)) || "-"}
                        </div>
                      )}
                      {isPlaceholderRow && <div className="episode-serial-date">첫 작업을 배치하세요</div>}
                    </td>

                    {parts.map((part) => {
                      const cellTasks = episodeTasks
                        .filter((task) => task.type === part)
                        .sort((a, b) =>
                          String(b.approved_at || b.ce || b.pe || "").localeCompare(
                            String(a.approved_at || a.ce || a.pe || "")
                          )
                        );

                      const latest = cellTasks[0];
                      if (!latest) {
                        return (
                          <td
                            key={part}
                            className="episode-cell-empty"
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
                              onDropParticipantAtCell?.(
                                {
                                  participantId,
                                  episodeNo: episode === "미정" ? null : Number(episode),
                                  part,
                                },
                                { x: event.clientX, y: event.clientY }
                              );
                            }}
                            onClick={(event) =>
                              onCreateAtCell?.(
                                {
                                  episodeNo: episode === "미정" ? null : Number(episode),
                                  part,
                                },
                                { x: event.clientX, y: event.clientY }
                              )
                            }
                          >
                            <div className="empty-mini">작업 없음</div>
                          </td>
                        );
                      }

                      const deadline = deadlineSignal(latest, todayValue);
                      const scheduleText = `${latest.cs || "-"} ~ ${latest.ce || "-"}`;
                      const normalizedStatus = normalizeTaskStatus(latest.status);
                      const visualStatus = getStatusVisualKey(normalizedStatus);

                      return (
                        <td
                          key={part}
                          className="episode-cell-filled"
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
                            onDropParticipantAtCell?.(
                              {
                                participantId,
                                episodeNo: episode === "미정" ? null : Number(episode),
                                part,
                              },
                              { x: event.clientX, y: event.clientY }
                            );
                          }}
                          onDoubleClick={(event) =>
                            onCreateAtCell?.(
                              {
                                episodeNo: episode === "미정" ? null : Number(episode),
                                part,
                              },
                              { x: event.clientX, y: event.clientY }
                            )
                          }
                        >
                          <div
                            className={`ep-cell-v2 status-${visualStatus}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenTask(latest.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onOpenTask(latest.id);
                              }
                            }}
                          >
                            <div className="title-row">
                              <span className="episode-text">{formatEpisodeLabel(latest.episode_no)}</span>
                              <span className="task-strong">{latest.type || "-"}</span>
                              <span className={`status-chip status-${visualStatus}`}>
                                {getLabelStatus(normalizedStatus)}
                              </span>
                            </div>
                            <div className="meta-row">
                              <span>{buildTaskSummary(latest)}</span>
                            </div>
                            <div className="meta-row">
                              <span className="writer-muted">{writerName(latest.writer_id)}</span>
                              <span>{deadline?.label || "-"}</span>
                            </div>
                            <div className="schedule-row">
                              <span className="label">일정:</span>
                              <span className="value">{scheduleText}</span>
                            </div>
                            <div className="actions status-row">
                              <span className="spacer" />
                              <select
                                className="episode-status-select ui-select"
                                value={normalizedStatus}
                                onClick={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => onSetStatus?.(latest.id, event.target.value)}
                              >
                                {STATUS.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className="sum-col">
                      <div className="ep-summary-v2">
                        {isPlaceholderRow ? (
                          <span className="chip tone-blue">드래그 또는 클릭으로 생성</span>
                        ) : (
                          <>
                            <span className="chip tone-blue">완료 {done}/{episodeTasks.length}</span>
                            <span className="chip tone-yellow">지연 {delayed}</span>
                            <span className="chip tone-red">피드백 {pendingFeedback}</span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
