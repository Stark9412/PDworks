export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  PD_MANAGER: "pd_manager",
  PD_EDITOR: "pd_editor",
  EXECUTIVE_VIEWER: "executive_viewer",
  AUDITOR: "auditor",
};

export const DEV_ADMIN_EMAIL = "admin@kenaz-re.com";

export const WAITING_TEAM_ID = "team_waiting";

export const USER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  DISABLED: "disabled",
};

export const ROLE_LEVELS = {
  [ROLES.OWNER]: 4,
  [ROLES.ADMIN]: 4,
  [ROLES.EXECUTIVE_VIEWER]: 3,
  [ROLES.AUDITOR]: 3,
  [ROLES.PD_MANAGER]: 2,
  [ROLES.PD_EDITOR]: 1,
};

export const ROLE_LABELS = {
  [ROLES.OWNER]: "관리자",
  [ROLES.ADMIN]: "관리자",
  [ROLES.EXECUTIVE_VIEWER]: "임원진",
  [ROLES.AUDITOR]: "임원진",
  [ROLES.PD_MANAGER]: "팀장 PD",
  [ROLES.PD_EDITOR]: "PD",
};

export const ASSIGNABLE_ROLES = [ROLES.EXECUTIVE_VIEWER, ROLES.PD_MANAGER, ROLES.PD_EDITOR];
export const TEAM_MANAGEMENT_ROLES = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.PD_MANAGER,
];
export const ORG_EDIT_ROLES = [ROLES.PD_MANAGER];
export const TEAM_EDIT_ROLES = [...ORG_EDIT_ROLES, ROLES.PD_EDITOR];
export const READONLY_ROLES = [ROLES.EXECUTIVE_VIEWER, ROLES.AUDITOR];

export function hasRole(userRole, requiredRole) {
  const userLevel = ROLE_LEVELS[userRole] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

export function isActiveUser(user) {
  return Boolean(user && user.status === USER_STATUS.ACTIVE);
}

export function isDevelopmentAdmin(user) {
  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  return Boolean(
    isActiveUser(user) &&
      [ROLES.OWNER, ROLES.ADMIN].includes(user?.role) &&
      normalizedEmail === DEV_ADMIN_EMAIL
  );
}

export function isOrgAdmin(user) {
  return Boolean(isActiveUser(user) && [ROLES.OWNER, ROLES.ADMIN].includes(user?.role));
}

export function isOrgEditor(user) {
  return Boolean(user && (isDevelopmentAdmin(user) || ORG_EDIT_ROLES.includes(user.role)));
}

export function isTeamEditor(user) {
  return Boolean(user && (isDevelopmentAdmin(user) || TEAM_EDIT_ROLES.includes(user.role)));
}

export function isReadOnlyRole(user) {
  return Boolean(user && READONLY_ROLES.includes(user.role));
}

export function canApproveUsers(user) {
  return Boolean(isActiveUser(user) && [ROLES.OWNER, ROLES.ADMIN, ROLES.PD_MANAGER].includes(user?.role));
}

export function canAccessTeamManagement(user) {
  return Boolean(isActiveUser(user) && TEAM_MANAGEMENT_ROLES.includes(user?.role));
}

export function canManageTeam(user, targetTeamId) {
  if (!isActiveUser(user)) return false;
  if (isOrgAdmin(user)) return true;
  return Boolean(
    user.role === ROLES.PD_MANAGER &&
      targetTeamId &&
      user.primary_team_id &&
      user.primary_team_id === targetTeamId
  );
}

export function canManageTeamMembers(user, targetTeamId) {
  return canManageTeam(user, targetTeamId);
}

export function canRemoveTeamMember(user, targetTeamId) {
  return canManageTeamMembers(user, targetTeamId);
}

export function canAccessProductionDb(user) {
  return isActiveUser(user);
}

export function canAccessAllProjectsDirectory(user) {
  return Boolean(
    isActiveUser(user) &&
      (isDevelopmentAdmin(user) ||
        [ROLES.OWNER, ROLES.ADMIN, ROLES.PD_MANAGER, ROLES.EXECUTIVE_VIEWER, ROLES.AUDITOR].includes(
          user.role
        ))
  );
}

export function canViewProject(user, project) {
  if (!isActiveUser(user) || !project) return false;
  if (isDevelopmentAdmin(user) || [ROLES.OWNER, ROLES.ADMIN].includes(user.role)) return true;
  if ([ROLES.PD_MANAGER, ROLES.EXECUTIVE_VIEWER, ROLES.AUDITOR].includes(user.role)) return true;
  return Boolean(user.id && project.pd_id && user.id === project.pd_id);
}

export function canEditProject(user, project) {
  if (!isActiveUser(user) || !project) return false;
  if (isDevelopmentAdmin(user) || [ROLES.OWNER, ROLES.ADMIN].includes(user.role)) return true;
  if ([ROLES.PD_MANAGER, ROLES.EXECUTIVE_VIEWER].includes(user.role)) return true;
  return Boolean(user.id && project.pd_id && user.id === project.pd_id);
}

export function canDeleteProject(user, project) {
  if (!isActiveUser(user) || !project) return false;
  if (isDevelopmentAdmin(user) || [ROLES.OWNER, ROLES.ADMIN].includes(user.role)) return true;
  return Boolean(user.id && project.pd_id && user.id === project.pd_id);
}

export function canCreateProject(user) {
  return isActiveUser(user);
}

export function canAssignProjectPd(user) {
  return isActiveUser(user);
}

export function canViewProjectDirectoryScope(user, scope = "my") {
  if (scope === "all") return canAccessProductionDb(user);
  return isActiveUser(user);
}

export function canViewProductionDb(user, project) {
  if (!canAccessProductionDb(user)) return false;
  return Boolean(project);
}

export function canEditProductionDb(user, project) {
  if (!canAccessProductionDb(user)) return false;
  return canEditProject(user, project);
}

export function canEditProductionDbSection(user, teamId) {
  if (!isActiveUser(user)) return false;
  if (isDevelopmentAdmin(user) || [ROLES.OWNER, ROLES.ADMIN].includes(user.role)) return true;
  return Boolean(
    [ROLES.PD_MANAGER, ROLES.PD_EDITOR].includes(user.role) &&
      user.primary_team_id &&
      teamId &&
      user.primary_team_id === teamId
  );
}

export function canCreateProductionDb(user) {
  return Boolean(
    isActiveUser(user) &&
      (isOrgEditor(user) || [ROLES.EXECUTIVE_VIEWER].includes(user?.role))
  );
}

export function canViewExecutiveSummary(user) {
  return Boolean(
    isActiveUser(user) &&
      (isDevelopmentAdmin(user) ||
        [ROLES.PD_MANAGER, ROLES.EXECUTIVE_VIEWER, ROLES.AUDITOR].includes(user.role))
  );
}

export function getPermissionLabel(user, teamId) {
  if (!user) return "권한 없음";
  if (canEditProductionDbSection(user, teamId)) return "편집 가능";
  if (canAccessProductionDb(user)) return "조회 전용";
  return "접근 불가";
}
