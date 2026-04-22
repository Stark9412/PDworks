function formatEpisodeLabel(episodeNo) {
  const value = Number(episodeNo);
  if (!Number.isFinite(value) || value <= 0) return "미정";
  return `${value}회차`;
}

function buildTaskSummary(taskLike) {
  const episodeLabel = formatEpisodeLabel(taskLike?.episode_no);
  const typeLabel = String(taskLike?.type || "작업").trim() || "작업";
  return `${episodeLabel} ${typeLabel}`;
}

export {
  buildTaskSummary,
  formatEpisodeLabel,
};
