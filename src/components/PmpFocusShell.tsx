import { LayoutGrid, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";

interface PmpFocusShellProps {
  children: ReactNode;
  exitPath: string;
  exitLabel: string;
}

export function PmpFocusShell({ children, exitPath, exitLabel }: PmpFocusShellProps) {
  const { user } = useAuth();

  useEffect(() => {
    document.body.dataset.mode = "focus";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="focus-shell">
      <header className="focus-header">
        <Link className="focus-brand" to="/modules/pmp" aria-label="返回 PMP 学习中心">
          <span className="focus-brand-mark">P</span>
          <span>PMP 学习中心</span>
        </Link>
        <div className="focus-actions">
          <span className="focus-user">{user?.displayName}</span>
          <Link className="focus-module-switch" to="/modules">
            <LayoutGrid size={16} aria-hidden="true" /> 切换课程
          </Link>
          <Link className="focus-exit" to={exitPath}>
            <X size={17} aria-hidden="true" /> {exitLabel}
          </Link>
        </div>
      </header>
      <main className="focus-main">{children}</main>
    </div>
  );
}
