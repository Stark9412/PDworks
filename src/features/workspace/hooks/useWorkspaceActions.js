import { createEntityActions } from "../actions/entityActionSet";
import { createTaskActions } from "../actions/taskActionSet";

export default function useWorkspaceActions(ctx) {
  return {
    ...createTaskActions(ctx),
    ...createEntityActions(ctx),
  };
}
