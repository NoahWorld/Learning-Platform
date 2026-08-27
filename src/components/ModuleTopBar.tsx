import { BookOpenCheck, LayoutGrid, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function ModuleTopBar({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "退出登录失败");
    }
  }

  return (
    <>
      <header className={`module-topbar${compact ? " compact" : ""}`}>
        <Link className="module-brand" to="/modules" aria-label="返回课程选择">
          <span><BookOpenCheck size={24} aria-hidden="true" /></span>
          <strong>知行台</strong>
        </Link>

        <div className="module-account">
          {compact ? (
            <Link className="module-switch-button" to="/modules">
              <LayoutGrid size={17} aria-hidden="true" /> 所有课程
            </Link>
          ) : null}
          <span className="module-user"><UserRound size={16} aria-hidden="true" /> {user?.displayName}</span>
          <button type="button" onClick={() => void handleLogout()}>
            <LogOut size={16} aria-hidden="true" /> <span>退出登录</span>
          </button>
        </div>
      </header>
      {logoutError ? <div className="module-topbar-error" role="alert">{logoutError}</div> : null}
    </>
  );
}
