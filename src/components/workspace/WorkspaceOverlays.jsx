import ProjectFormModal from "./ProjectFormModal.jsx";
import ParticipantFormModal from "./ParticipantFormModal.jsx";
import ParticipantEndModal from "./ParticipantEndModal.jsx";
import ParticipantReplaceModal from "./ParticipantReplaceModal.jsx";
import TaskCreateModal from "./TaskCreateModal.jsx";
import TaskDrawer from "./TaskDrawer.jsx";

export default function WorkspaceOverlays({
  projectDraft,
  setProjectDraft,
  submitProjectForm,
  participantDraft,
  setParticipantDraft,
  db,
  submitParticipantForm,
  participantEndDraft,
  setParticipantEndDraft,
  writerName,
  participantMap,
  submitParticipantEnd,
  participantReplaceDraft,
  setParticipantReplaceDraft,
  submitParticipantReplace,
  createDraft,
  setCreateDraft,
  setDragParticipantId,
  activeParticipants,
  typeOptions,
  serializationMap,
  submitTaskCreate,
  selectedTask,
  taskDrawerMode,
  selectedTaskChanges,
  setTaskId,
  applyTaskPatch,
  toggleScheduleChangeTypo,
  handleDeleteTask,
}) {
  const handleDeletePlan = (task) => {
    if (!task) return;
    const hasActual = Boolean(task.cs || task.ce);
    if (!hasActual) {
      handleDeleteTask(task.id);
      return;
    }
    applyTaskPatch(task.id, { ps: null, pe: null }, "예정을 삭제했습니다.", "drawer_plan_delete");
    setTaskId(null);
  };

  return (
    <>
      <ProjectFormModal
        open={Boolean(projectDraft?.id)}
        draft={projectDraft}
        onCancel={() => setProjectDraft(null)}
        onSubmit={submitProjectForm}
      />

      <ParticipantFormModal
        open={Boolean(participantDraft)}
        draft={participantDraft}
        db={db}
        writers={db.writers}
        onCancel={() => setParticipantDraft(null)}
        onSubmit={submitParticipantForm}
      />

      <ParticipantEndModal
        open={Boolean(participantEndDraft)}
        draft={participantEndDraft}
        writerLabel={writerName(participantMap.get(participantEndDraft?.participant_id)?.writer_id)}
        onCancel={() => setParticipantEndDraft(null)}
        onSubmit={submitParticipantEnd}
      />

      <ParticipantReplaceModal
        open={Boolean(participantReplaceDraft)}
        draft={participantReplaceDraft}
        currentWriterId={participantMap.get(participantReplaceDraft?.participant_id)?.writer_id || ""}
        currentWriterLabel={writerName(participantMap.get(participantReplaceDraft?.participant_id)?.writer_id)}
        writers={db.writers}
        onCancel={() => setParticipantReplaceDraft(null)}
        onSubmit={submitParticipantReplace}
      />

      <TaskCreateModal
        open={Boolean(createDraft)}
        draft={createDraft}
        participants={activeParticipants}
        writerName={writerName}
        typeOptions={typeOptions}
        serializationMap={serializationMap}
        onCancel={() => {
          setCreateDraft(null);
          setDragParticipantId(null);
        }}
        onCreate={submitTaskCreate}
      />

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          detailMode={taskDrawerMode}
          scheduleChanges={selectedTaskChanges}
          serializationMap={serializationMap}
          onClose={() => setTaskId(null)}
          onPatch={(taskIdValue, patch, source = "drawer_edit") =>
            applyTaskPatch(taskIdValue, patch, "", source)
          }
          onToggleTypo={toggleScheduleChangeTypo}
          onDelete={handleDeleteTask}
          onDeletePlan={handleDeletePlan}
        />
      )}
    </>
  );
}
