import { diffDays } from "../../../data.js";
import { ISO, addDays } from "../../../utils/workspace.js";

function buildTimelineRange(tasks, fallbackRange, projectStart, projectEnd) {
  const anchors = [];
  if (projectStart) anchors.push(projectStart);
  if (projectEnd) anchors.push(projectEnd);
  tasks.forEach((task) => {
    ["ps", "pe", "cs", "ce"].forEach((key) => {
      if (task[key]) anchors.push(task[key]);
    });
  });

  if (!anchors.length) return fallbackRange;

  let minDate = anchors[0];
  let maxDate = anchors[0];
  anchors.forEach((date) => {
    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;
  });

  const start = ISO(addDays(minDate, -2));
  const end = ISO(addDays(maxDate, 2));
  const span = Math.min(180, Math.max(7, diffDays(start, end) + 1));

  return {
    start,
    end: ISO(addDays(start, span - 1)),
    days: Array.from({ length: span }, (_, idx) => ISO(addDays(start, idx))),
  };
}

function monthStartIso(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return ISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEndIso(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return ISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addMonthsIso(value, months) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return ISO(new Date(date.getFullYear(), date.getMonth() + months, date.getDate()));
}

function buildRangeFromWindow(windowStart, windowEnd) {
  const start = ISO(windowStart);
  const end = ISO(windowEnd);
  const span = Math.max(1, diffDays(start, end) + 1);
  return {
    start,
    end,
    days: Array.from({ length: span }, (_, idx) => ISO(addDays(start, idx))),
  };
}

function taskErrorMessage(result, writerLabel) {
  if (!result || result.ok) return "";
  const rawMessage = String(result.message || result.error?.message || "");
  if (result.reason === "invalid_episode_no" || rawMessage.includes("tasks_episode_no_check")) {
    return "회차는 1 이상의 정수만 저장할 수 있습니다.";
  }
  if (rawMessage.includes("tasks_stage_def_id_fkey")) {
    return "작업 단계 정의가 현재 프로젝트와 맞지 않습니다. 작업구분을 다시 확인하세요.";
  }
  if (result.reason === "invalid_stage") {
    return "프로젝트 단계 정의를 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
  }
  if (result.reason === "invalid_participant") {
    return "참여 작가 연결이 유효하지 않습니다. 참여자 정보를 다시 확인하세요.";
  }
  if (result.reason === "invalid_actual_range") {
    return "실행 시작일이 종료일보다 늦을 수 없습니다.";
  }
  if (result.reason === "invalid_planned_range") {
    return "예정 시작일이 종료일보다 늦을 수 없습니다.";
  }
  if (result.reason === "schedule_conflict") {
    const lane = result.mode === "planned" ? "예정" : "실행";
    const conflict = result.conflict || {};
    const writer = writerLabel(conflict.writerId) || "익명";
    const range = conflict.start && conflict.end ? `${conflict.start} ~ ${conflict.end}` : "기존 일정";
    return `${lane} 일정이 겹칩니다. ${writer} · ${range}`;
  }
  return "일정 처리 중 오류가 발생했습니다.";
}

export {
  addMonthsIso,
  buildRangeFromWindow,
  buildTimelineRange,
  monthEndIso,
  monthStartIso,
  taskErrorMessage,
};
