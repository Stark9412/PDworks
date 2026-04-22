import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Panel from "../ui/Panel.jsx";
import PdInputPanel from "./PdInputPanel.jsx";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import { getWeekTasks } from "./reviewWeekModel.js";

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getFridayAnchor(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 5 ? 0 : day < 5 ? 5 - day : 12 - day;
  return addDays(date, diff);
}

function getWeeklyRangeFromFriday(fridayDate) {
  const friday = new Date(fridayDate);
  const start = addDays(friday, -4);
  return {
    start: isoDate(start),
    end: isoDate(friday),
  };
}

export default function WeeklyReviewPage({ db, writerName, upsertWeeklyReport, currentUser }) {
  const [activeTab, setActiveTab] = useState("pd");
  const [fridayAnchor, setFridayAnchor] = useState(() => getFridayAnchor());

  const currentFriday = useMemo(() => getFridayAnchor(), []);
  const range = useMemo(() => getWeeklyRangeFromFriday(fridayAnchor), [fridayAnchor]);
  const visibleProjectIds = useMemo(() => new Set(db.projects.map((project) => project.id)), [db.projects]);
  const weekTasks = useMemo(
    () => getWeekTasks(db.tasks.filter((task) => visibleProjectIds.has(task.project_id)), range.start, range.end),
    [db.tasks, range.end, range.start, visibleProjectIds]
  );

  function moveWeek(offset) {
    setFridayAnchor((prev) => addDays(prev, offset * 7));
  }

  function moveToCurrentWeek() {
    setFridayAnchor(currentFriday);
  }

  return (
    <section className="review-page">
      <Panel title="주간보고서">
        <div className="wr-page-controls">
          <div className="wr-week-switcher">
            <Button type="button" size="sm" variant="default" onClick={() => moveWeek(-1)}>
              {"<"}
            </Button>
            <div className="wr-week-display">
              <strong>{range.start} ~ {range.end}</strong>
            </div>
            <Button type="button" size="sm" variant="default" onClick={() => moveWeek(1)}>
              {">"}
            </Button>
            <Button type="button" size="sm" variant="default" onClick={moveToCurrentWeek}>
              이번주
            </Button>
          </div>
        </div>

        <div className="wr-main-tabs">
          <button
            type="button"
            className={`wr-main-tab${activeTab === "pd" ? " selected" : ""}`}
            onClick={() => setActiveTab("pd")}
          >
            PD 입력
          </button>
          <button
            type="button"
            className={`wr-main-tab${activeTab === "executive" ? " selected" : ""}`}
            onClick={() => setActiveTab("executive")}
          >
            주간 보고서 현황
          </button>
        </div>
      </Panel>

      {activeTab === "pd" ? (
        <PdInputPanel
          db={db}
          weekTasks={weekTasks}
          weekStart={range.start}
          weekEnd={range.end}
          upsertWeeklyReport={upsertWeeklyReport}
          writerName={writerName}
          filterPdId={currentUser?.id || ""}
        />
      ) : null}

      {activeTab === "executive" ? (
        <ExecutiveDashboard
          db={db}
          weekTasks={weekTasks}
          weekStart={range.start}
          writerName={writerName}
        />
      ) : null}
    </section>
  );
}
