import {
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  Home,
  LogOut,
  RotateCcw,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const navigation = [
  { to: "/", label: "工作台", icon: Home, end: true },
  { to: "/materials", label: "学习", icon: BookOpen },
  { to: "/exams", label: "模拟考", icon: ClipboardCheck },
  { to: "/mistakes", label: "错题", icon: RotateCcw },
  { to: "/results", label: "成绩", icon: Trophy },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const isReading = Boolean(useMatch("/materials/:materialId"));
  const isExam = Boolean(useMatch("/exams/:examId"));
  const focusMode = isReading || isExam;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.body.dataset.mode = focusMode ? "focus" : "comic";
  }, [focusMode, location.pathname]);

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "退出登录失败");
    }
  }

  if (focusMode) {
    return (
      <div className="focus-shell">
        <header className="focus-header">
          <Link className="focus-brand" to="/" aria-label="返回知行台首页">
            <span className="focus-brand-mark">知</span>
            <span>知行台</span>
          </Link>
          <div className="focus-actions">
            <span className="focus-user">{user?.displayName}</span>
            <Link className="focus-exit" to={isReading ? "/materials" : "/exams"}>
              <X size={17} aria-hidden="true" />
              {isReading ? "退出阅读" : "退出考试"}
            </Link>
          </div>
        </header>
        <main className="focus-main">
          {logoutError ? <div className="shell-error" role="alert">{logoutError}</div> : null}
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="comic-shell">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="知行台首页">
          <span className="brand-burst" aria-hidden="true">
            <BrainCircuit size={26} />
          </span>
          <span>
            <strong>知行台</strong>
            <small>LEARN · TEST · GROW</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
              <i aria-hidden="true">→</i>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="tape" aria-hidden="true" />
          <span className="account-avatar" aria-hidden="true"><UserRound size={21} /></span>
          <strong>{user?.displayName}</strong>
          <p>{user?.username}<br />成绩与错题已同步到账号。</p>
          <button type="button" onClick={() => void handleLogout()}><LogOut size={15} /> 退出登录</button>
        </div>
      </aside>

      <div className="comic-stage">
        <header className="mobile-header">
          <Link className="brand compact" to="/">
            <span className="brand-burst" aria-hidden="true">知</span>
            <strong>知行台</strong>
          </Link>
          <span className="mobile-kicker">{user?.displayName} · 今天也要涨知识！</span>
          <button className="mobile-logout" type="button" onClick={() => void handleLogout()} aria-label="退出登录">
            <LogOut size={18} />
          </button>
        </header>
        <main className="comic-main">
          {logoutError ? <div className="shell-error" role="alert">{logoutError}</div> : null}
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
