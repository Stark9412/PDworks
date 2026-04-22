import { useState } from "react";
import useAuth from "../../hooks/useAuth";

export default function LoginPage({ onLoginSuccess, onNavigateRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        onLoginSuccess?.();
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
        <h1>PD Workspace</h1>
        <p className="auth-subtitle">PD 업무를 진행하는 공간입니다.</p>

        <form onSubmit={handleLogin} className="auth-form">
          {error ? <div className="auth-error">{error}</div> : null}

          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            계정이 없나요?{" "}
            <button type="button" onClick={onNavigateRegister} className="link-btn">
              가입 요청하기
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
