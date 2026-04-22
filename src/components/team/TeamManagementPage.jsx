import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  ASSIGNABLE_ROLES,
  canAccessTeamManagement,
  ROLE_LABELS,
  ROLES,
  WAITING_TEAM_ID,
} from "../../utils/permissions";
import Button from "../ui/Button.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Panel from "../ui/Panel.jsx";
import ModalShell from "../ui/ModalShell.jsx";

const ROLE_OPTIONS = ASSIGNABLE_ROLES;

function MessageBanner({ tone, text }) {
  if (!text) return null;
  return <div className={`message ${tone === "error" ? "message-error" : "message-success"}`}>{text}</div>;
}

function TeamEditorModal({ open, mode, form, setForm, onClose, onSubmit }) {
  return (
    <ModalShell
      open={open}
      title={mode === "edit" ? "팀 수정" : "새 팀 만들기"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button active onClick={onSubmit}>
            {mode === "edit" ? "수정 저장" : "팀 생성"}
          </Button>
        </>
      }
    >
      <label className="team-modal-field">
        <span>팀 이름</span>
        <input
          className="ui-input"
          value={form.team_name}
          placeholder="예: 제작 3팀"
          onChange={(event) => setForm((prev) => ({ ...prev, team_name: event.target.value }))}
        />
      </label>
      {mode === "edit" ? (
        <div className="team-modal-meta">
          <span>팀 번호</span>
          <strong>{form.team_number}</strong>
        </div>
      ) : null}
    </ModalShell>
  );
}

export default function TeamManagementPage() {
  const {
    currentUser,
    users,
    teams,
    approveUser,
    rejectUser,
    updateProfile,
    updateUserRole,
    moveUserToTeam,
    createTeam,
    deleteTeam,
    updateTeam,
  } = useAuth();
  const [message, setMessage] = useState({ tone: "success", text: "" });
  const [teamModal, setTeamModal] = useState({ open: false, mode: "create", teamId: null });
  const [teamForm, setTeamForm] = useState({ team_name: "", team_number: "" });
  const [approvalDrafts, setApprovalDrafts] = useState({});

  const pendingUsers = useMemo(() => users.filter((user) => user.status === "pending"), [users]);
  const activeUsers = useMemo(() => users.filter((user) => user.status === "active"), [users]);
  const visibleTeams = useMemo(
    () => teams.slice().sort((a, b) => (a.team_number || 0) - (b.team_number || 0)),
    [teams]
  );
  const membersByBucket = useMemo(() => {
    const buckets = visibleTeams.map((team) => ({
      id: team.id,
      name: team.team_name,
      team_number: team.team_number,
      members: activeUsers.filter((user) => (user.primary_team_id || WAITING_TEAM_ID) === team.id),
    }));

    buckets.push({
      id: WAITING_TEAM_ID,
      name: "미배정",
      team_number: null,
      members: activeUsers.filter((user) => !user.primary_team_id || user.primary_team_id === WAITING_TEAM_ID),
    });

    return buckets;
  }, [activeUsers, visibleTeams]);

  if (!canAccessTeamManagement(currentUser)) {
    return <EmptyState>팀 관리는 조직 관리자만 접근할 수 있습니다.</EmptyState>;
  }

  const setSuccess = (text) => setMessage({ tone: "success", text });
  const setError = (text) => setMessage({ tone: "error", text });

  const openCreateModal = () => {
    setTeamForm({ team_name: "", team_number: visibleTeams.length + 1 });
    setTeamModal({ open: true, mode: "create", teamId: null });
  };

  const openEditModal = (team) => {
    setTeamForm({ team_name: team.team_name, team_number: team.team_number });
    setTeamModal({ open: true, mode: "edit", teamId: team.id });
  };

  const closeTeamModal = () => {
    setTeamModal({ open: false, mode: "create", teamId: null });
    setTeamForm({ team_name: "", team_number: "" });
  };

  const submitTeamModal = async () => {
    const result =
      teamModal.mode === "edit"
        ? await updateTeam(teamModal.teamId, { team_name: teamForm.team_name })
        : await createTeam({ teamName: teamForm.team_name });

    if (result.success) {
      setSuccess(teamModal.mode === "edit" ? "팀 정보를 수정했습니다." : "새 팀을 만들었습니다.");
      closeTeamModal();
      return;
    }

    setError(result.error);
  };

  const handleApprove = async (user) => {
    const draft = approvalDrafts[user.membership_id] || {};
    const teamId = draft.teamId || visibleTeams[0]?.id || null;
    const role = draft.role || ROLES.PD_EDITOR;
    const result = await approveUser(user.membership_id, teamId, role);
    if (result.success) setSuccess(`${user.name} 승인과 팀 배정을 완료했습니다.`);
    else setError(result.error);
  };

  const handleReject = async (user) => {
    const result = await rejectUser(user.membership_id);
    if (result.success) setSuccess(`${user.name} 가입 요청을 거절했습니다.`);
    else setError(result.error);
  };

  return (
    <div className="team-management-page">
      <section className="team-management-hero">
        <div>
          <h2>팀 관리</h2>
          <p>가입 요청 승인, 팀 생성, 팀 이동, 역할 변경을 한 화면에서 관리합니다.</p>
        </div>
      </section>

      <MessageBanner tone={message.tone} text={message.text} />

      <Panel
        title="가입 요청 대기"
        actions={
          <Button size="sm" variant="primary" onClick={openCreateModal}>
            새 팀 만들기
          </Button>
        }
      >
        {!pendingUsers.length ? (
          <EmptyState>승인 대기 중인 요청이 없습니다.</EmptyState>
        ) : (
          <div className="team-pending-list">
            {pendingUsers.map((user) => {
              const draft = approvalDrafts[user.membership_id] || {};
              return (
                <div key={user.membership_id} className="team-pending-row">
                  <div className="team-pending-main">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <span className="team-board-tag">{user.organization_name}</span>
                  </div>
                  <div className="team-row-actions">
                    <select
                      className="team-row-select"
                      value={draft.teamId || visibleTeams[0]?.id || ""}
                      onChange={(event) =>
                        setApprovalDrafts((prev) => ({
                          ...prev,
                          [user.membership_id]: {
                            ...prev[user.membership_id],
                            teamId: event.target.value,
                          },
                        }))
                      }
                    >
                      {visibleTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.team_name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="team-row-select"
                      value={draft.role || ROLES.PD_EDITOR}
                      onChange={(event) =>
                        setApprovalDrafts((prev) => ({
                          ...prev,
                          [user.membership_id]: {
                            ...prev[user.membership_id],
                            role: event.target.value,
                          },
                        }))
                      }
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="primary" onClick={() => handleApprove(user)}>
                      승인
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleReject(user)}>
                      거절
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="팀 구성 현황">
        <div className="team-board-stack">
          {membersByBucket.map((bucket) => (
            <div key={bucket.id} className="team-section-panel">
              <div className="team-section-head">
                <div>
                  <h3>{bucket.name}</h3>
                  <p className="team-board-count">{bucket.members.length}명</p>
                </div>
                {bucket.id !== WAITING_TEAM_ID ? (
                  <div className="team-board-head-actions">
                    <Button size="sm" variant="default" onClick={() => openEditModal({
                      id: bucket.id,
                      team_name: bucket.name,
                      team_number: bucket.team_number,
                    })}>
                      수정
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const result = await deleteTeam(bucket.id);
                      if (result.success) setSuccess("팀을 보관 처리했습니다.");
                      else setError(result.error);
                    }}>
                      보관
                    </Button>
                  </div>
                ) : null}
              </div>

              {!bucket.members.length ? (
                <EmptyState>배정된 인원이 없습니다.</EmptyState>
              ) : (
                <div className="team-member-row-list">
                  {bucket.members.map((user) => (
                    <div key={user.id} className="team-member-row">
                      <div className="team-member-core">
                        <strong>{user.name}</strong>
                        <span className="team-member-status">{ROLE_LABELS[user.role]}</span>
                        <span className="team-member-email">{user.email}</span>
                      </div>
                      <div className="team-member-row-controls">
                        <input
                          className="team-row-input"
                          defaultValue={user.name}
                          onBlur={async (event) => {
                            if (event.target.value === user.name) return;
                            const result = await updateProfile(user.id, { name: event.target.value, email: user.email });
                            if (result.success) setSuccess("이름을 수정했습니다.");
                            else setError(result.error);
                          }}
                        />
                        <input
                          className="team-row-input"
                          defaultValue={user.email}
                          onBlur={async (event) => {
                            if (event.target.value === user.email) return;
                            const result = await updateProfile(user.id, { name: user.name, email: event.target.value });
                            if (result.success) setSuccess("이메일을 수정했습니다.");
                            else setError(result.error);
                          }}
                        />
                        <select
                          className="team-row-select"
                          value={user.role}
                          onChange={async (event) => {
                            const result = await updateUserRole(user.membership_id, event.target.value);
                            if (result.success) setSuccess("권한을 변경했습니다.");
                            else setError(result.error);
                          }}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <select
                          className="team-row-select"
                          value={user.primary_team_id || WAITING_TEAM_ID}
                          onChange={async (event) => {
                            const result = await moveUserToTeam(user.id, event.target.value === WAITING_TEAM_ID ? null : event.target.value);
                            if (result.success) setSuccess("팀 배정을 변경했습니다.");
                            else setError(result.error);
                          }}
                        >
                          {visibleTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.team_name}
                            </option>
                          ))}
                          <option value={WAITING_TEAM_ID}>미배정</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <TeamEditorModal
        open={teamModal.open}
        mode={teamModal.mode}
        form={teamForm}
        setForm={setTeamForm}
        onClose={closeTeamModal}
        onSubmit={submitTeamModal}
      />
    </div>
  );
}
