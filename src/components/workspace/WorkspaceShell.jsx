import { useState } from "react";
import Button from "../ui/Button.jsx";
import Panel from "../ui/Panel.jsx";
import ParticipantPanel from "./ParticipantPanel.jsx";
import TimelineView from "./TimelineView.jsx";
import MonthView from "./MonthView.jsx";
import KanbanView from "./KanbanView.jsx";
import KanbanArchiveOverlay from "./KanbanArchiveOverlay.jsx";
import EpisodeView from "./EpisodeView.jsx";
import WorkspaceHeader from "./WorkspaceHeader.jsx";
import { buildWorkspaceTaskOps, cursorMonthLabel, statusLabel } from "./workspaceShellHelpers.js";

const MONTH_BUTTONS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function WorkspaceShell({
  db,
  writerName,
  toggleVisibility,
  reorderParticipants,
  controller,
  derived,
  actions,
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const project = derived.project;
  const tasks = derived.visibleTasks;
  const { updateStatus, toggleFeedback, markDone } = buildWorkspaceTaskOps({ derived, actions });

  const monthJump = (month) => {
    controller.setMonthJumpTarget({
      id: `jump_month_${Date.now()}_${month}`,
      year: controller.monthJumpYear,
      month,
    });
  };

  const renderViewControls = () => {
    if (controller.mode === "month") {
      return (
        <div className="month-nav-v2">
          <div className="month-nav-left">
            <div className="month-year-nav">
              <Button size="sm" onClick={() => controller.shiftMonthJumpYear(-1)}>
                {"<"}
              </Button>
              <div className="month-jump-year">{controller.monthJumpYear}년</div>
              <Button size="sm" onClick={() => controller.shiftMonthJumpYear(1)}>
                {">"}
              </Button>
            </div>
            <div className="month-jump-row">
              {MONTH_BUTTONS.map((month) => (
                <Button key={`month-${month}`} size="sm" onClick={() => monthJump(month)}>
                  {month}
                </Button>
              ))}
            </div>
          </div>
          <Button size="sm" className="month-today-btn" onClick={controller.moveToToday}>
            오늘
          </Button>
        </div>
      );
    }

    if (controller.mode === "timeline") {
      return (
        <div className="period-nav">
          <Button size="sm" onClick={() => controller.shiftTimeline(-1)}>
            {"<"}
          </Button>
          <span className="period-nav-label">{cursorMonthLabel(controller.cursor)}</span>
          <Button size="sm" onClick={() => controller.shiftTimeline(1)}>
            {">"}
          </Button>
          <Button size="sm" onClick={controller.moveToToday}>
            오늘
          </Button>
          <Button size="sm" onClick={controller.moveTimelineToStart}>
            전체
          </Button>
        </div>
      );
    }

    if (controller.mode === "kanban") {
      return (
        <div className="period-nav">
          <Button size="sm" onClick={() => setArchiveOpen(true)}>
            최종보관
          </Button>
        </div>
      );
    }

    return (
      <div className="period-nav">
      </div>
    );
  };

  const renderView = () => {
    if (controller.mode === "timeline") {
      return (
        <TimelineView
          participants={derived.activeParticipants}
          visibleParticipants={derived.visibleParticipants}
          tasks={tasks}
          writerName={writerName}
          range={derived.timelineRange}
          focusParticipantId={controller.focusParticipantId}
          selectedTaskId={controller.taskId}
          typeOptions={derived.typeOptions}
          onOpenTask={(taskId) => actions.openTaskDrawer(taskId, "actual")}
          onInlineCreateTask={actions.submitInlineTimelineTask}
          onPatchTask={(taskId, patch, source) => actions.applyTaskPatch(taskId, patch, "", source)}
          onDeleteTask={actions.handleDeleteTask}
          onToggleFeedbackDone={(task) => toggleFeedback(task.id)}
          onMarkDone={(task) => markDone(task.id)}
          onSetStatus={updateStatus}
          serializationMap={derived.serializationMap}
          navCommand={controller.timelineNavCommand}
          onNavHandled={() => controller.setTimelineNavCommand(null)}
          onEnsureDateInRange={controller.ensureDateInTimelineWindow}
          onEdgeExtend={controller.extendTimelineWindow}
          windowAdjust={controller.timelineWindowAdjust}
          onWindowAdjustHandled={() => controller.setTimelineWindowAdjust(null)}
        />
      );
    }

    if (controller.mode === "month") {
      return (
        <MonthView
          project={project}
          participants={derived.activeParticipants}
          visibleParticipants={derived.visibleParticipants}
          tasks={tasks}
          writerName={writerName}
          serializationMap={derived.serializationMap}
          onOpenTask={(taskId) => actions.openTaskDrawer(taskId, "actual")}
          onCreateAtDate={(date, anchor) =>
            actions.openTaskCreate({
              status: "planned",
              date,
              inline: true,
              anchor,
              heading: `${date} 예정 생성`,
            })
          }
          onCreateRange={(startDate, endDate, anchor) =>
            actions.openTaskCreate({
              status: "planned",
              startDate,
              endDate,
              inline: true,
              anchor,
              heading: `${startDate} ~ ${endDate} 예정 생성`,
            })
          }
          onSetStatus={updateStatus}
          onToggleFeedback={(task) => toggleFeedback(task.id)}
          onMarkDone={(task) => markDone(task.id)}
          dragParticipantId={controller.dragParticipantId}
          onDropParticipant={(participantId, date, anchor) =>
            actions.openTaskCreate({
              participantId,
              status: "planned",
              date,
              inline: true,
              anchor,
              heading: `${date} 예정 생성`,
            })
          }
          focusTodayToken={controller.monthFocusTodayToken}
          jumpTarget={controller.monthJumpTarget}
          onJumpHandled={() => controller.setMonthJumpTarget(null)}
        />
      );
    }

    if (controller.mode === "kanban") {
      return (
        <KanbanView
          tasks={tasks}
          participants={derived.activeParticipants}
          writerName={writerName}
          serializationMap={derived.serializationMap}
          focusParticipantId={controller.focusParticipantId}
          dragParticipantId={controller.dragParticipantId}
          onOpenTask={(taskId) => actions.openTaskDrawer(taskId, "actual")}
          onCreateAtStatus={(status, event) =>
            actions.openTaskCreate({
              status,
              inline: true,
              anchor:
                event && Number.isFinite(Number(event.clientX)) && Number.isFinite(Number(event.clientY))
                  ? { x: event.clientX, y: event.clientY }
                  : null,
              heading: `${statusLabel(status)} 작업 생성`,
            })
          }
          onMoveTaskStatus={(taskId, status) => updateStatus(taskId, status, "kanban_drag")}
          onClickStatusChange={(taskId, status) => updateStatus(taskId, status, "kanban_click")}
          onDropParticipant={(participantId, status, anchor) =>
            actions.openTaskCreate({
              participantId,
              status,
              inline: true,
              anchor,
              heading: `${statusLabel(status)} 작업 생성`,
            })
          }
          onArchiveTask={actions.archiveTask}
        />
      );
    }

    return (
      <EpisodeView
        project={project}
        tasks={tasks}
        participants={derived.activeParticipants}
        writerName={writerName}
        serializationMap={derived.serializationMap}
        onOpenTask={(taskId) => actions.openTaskDrawer(taskId, "actual")}
        onCreateEpisode={(episodeNo) =>
          actions.openTaskCreate({
            status: "planned",
            inline: true,
            episodeNo,
            type: "콘티",
            title: `${episodeNo}회차 콘티 작업`,
            heading: `${episodeNo}회차 첫 작업 생성`,
          })
        }
        onCreateAtCell={(cell, anchor) =>
          actions.openTaskCreate({
            status: "planned",
            inline: true,
            anchor,
            episodeNo: cell.episodeNo,
            type: cell.part,
            title: `${cell.episodeNo ? `${cell.episodeNo}회차 ` : ""}${cell.part} 작업`,
            heading: `${cell.episodeNo ? `${cell.episodeNo}회차` : "미정"} ${cell.part} 생성`,
          })
        }
        dragParticipantId={controller.dragParticipantId}
        onDropParticipantAtCell={(cell, anchor) =>
          actions.openTaskCreate({
            participantId: cell.participantId,
            status: "planned",
            inline: true,
            anchor,
            episodeNo: cell.episodeNo,
            type: cell.part,
            title: `${cell.episodeNo ? `${cell.episodeNo}회차 ` : ""}${cell.part} 작업`,
            heading: `${cell.episodeNo ? `${cell.episodeNo}회차` : "미정"} ${cell.part} 생성`,
          })
        }
        onSetStatus={updateStatus}
        onToggleFeedback={(task) => toggleFeedback(task.id)}
        onMarkDone={(task) => markDone(task.id)}
      />
    );
  };

  return (
    <section className="workspace">
      <WorkspaceHeader
        projectTitle={project?.title || ""}
        mode={controller.mode}
        setMode={controller.setMode}
        onEditProject={actions.openProjectEdit}
        onDeleteProject={actions.handleDeleteProject}
      />

      <div className="workspace-body">
        <ParticipantPanel
          participants={derived.participants}
          writerName={writerName}
          tasks={derived.tasks}
          tab={controller.participantTab}
          onChangeTab={controller.setParticipantTab}
          onCreateParticipant={actions.openParticipantCreate}
          focusParticipantId={controller.focusParticipantId}
          setFocusParticipantId={controller.setFocusParticipantId}
          toggleVisibility={toggleVisibility}
          reorderParticipants={(sourceId, targetId) => {
            if (!project?.id) return;
            reorderParticipants(project.id, sourceId, targetId);
          }}
          enableTaskDrag
          onTaskDragStart={controller.setDragParticipantId}
          onTaskDragEnd={() => controller.setDragParticipantId(null)}
          onOpenEdit={actions.openParticipantEdit}
          onOpenEnd={actions.openParticipantEnd}
          onOpenReplace={actions.openParticipantReplace}
        />

        <Panel className="workspace-view-panel">
          {renderViewControls()}
          <div className={`workspace-view workspace-view-${controller.mode}`}>{renderView()}</div>
        </Panel>
      </div>
      <KanbanArchiveOverlay
        open={archiveOpen}
        tasks={tasks}
        writerName={writerName}
        serializationMap={derived.serializationMap}
        onClose={() => setArchiveOpen(false)}
        onOpenTask={(taskId) => {
          setArchiveOpen(false);
          actions.openTaskDrawer(taskId, "actual");
        }}
        onRestoreTask={actions.restoreTask}
      />
    </section>
  );
}
