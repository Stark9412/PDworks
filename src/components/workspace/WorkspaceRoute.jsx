import { useEffect } from "react";
import WorkspaceShell from "./WorkspaceShell.jsx";
import WorkspaceOverlays from "./WorkspaceOverlays.jsx";

export default function WorkspaceRoute({
  db,
  writerName,
  patchTask,
  toggleVisibility,
  reorderParticipants,
  toggleScheduleChangeTypo,
  controller,
  derived,
  actions,
}) {
  useEffect(() => {
    controller.setCreateDraft(null);
    controller.setTaskId(null);
    controller.setDragParticipantId(null);
  }, [controller.mode, controller.projectId]);

  return (
    <>
      <WorkspaceShell
        db={db}
        writerName={writerName}
        patchTask={patchTask}
        toggleVisibility={toggleVisibility}
        reorderParticipants={reorderParticipants}
        toggleScheduleChangeTypo={toggleScheduleChangeTypo}
        controller={controller}
        derived={derived}
        actions={actions}
      />

      <WorkspaceOverlays
        projectDraft={controller.projectDraft}
        setProjectDraft={controller.setProjectDraft}
        submitProjectForm={actions.submitProjectForm}
        participantDraft={controller.participantDraft}
        setParticipantDraft={controller.setParticipantDraft}
        db={db}
        submitParticipantForm={actions.submitParticipantForm}
        participantEndDraft={controller.participantEndDraft}
        setParticipantEndDraft={controller.setParticipantEndDraft}
        writerName={writerName}
        participantMap={derived.participantMap}
        submitParticipantEnd={actions.submitParticipantEnd}
        participantReplaceDraft={controller.participantReplaceDraft}
        setParticipantReplaceDraft={controller.setParticipantReplaceDraft}
        submitParticipantReplace={actions.submitParticipantReplace}
        createDraft={controller.createDraft}
        setCreateDraft={controller.setCreateDraft}
        setDragParticipantId={controller.setDragParticipantId}
        activeParticipants={derived.activeParticipants}
        typeOptions={derived.typeOptions}
        serializationMap={derived.serializationMap}
        submitTaskCreate={actions.submitTaskCreate}
        selectedTask={derived.selectedTask}
        taskDrawerMode={controller.taskDrawerMode}
        selectedTaskChanges={derived.selectedTaskChanges}
        setTaskId={controller.setTaskId}
        applyTaskPatch={actions.applyTaskPatch}
        toggleScheduleChangeTypo={toggleScheduleChangeTypo}
        handleDeleteTask={actions.handleDeleteTask}
      />
    </>
  );
}
