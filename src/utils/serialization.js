import { diffDays } from "../data.js";
import { ISO } from "./workspace.js";

const DAY_MS = 86400000;

function toIso(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  return new Date(`${String(value).slice(0, 10)}T00:00:00`);
}

function toMondayFirstWeekday(dateValue) {
  const jsDay = toDate(dateValue)?.getDay?.() ?? 0;
  return jsDay === 0 ? 7 : jsDay;
}

function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) return [];
  return Array.from(
    new Set(
      weekdays
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7)
    )
  ).sort((a, b) => a - b);
}

function normalizeHiatusRanges(ranges) {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .map((item) => {
      const start = toIso(item?.start);
      const end = toIso(item?.end);
      if (!start || !end) return null;
      return start <= end ? { start, end } : { start: end, end: start };
    })
    .filter(Boolean);
}

function isInHiatus(dateIso, hiatusRanges) {
  return hiatusRanges.some((range) => range.start <= dateIso && dateIso <= range.end);
}

function serializeConfig(project) {
  return {
    weekdays: normalizeWeekdays(project?.serialization_weekdays),
    startDate: toIso(project?.serialization_start_date),
    startEpisode: Number.isFinite(Number(project?.serialization_start_episode))
      ? Number(project.serialization_start_episode)
      : 1,
    hiatusRanges: normalizeHiatusRanges(project?.serialization_hiatus_ranges),
  };
}

function buildSerializationMap(project, maxEpisode) {
  const config = serializeConfig(project);
  if (!config.startDate || !config.weekdays.length) {
    return { byEpisode: new Map(), byDate: new Map(), config };
  }

  const targetEpisode = Math.max(config.startEpisode, Number(maxEpisode) || config.startEpisode);
  const byEpisode = new Map();
  const byDate = new Map();

  let cursor = toDate(config.startDate);
  let episode = config.startEpisode;
  let guard = 0;

  const pushEpisode = (dateIso, episodeNo) => {
    byEpisode.set(episodeNo, dateIso);
    if (!byDate.has(dateIso)) byDate.set(dateIso, episodeNo);
  };

  pushEpisode(config.startDate, episode);

  while (episode < targetEpisode && guard < 5000) {
    guard += 1;
    cursor = new Date(cursor.getTime() + DAY_MS);
    const dayIso = ISO(cursor);
    const weekday = toMondayFirstWeekday(cursor);
    if (!config.weekdays.includes(weekday)) continue;
    if (isInHiatus(dayIso, config.hiatusRanges)) continue;
    episode += 1;
    pushEpisode(dayIso, episode);
  }

  return { byEpisode, byDate, config };
}

function resolveTaskSerializationDate(task, serializationMap) {
  const episodeNo = Number(task?.episode_no);
  if (!Number.isFinite(episodeNo)) return null;
  return serializationMap?.byEpisode?.get(episodeNo) || null;
}

function taskSerializationDday(task, serializationMap, todayIso) {
  const target = resolveTaskSerializationDate(task, serializationMap);
  if (!target) return null;
  const delta = diffDays(todayIso, target);
  return {
    date: target,
    delta,
    label: delta > 0 ? `D-${delta}` : delta < 0 ? `D+${Math.abs(delta)}` : "D-Day",
  };
}

function timelineReleaseLabel(dateIso, serializationMap) {
  const episodeNo = serializationMap?.byDate?.get?.(dateIso);
  if (!Number.isFinite(Number(episodeNo))) return null;
  return `연재 ${Number(episodeNo)}화`;
}

export {
  buildSerializationMap,
  resolveTaskSerializationDate,
  serializeConfig,
  taskSerializationDday,
  timelineReleaseLabel,
};
