import { useState } from "react";
import useAuth from "../hooks/useAuth";
import LoginPage from "./auth/LoginPage.jsx";
import RegisterPage from "./auth/RegisterPage.jsx";
import "../styles/auth.css";

function PendingAccessPage({ currentUser, onLogout }) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>PD Workspace</h1>
        <p className="auth-subtitle">가입 승인 대기</p>
        <div className="auth-note">
          <p>{currentUser?.organization_name || "조직"} 가입 요청이 등록되어 있습니다.</p>
          <p>관리자가 팀 배정과 권한 승인을 완료하면 업무 화면에 접근할 수 있습니다.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </div>
  );
}

export default function AuthGateway({ children }) {
  const { currentUser, isLoading, remoteError, logout } = useAuth();
  const [authMode, setAuthMode] = useState("login");

  // Keep the main app mounted during background auth refreshes.
  if (currentUser?.status === "active") {
    return children;
  }

  if (isLoading) {
    return <div className="empty">인증 정보를 불러오는 중입니다.</div>;
  }

  if (remoteError) {
    return (
      <div className="empty">
        <p>인증 상태를 확인하지 못했습니다.</p>
        <p>{remoteError}</p>
      </div>
    );
  }

  if (currentUser) {
    return <PendingAccessPage currentUser={currentUser} onLogout={logout} />;
  }

  if (authMode === "register") {
    return (
      <RegisterPage
        onRegisterSuccess={() => setAuthMode("login")}
        onNavigateLogin={() => setAuthMode("login")}
      />
    );
  }

  return (
    <LoginPage
      onLoginSuccess={() => {}}
      onNavigateRegister={() => setAuthMode("register")}
    />
  );
}
