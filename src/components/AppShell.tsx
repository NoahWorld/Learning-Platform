import {
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  Home,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const navigation = [
  { to: "/", label: "工作台", icon: Home, end: true },
  { to: "/materials", label: "学习", icon: BookOpen },
  { to: "/exams", label: "模拟考", icon: ClipboardCheck },
  { to: "/mistakes", label: "错题", icon: RotateCcw },
  { to: "/results", label: "成绩", icon: Trophy },
];

export function AppShell() {
  const location = useLocation();
  const isReading = /^\/materials\/[^/]+$/.test(location.pathname);
  const isExam = /^\/exams\/[^/]+$/.test(location.pathname);
  const focusMode = isReading || isExam;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.body.dataset.mode = focusMode ? "focus" : "comic";
  }, [focusMode, location.pathname]);

  if (focusMode) {
    return (
      <div className="focus-shell">
        <header className="focus-header">
          <Link className="focus-brand" to="/" aria-label="返回知行台首页">
            <span className="focus-brand-mark">知</span>
            <span>知行台</span>
          </Link>
          <Link className="focus-exit" to={isReading ? "/materials" : "/exams"}>
            <X size={17} aria-hidden="true" />
            {isReading ? "退出阅读" : "退出考试"}
          </Link>
        </header>
        <main className="focus-main">
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
          <strong>不用登录</strong>
          <p>成绩与错题只按当前设备记录，打开就能继续。</p>
          <span className="scribble" aria-hidden="true">匿名 · 轻量 · 专注</span>
        </div>
      </aside>

      <div className="comic-stage">
        <header className="mobile-header">
          <Link className="brand compact" to="/">
            <span className="brand-burst" aria-hidden="true">知</span>
            <strong>知行台</strong>
          </Link>
          <span className="mobile-kicker">今天也要涨知识！</span>
        </header>
        <main className="comic-main">
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
