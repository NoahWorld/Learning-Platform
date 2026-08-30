import { FileText, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

export function AdminSectionNav() {
  return (
    <nav className="admin-section-nav" aria-label="管理中心">
      <NavLink to="/admin/users">
        <UsersRound size={17} aria-hidden="true" /> 账号与课程
      </NavLink>
      <NavLink to="/admin/homework">
        <FileText size={17} aria-hidden="true" /> 课后作业
      </NavLink>
    </nav>
  );
}
