import { useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { canAccessTeamManagement, canApproveUsers, ROLE_LABELS } from "../../utils/permissions";
import Button from "../ui/Button.jsx";
import Field from "../ui/Field.jsx";
import FormBlock from "../ui/FormBlock.jsx";
import Panel from "../ui/Panel.jsx";

function SettingsMessage({ tone, text }) {
  if (!text) return null;
  return <div className={`settings-msg ${tone === "error" ? "message-error" : "message-success"}`}>{text}</div>;
}

export default function SettingsPage() {
  const { currentUser, teams, updatePassword, updateProfile } = useAuth();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwordDraft, setPasswordDraft] = useState({ password: "", confirm: "" });
  const [message, setMessage] = useState({ tone: "success", text: "" });
  const initialProfileRef = useRef({ name: "", email: "" });

  useEffect(() => {
    if (!currentUser) return;
    const nextProfile = { name: currentUser.name || "", email: currentUser.email || "" };
    setProfile(nextProfile);
    initialProfileRef.current = nextProfile;
  }, [currentUser]);

  const currentTeamName = useMemo(
    () => teams.find((team) => team.id === currentUser?.primary_team_id)?.team_name || "미배정",
    [currentUser, teams]
  );

  const permissionItems = [
    { label: "주간 보고 조회 및 작성", enabled: true },
    { label: "팀 관리 접근", enabled: canAccessTeamManagement(currentUser) },
    { label: "가입 요청 승인", enabled: canApproveUsers(currentUser) },
    { label: "소속 팀 데이터 접근", enabled: Boolean(currentUser?.primary_team_id) },
  ];

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const result = await updateProfile(currentUser.id, profile);
    if (result.success) {
      initialProfileRef.current = profile;
      setMessage({ tone: "success", text: "기본 정보를 저장했습니다." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    if (!passwordDraft.password || passwordDraft.password.length < 8) {
      setMessage({ tone: "error", text: "비밀번호는 8자 이상 입력해주세요." });
      return;
    }
    if (passwordDraft.password !== passwordDraft.confirm) {
      setMessage({ tone: "error", text: "비밀번호 확인이 일치하지 않습니다." });
      return;
    }

    const result = await updatePassword(currentUser.id, passwordDraft.password);
    if (result.success) {
      setPasswordDraft({ password: "", confirm: "" });
      setMessage({ tone: "success", text: "비밀번호를 변경했습니다." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
  };

  return (
    <div className="settings-page-wide">
      <section className="settings-hero-card">
        <div>
          <h2>설정</h2>
          <p>계정 기본 정보, 현재 권한, 비밀번호를 관리합니다.</p>
        </div>
        <div className="settings-hero-meta">
          <span>{ROLE_LABELS[currentUser?.role] || "권한 없음"}</span>
          <strong>{currentTeamName}</strong>
        </div>
      </section>

      <SettingsMessage tone={message.tone} text={message.text} />

      <div className="settings-grid">
        <Panel title="기본 정보">
          <form onSubmit={handleProfileSave}>
            <FormBlock>
              <Field label="이름">
                <input
                  value={profile.name}
                  onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                />
              </Field>
              <Field label="이메일">
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                />
              </Field>
            </FormBlock>
            <Button type="submit" variant="primary">
              기본 정보 저장
            </Button>
          </form>
        </Panel>

        <Panel title="권한 및 접근 범위">
          <div className="settings-role-summary">
            <p>현재 권한: <strong>{ROLE_LABELS[currentUser?.role] || "권한 없음"}</strong></p>
            <p>현재 소속: <strong>{currentTeamName}</strong></p>
          </div>
          <div className="permission-list">
            {permissionItems.map((item) => (
              <div key={item.label} className={`permission-item ${item.enabled ? "is-on" : "is-off"}`}>
                <span className={`permission-check ${item.enabled ? "is-on" : "is-off"}`}>
                  {item.enabled ? "가능" : "불가"}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="비밀번호 변경" className="settings-password-panel">
          <form onSubmit={handlePasswordSave}>
            <FormBlock>
              <Field label="새 비밀번호">
                <input
                  type="password"
                  value={passwordDraft.password}
                  onChange={(event) =>
                    setPasswordDraft((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
              </Field>
              <Field label="비밀번호 확인">
                <input
                  type="password"
                  value={passwordDraft.confirm}
                  onChange={(event) =>
                    setPasswordDraft((prev) => ({ ...prev, confirm: event.target.value }))
                  }
                />
              </Field>
            </FormBlock>
            <Button type="submit" variant="primary">
              비밀번호 저장
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
