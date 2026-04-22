import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  approveMembership,
  canUseSupabaseAuth,
  createTeamRecord,
  deleteTeamRecord,
  loadAuthState,
  loginUser,
  logoutUser,
  moveUserToTeamRecord,
  registerUser,
  rejectMembership,
  subscribeToAuthChanges,
  updateOwnPassword,
  updateProfileRecord,
  updateTeamRecord,
  updateUserRoleRecord,
} from "../lib/supabase/authStore.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteError, setRemoteError] = useState(null);

  const refreshAuthState = useCallback(async () => {
    if (!canUseSupabaseAuth()) {
      setCurrentUser(null);
      setUsers([]);
      setTeams([]);
      setOrganization(null);
      setRemoteError(
        "Supabase 설정이 없습니다. .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY를 넣어주세요."
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const nextState = await loadAuthState();
      setCurrentUser(nextState.currentUser);
      setUsers(nextState.users);
      setTeams(nextState.teams);
      setOrganization(nextState.organization);
      setRemoteError(null);
    } catch (error) {
      setRemoteError(error.message || "인증 데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  useEffect(() => {
    if (!canUseSupabaseAuth()) return undefined;
    return subscribeToAuthChanges(() => {
      refreshAuthState();
    });
  }, [refreshAuthState]);

  const register = useCallback(async (email, password, profileInput, organizationJoinRequest) => {
    const result = await registerUser(email, password, profileInput, organizationJoinRequest);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const login = useCallback(async (email, password) => {
    const result = await loginUser(email, password);
    if (!result.success) {
      return result;
    }

    await refreshAuthState();
    return { success: true };
  }, [refreshAuthState]);

  const logout = useCallback(async () => {
    await logoutUser();
    await refreshAuthState();
  }, [refreshAuthState]);

  const approveUser = useCallback(async (requestId, teamId, role) => {
    const result = await approveMembership(requestId, teamId, role);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const rejectUser = useCallback(async (requestId) => {
    const result = await rejectMembership(requestId);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const updatePassword = useCallback(async (userId, newPassword) => {
    const result = await updateOwnPassword(userId, newPassword);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const updateProfile = useCallback(async (userId, payload) => {
    const result = await updateProfileRecord(userId, payload);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const updateUserRole = useCallback(async (membershipId, newRole) => {
    const result = await updateUserRoleRecord(membershipId, newRole);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const moveUserToTeam = useCallback(async (userId, targetTeamId) => {
    if (!organization?.id) {
      return { success: false, error: "조직 컨텍스트가 없습니다." };
    }

    const result = await moveUserToTeamRecord(organization.id, userId, targetTeamId);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [organization?.id, refreshAuthState]);

  const removeUserFromTeam = useCallback(async (userId) => {
    return moveUserToTeam(userId, null);
  }, [moveUserToTeam]);

  const createTeam = useCallback(async (input, legacyName) => {
    if (!organization?.id) {
      return { success: false, error: "조직 컨텍스트가 없습니다." };
    }

    const teamName = typeof input === "object" && input !== null ? input.teamName : legacyName;
    const result = await createTeamRecord(organization.id, teamName);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [organization?.id, refreshAuthState]);

  const deleteTeam = useCallback(async (teamId) => {
    const result = await deleteTeamRecord(teamId);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const updateTeam = useCallback(async (teamId, patch) => {
    const result = await updateTeamRecord(teamId, patch);
    if (result.success) {
      await refreshAuthState();
    }
    return result;
  }, [refreshAuthState]);

  const getPendingUsers = useCallback(() => users.filter((user) => user.status === "pending"), [users]);

  const value = useMemo(
    () => ({
      currentUser,
      users,
      teams,
      organization,
      isLoading,
      remoteError,
      register,
      login,
      logout,
      approveUser,
      rejectUser,
      getPendingUsers,
      updatePassword,
      updateProfile,
      updateUserRole,
      moveUserToTeam,
      removeUserFromTeam,
      createTeam,
      deleteTeam,
      updateTeam,
      refreshAuthState,
    }),
    [
      approveUser,
      createTeam,
      currentUser,
      deleteTeam,
      getPendingUsers,
      isLoading,
      login,
      logout,
      moveUserToTeam,
      organization,
      refreshAuthState,
      register,
      rejectUser,
      remoteError,
      removeUserFromTeam,
      teams,
      updatePassword,
      updateProfile,
      updateTeam,
      updateUserRole,
      users,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
