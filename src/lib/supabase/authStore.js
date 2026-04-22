import { getSupabaseClient, isSupabaseConfigured } from "./client.js";
import { ASSIGNABLE_ROLES, ROLES, USER_STATUS, WAITING_TEAM_ID } from "../../utils/permissions.js";

const DEFAULT_MEMBER_ROLE = ROLES.PD_EDITOR;

function getClientOrThrow() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase 설정이 없습니다. .env.local에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY를 입력해 주세요."
    );
  }
  return client;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function normalizeAssignableRole(role) {
  return ASSIGNABLE_ROLES.includes(role) ? role : DEFAULT_MEMBER_ROLE;
}

function mapTeam(team) {
  return {
    id: team.id,
    organization_id: team.organization_id,
    team_number: team.team_number || 0,
    team_name: team.team_name || "이름 없는 팀",
    status: team.status || "active",
    created_at: team.created_at,
    updated_at: team.updated_at,
    deleted_at: team.deleted_at || null,
  };
}

function buildCompatibilityUser({ membership, profile, primaryTeamMembership, organization }) {
  return {
    id: membership.user_id,
    membership_id: membership.id,
    organization_id: membership.organization_id,
    organization_code: organization?.code || "",
    organization_name: organization?.name || "",
    email: profile?.email || "",
    name: profile?.full_name || profile?.email || "이름 없음",
    role: membership.role || DEFAULT_MEMBER_ROLE,
    status: membership.is_active ? USER_STATUS.ACTIVE : profile?.status || USER_STATUS.PENDING,
    primary_team_id: primaryTeamMembership?.team_id || WAITING_TEAM_ID,
    team_membership_id: primaryTeamMembership?.id || null,
    approved_at: membership.approved_at || null,
    created_at: profile?.created_at || membership.created_at,
    updated_at: profile?.updated_at || membership.updated_at,
  };
}

function pickCurrentMembership(memberships) {
  const list = ensureArray(memberships);
  return list.find((item) => item.is_active) || list[0] || null;
}

function pickPrimaryTeamMembership(teamMemberships, userId) {
  const scoped = ensureArray(teamMemberships)
    .filter((item) => item.user_id === userId && item.is_active && !item.deleted_at)
    .sort((a, b) => {
      if (a.is_primary === b.is_primary) return new Date(a.created_at) - new Date(b.created_at);
      return a.is_primary ? -1 : 1;
    });
  return scoped[0] || null;
}

async function fetchOrganizationsByIds(client, ids) {
  const organizationIds = [...new Set(ensureArray(ids).filter(Boolean))];
  if (!organizationIds.length) return [];

  const { data, error } = await client
    .from("organizations")
    .select("*")
    .in("id", organizationIds)
    .is("deleted_at", null);

  if (error) throw error;
  return ensureArray(data);
}

async function fetchProfilesByIds(client, ids) {
  const userIds = [...new Set(ensureArray(ids).filter(Boolean))];
  if (!userIds.length) return [];

  const { data, error } = await client.from("profiles").select("*").in("id", userIds);
  if (error) throw error;
  return ensureArray(data);
}

async function fetchOrgMembers(client, organizationId) {
  if (!organizationId) return [];

  const { data: memberships, error: membershipsError } = await client
    .from("org_memberships")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (membershipsError) throw membershipsError;

  const memberRows = ensureArray(memberships);
  const userIds = memberRows.map((item) => item.user_id);
  const [profiles, teamMemberships, organizations] = await Promise.all([
    fetchProfilesByIds(client, userIds),
    fetchTeamMemberships(client, organizationId),
    fetchOrganizationsByIds(client, [organizationId]),
  ]);

  const organization = organizations[0] || null;
  const profileById = new Map(profiles.map((item) => [item.id, item]));

  return memberRows.map((membership) =>
    buildCompatibilityUser({
      membership,
      profile: profileById.get(membership.user_id) || null,
      primaryTeamMembership: pickPrimaryTeamMembership(teamMemberships, membership.user_id),
      organization,
    })
  );
}

async function fetchTeams(client, organizationId) {
  if (!organizationId) return [];

  const { data, error } = await client
    .from("teams")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("team_number", { ascending: true });

  if (error) throw error;
  return ensureArray(data).map(mapTeam);
}

async function fetchTeamMemberships(client, organizationId) {
  if (!organizationId) return [];

  const { data, error } = await client
    .from("team_memberships")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ensureArray(data);
}

async function fetchOwnTeamMemberships(client, organizationId, userId) {
  if (!organizationId || !userId) return [];

  const { data, error } = await client
    .from("team_memberships")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ensureArray(data);
}

async function fetchSelfMemberships(client, userId) {
  const { data, error } = await client
    .from("org_memberships")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("approved_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ensureArray(data);
}

export function canUseSupabaseAuth() {
  return isSupabaseConfigured();
}

export async function getCurrentSession() {
  const client = getClientOrThrow();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function loadAuthState() {
  const client = getClientOrThrow();
  const session = await getCurrentSession();

  if (!session?.user) {
    return {
      session: null,
      currentUser: null,
      users: [],
      teams: [],
      organization: null,
    };
  }

  const userId = session.user.id;
  const [memberships, profile] = await Promise.all([
    fetchSelfMemberships(client, userId),
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  if (profile.error) throw profile.error;

  const currentMembership = pickCurrentMembership(memberships);
  if (!currentMembership) {
    return {
      session,
      currentUser: {
        id: userId,
        email: session.user.email || "",
        name: profile.data?.full_name || session.user.email || "이름 없음",
        role: DEFAULT_MEMBER_ROLE,
        status: profile.data?.status || USER_STATUS.PENDING,
        primary_team_id: WAITING_TEAM_ID,
      },
      users: [],
      teams: [],
      organization: null,
    };
  }

  const organizationId = currentMembership.organization_id;
  const organizations = await fetchOrganizationsByIds(client, [organizationId]);
  const organization = organizations[0] || null;

  if (!currentMembership.is_active || profile.data?.status !== USER_STATUS.ACTIVE) {
    return {
      session,
      currentUser: buildCompatibilityUser({
        membership: currentMembership,
        profile: profile.data || null,
        primaryTeamMembership: null,
        organization,
      }),
      users: [],
      teams: [],
      organization,
    };
  }

  let teams = [];
  let users = [];
  let primaryTeamMembership = null;

  try {
    const [organizationTeams, selfTeamMemberships, organizationUsers] = await Promise.all([
      fetchTeams(client, organizationId),
      fetchOwnTeamMemberships(client, organizationId, userId),
      fetchOrgMembers(client, organizationId),
    ]);

    teams = organizationTeams;
    users = organizationUsers;
    primaryTeamMembership = pickPrimaryTeamMembership(selfTeamMemberships, userId);
  } catch (error) {
    // Keep the user signed in even if organization-wide auth datasets are temporarily unavailable.
    console.warn("[auth] falling back to minimal auth state", error);
  }

  const currentUser = buildCompatibilityUser({
    membership: currentMembership,
    profile: profile.data || null,
    primaryTeamMembership,
    organization,
  });

  return {
    session,
    currentUser,
    users,
    teams,
    organization,
  };
}

export async function registerUser(email, password, profileInput, organizationJoinRequest) {
  const client = getClientOrThrow();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const fullName = String(profileInput?.full_name || profileInput?.name || "").trim();
  const organizationCode = String(
    organizationJoinRequest?.organization_code || organizationJoinRequest?.organizationCode || "kenaz"
  )
    .trim()
    .toLowerCase();

  if (!normalizedEmail || !password || !fullName) {
    return { success: false, error: "이메일, 비밀번호, 이름을 모두 입력해 주세요." };
  }

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id, code, name, status")
    .eq("code", organizationCode)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError) {
    return { success: false, error: toErrorMessage(organizationError, "조직 정보를 확인하지 못했습니다.") };
  }

  if (!organization) {
    return { success: false, error: "사용할 수 없는 조직 코드입니다. 다시 확인해 주세요." };
  }

  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        organization_code: organization.code,
      },
    },
  });

  if (error) {
    return { success: false, error: toErrorMessage(error, "가입 요청에 실패했습니다.") };
  }

  if (data.user) {
    await client.auth.signOut();
  }

  return {
    success: true,
    message: `${organization.name} 가입 요청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.`,
  };
}

export async function loginUser(email, password) {
  const client = getClientOrThrow();
  const { error } = await client.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password,
  });

  if (error) {
    return { success: false, error: toErrorMessage(error, "로그인에 실패했습니다.") };
  }

  return { success: true };
}

export async function logoutUser() {
  const client = getClientOrThrow();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function replacePrimaryTeamMembership(client, organizationId, userId, teamId) {
  const { data: existingRows, error: existingError } = await client
    .from("team_memberships")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (existingError) throw existingError;

  const timestamp = new Date().toISOString();
  const activeRows = ensureArray(existingRows);

  for (const row of activeRows) {
    const { error } = await client
      .from("team_memberships")
      .update({
        is_primary: false,
        is_active: false,
        deleted_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", row.id);

    if (error) throw error;
  }

  if (!teamId || teamId === WAITING_TEAM_ID) {
    return null;
  }

  const { data, error } = await client
    .from("team_memberships")
    .insert({
      organization_id: organizationId,
      team_id: teamId,
      user_id: userId,
      role: DEFAULT_MEMBER_ROLE,
      is_primary: true,
      is_active: true,
      approved_at: timestamp,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function approveMembership(requestId, teamId, role = DEFAULT_MEMBER_ROLE) {
  const client = getClientOrThrow();
  const timestamp = new Date().toISOString();
  const nextRole = normalizeAssignableRole(role);

  const { data: membership, error: membershipError } = await client
    .from("org_memberships")
    .update({
      role: nextRole,
      is_active: true,
      approved_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (membershipError) {
    return { success: false, error: toErrorMessage(membershipError, "가입 승인에 실패했습니다.") };
  }

  try {
    await replacePrimaryTeamMembership(client, membership.organization_id, membership.user_id, teamId);
    const { error: profileError } = await client
      .from("profiles")
      .update({
        status: USER_STATUS.ACTIVE,
        updated_at: timestamp,
      })
      .eq("id", membership.user_id);

    if (profileError) throw profileError;
  } catch (error) {
    return { success: false, error: toErrorMessage(error, "팀 배정 또는 프로필 활성화에 실패했습니다.") };
  }

  return { success: true };
}

export async function rejectMembership(requestId) {
  const client = getClientOrThrow();
  const timestamp = new Date().toISOString();

  const { data: membership, error } = await client
    .from("org_memberships")
    .update({
      is_active: false,
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    return { success: false, error: toErrorMessage(error, "가입 요청 거절에 실패했습니다.") };
  }

  const { error: profileError } = await client
    .from("profiles")
    .update({
      status: USER_STATUS.DISABLED,
      updated_at: timestamp,
    })
    .eq("id", membership.user_id);

  if (profileError) {
    return { success: false, error: toErrorMessage(profileError, "프로필 상태 업데이트에 실패했습니다.") };
  }

  return { success: true };
}

export async function updateProfileRecord(userId, profile) {
  const client = getClientOrThrow();
  const patch = {
    full_name: String(profile?.name || profile?.full_name || "").trim(),
    email: String(profile?.email || "").trim().toLowerCase(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("profiles").update(patch).eq("id", userId);
  if (error) {
    return { success: false, error: toErrorMessage(error, "프로필을 업데이트하지 못했습니다.") };
  }

  return { success: true };
}

export async function updateUserRoleRecord(membershipId, role) {
  const client = getClientOrThrow();
  const nextRole = normalizeAssignableRole(role);
  const { error } = await client
    .from("org_memberships")
    .update({
      role: nextRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    return { success: false, error: toErrorMessage(error, "권한을 변경하지 못했습니다.") };
  }

  return { success: true };
}

export async function moveUserToTeamRecord(organizationId, userId, teamId) {
  const client = getClientOrThrow();

  try {
    await replacePrimaryTeamMembership(client, organizationId, userId, teamId);
  } catch (error) {
    return { success: false, error: toErrorMessage(error, "팀 배정 변경에 실패했습니다.") };
  }

  return { success: true };
}

export async function createTeamRecord(organizationId, teamName) {
  const client = getClientOrThrow();
  const trimmedName = String(teamName || "").trim();
  if (!trimmedName) {
    return { success: false, error: "팀 이름을 입력해 주세요." };
  }

  const { data: existing, error: existingError } = await client
    .from("teams")
    .select("team_number")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("team_number", { ascending: false })
    .limit(1);

  if (existingError) {
    return { success: false, error: toErrorMessage(existingError, "팀 번호를 확인하지 못했습니다.") };
  }

  const teamNumber = (existing?.[0]?.team_number || 0) + 1;
  const { error } = await client.from("teams").insert({
    organization_id: organizationId,
    team_number: teamNumber,
    team_name: trimmedName,
    status: "active",
  });

  if (error) {
    return { success: false, error: toErrorMessage(error, "팀 생성에 실패했습니다.") };
  }

  return { success: true };
}

export async function updateTeamRecord(teamId, patch) {
  const client = getClientOrThrow();
  const teamName = String(patch?.team_name || "").trim();
  if (!teamName) {
    return { success: false, error: "팀 이름을 입력해 주세요." };
  }

  const { error } = await client
    .from("teams")
    .update({
      team_name: teamName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);

  if (error) {
    return { success: false, error: toErrorMessage(error, "팀 수정에 실패했습니다.") };
  }

  return { success: true };
}

export async function deleteTeamRecord(teamId) {
  const client = getClientOrThrow();
  const timestamp = new Date().toISOString();

  const { data: team, error: teamError } = await client
    .from("teams")
    .update({
      deleted_at: timestamp,
      status: "archived",
      updated_at: timestamp,
    })
    .eq("id", teamId)
    .select("organization_id")
    .single();

  if (teamError) {
    return { success: false, error: toErrorMessage(teamError, "팀 삭제에 실패했습니다.") };
  }

  const { error: membershipsError } = await client
    .from("team_memberships")
    .update({
      is_active: false,
      is_primary: false,
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq("team_id", teamId)
    .eq("organization_id", team.organization_id)
    .is("deleted_at", null);

  if (membershipsError) {
    return { success: false, error: toErrorMessage(membershipsError, "팀 소속 해제에 실패했습니다.") };
  }

  return { success: true };
}

export async function updateOwnPassword(userId, newPassword) {
  const client = getClientOrThrow();
  const session = await getCurrentSession();

  if (!session?.user || session.user.id !== userId) {
    return { success: false, error: "비밀번호 변경은 본인 계정에서만 가능합니다." };
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: toErrorMessage(error, "비밀번호를 변경하지 못했습니다.") };
  }

  return { success: true };
}

export function subscribeToAuthChanges(callback) {
  const client = getClientOrThrow();
  const { data } = client.auth.onAuthStateChange(() => {
    callback();
  });

  return () => data.subscription.unsubscribe();
}
