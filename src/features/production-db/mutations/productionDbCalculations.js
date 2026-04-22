import { createChangeHistory, createProductionCost } from "../../../data.js";
import { ISO } from "../../../utils/workspace.js";

/**
 * Count tasks by type for a given team and project
 */
export function countTasksByType(tasks, projectId, teamId, type) {
  if (!tasks || !Array.isArray(tasks)) return 0;
  return tasks.filter(
    (task) =>
      task.project_id === projectId &&
      (!task.team_id || task.team_id === teamId) &&
      task.type === type &&
      !task.is_archived
  ).length;
}

/**
 * Get unique participants for a team
 */
export function getParticipantsByTeam(tasks, projectId, teamId) {
  if (!tasks || !Array.isArray(tasks)) return [];
  const participantIds = new Set();

  tasks.forEach((task) => {
    if (
      task.project_id === projectId &&
      (!task.team_id || task.team_id === teamId) &&
      !task.is_archived
    ) {
      if (task.writer_id) participantIds.add(task.writer_id);
      else if (task.participant_id) participantIds.add(task.participant_id);
    }
  });

  return Array.from(participantIds);
}

/**
 * Get unique participants for a specific work type
 */
export function getParticipantsByType(tasks, projectId, teamId, type) {
  if (!tasks || !Array.isArray(tasks)) return [];
  const participantIds = new Set();

  tasks.forEach((task) => {
    if (
      task.project_id === projectId &&
      (!task.team_id || task.team_id === teamId) &&
      task.type === type &&
      !task.is_archived
    ) {
      if (task.writer_id) participantIds.add(task.writer_id);
      else if (task.participant_id) participantIds.add(task.participant_id);
    }
  });

  return Array.from(participantIds);
}

/**
 * Get date range for tasks of a specific type
 */
export function getDateRangeForType(tasks, projectId, teamId, type) {
  if (!tasks || !Array.isArray(tasks)) return { start: null, end: null };

  const relevantTasks = tasks.filter(
    (task) =>
      task.project_id === projectId &&
      (!task.team_id || task.team_id === teamId) &&
      task.type === type &&
      !task.is_archived
  );

  if (relevantTasks.length === 0) {
    return { start: null, end: null };
  }

  const dates = [];
  relevantTasks.forEach((task) => {
    if (task.ps) dates.push(task.ps);
    if (task.pe) dates.push(task.pe);
    if (task.cs) dates.push(task.cs);
    if (task.ce) dates.push(task.ce);
  });

  if (dates.length === 0) {
    return { start: null, end: null };
  }

  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Get all unique work types in a project
 */
export function getWorkTypesInProject(tasks, projectId, teamId) {
  if (!tasks || !Array.isArray(tasks)) return [];
  const types = new Set();

  tasks.forEach((task) => {
    if (
      task.project_id === projectId &&
      (!task.team_id || task.team_id === teamId) &&
      task.type &&
      !task.is_archived
    ) {
      types.add(task.type);
    }
  });

  return Array.from(types).sort();
}

/**
 * Calculate total cost for a production cost entry
 */
export function calculateTotalCost(unitPrice, quantity) {
  return (unitPrice || 0) * (quantity || 0);
}

/**
 * Update production costs with new task quantities
 */
export function syncProductionCosts(db, projectId, teamId) {
  const tasks = db.tasks || [];
  const existingCosts = (db.production_costs || []).filter(
    (cost) => cost.project_id === projectId && (!cost.team_id || cost.team_id === teamId)
  );

  // Get all work types in project
  const workTypes = getWorkTypesInProject(tasks, projectId, teamId);

  // Update existing costs and create new ones if needed
  let updatedCosts = [...db.production_costs];

  workTypes.forEach((type) => {
    const quantity = countTasksByType(tasks, projectId, teamId, type);
    const existingCost = updatedCosts.find(
      (cost) =>
        cost.project_id === projectId &&
        cost.team_id === teamId &&
        cost.part === type
    );

    if (existingCost) {
      // Update existing cost
      const index = updatedCosts.indexOf(existingCost);
      updatedCosts[index] = {
        ...existingCost,
        quantity,
        total_cost: calculateTotalCost(existingCost.unit_price, quantity),
        updated_at: new Date().toISOString(),
      };
    } else {
      // Create new cost entry
      const newCost = createProductionCost(projectId, teamId, type, 0);
      newCost.quantity = quantity;
      newCost.total_cost = 0;
      updatedCosts.push(newCost);
    }
  });

  return updatedCosts;
}

/**
 * Record a change in the change history
 */
export function recordTaskChangeHistory(
  db,
  projectId,
  taskId,
  changeType,
  oldValue,
  newValue,
  changedBy
) {
  const task = (db.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    console.warn(`Task ${taskId} not found for change history`);
    return db.change_histories || [];
  }

  const history = createChangeHistory(
    projectId,
    taskId,
    changeType,
    oldValue,
    newValue,
    changedBy
  );

  // Add task info to history
  history.task_type = task.type;
  history.task_title = task.title;
  history.episode_no = task.episode_no;

  return [...(db.change_histories || []), history];
}

/**
 * Auto-match task data to production db
 * Called when task is created, updated, or deleted
 */
export function syncProductionDbFromTask(db, projectId, teamId, taskId, action) {
  // Sync production costs with new task quantities
  const updatedCosts = syncProductionCosts(db, projectId, teamId);

  return {
    ...db,
    production_costs: updatedCosts,
    // change_histories are handled separately by calling recordTaskChangeHistory
  };
}

/**
 * Get team assignment information for team management section
 */
export function getTeamAssignmentInfo(db, projectId, teamId) {
  const tasks = (db.tasks || []).filter(
    (t) =>
      t.project_id === projectId &&
      (!t.team_id || t.team_id === teamId) &&
      !t.is_archived
  );

  const workTypes = [...new Set(tasks.map((t) => t.type).filter(Boolean))].sort();

  return workTypes.map((type) => {
    const typeTasks = tasks.filter((t) => t.type === type);
    const writerIds = [
      ...new Set(typeTasks.map((t) => t.writer_id || t.participant_id).filter(Boolean)),
    ];
    const quantity = typeTasks.length;

    const dates = [];
    typeTasks.forEach((t) => {
      if (t.ps) dates.push(t.ps);
      if (t.pe) dates.push(t.pe);
      if (t.cs) dates.push(t.cs);
      if (t.ce) dates.push(t.ce);
    });
    dates.sort();

    return {
      type,
      participants: writerIds,
      participant_count: writerIds.length,
      task_count: quantity,
      start_date: dates[0] || null,
      end_date: dates[dates.length - 1] || null,
    };
  });
}
