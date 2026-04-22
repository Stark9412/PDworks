import { useState } from "react";
import useAuth from "../../hooks/useAuth";

export default function RegisterPage({ onRegisterSuccess, onNavigateLogin }) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (!email || !name || !password) {
        setError("이메일, 이름, 비밀번호를 모두 입력해 주세요.");
        return;
      }

      if (password !== confirmPassword) {
        setError("비밀번호 확인이 일치하지 않습니다.");
        return;
      }

      if (password.length < 8) {
        setError("비밀번호는 8자 이상으로 입력해 주세요.");
        return;
      }

      const result = await register(email, password, { full_name: name });

      if (result.success) {
        setSuccess(result.message);
        setEmail("");
        setName("");
        setPassword("");
        setConfirmPassword("");

        setTimeout(() => {
          onRegisterSuccess?.();
        }, 1500);
      } else {
        setError(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>PD Ops 업무툴</h1>
        <p className="auth-subtitle">Kenaz Studio 가입 요청</p>

        <form onSubmit={handleRegister} className="auth-form">
          {error ? <div className="auth-error">{error}</div> : null}
          {success ? <div className="auth-success">{success}</div> : null}

          <div className="form-group">
            <label htmlFor="register-email">이메일</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-name">이름</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="홍길동"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">비밀번호</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password-confirm">비밀번호 확인</label>
            <input
              id="register-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="비밀번호 다시 입력"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "가입 요청 중..." : "가입 요청"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            이미 계정이 있나요?{" "}
            <button type="button" onClick={onNavigateLogin} className="link-btn">
              로그인으로 돌아가기
            </button>
          </p>
        </div>

        <div className="auth-note">
          가입 요청 후 관리자의 승인과 팀 배정이 완료되어야 업무 화면에 접근할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
