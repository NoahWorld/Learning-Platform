import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import { useAuth } from "../auth";
import { ModuleTopBar } from "../components/ModuleTopBar";
import type { AdminUsersResponse, ManagedLearningModule, ManagedUser } from "../types";

interface CreateDraft {
  username: string;
  displayName: string;
  password: string;
  moduleIds: string[];
  isAdmin: boolean;
}

interface EditDraft {
  displayName: string;
  password: string;
  moduleIds: string[];
  isAdmin: boolean;
  isActive: boolean;
}

const EMPTY_CREATE_DRAFT: CreateDraft = {
  username: "",
  displayName: "",
  password: "",
  moduleIds: [],
  isAdmin: false,
};

function toEditDraft(user: ManagedUser): EditDraft {
  return {
    displayName: user.displayName,
    password: "",
    moduleIds: [...user.moduleIds],
    isAdmin: user.isAdmin,
    isActive: user.isActive,
  };
}

export function AdminUsersPage() {
  const { user: currentUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<AdminUsersResponse>("/api/admin/users");
      setData(response);
      setSelectedUserId((current) => {
        if (current === null) return response.users[0]?.id ?? null;
        return response.users.some((item) => item.id === current)
          ? current
          : response.users[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "账号配置读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
    void loadUsers();
  }, [loadUsers]);

  const selectedUser = useMemo(
    () => data?.users.find((item) => item.id === selectedUserId) ?? null,
    [data, selectedUserId],
  );

  useEffect(() => {
    setEditDraft(selectedUser ? toEditDraft(selectedUser) : null);
    setShowPassword(false);
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("zh-CN");
    if (!term) return data?.users ?? [];
    return (data?.users ?? []).filter((item) =>
      item.username.toLocaleLowerCase("zh-CN").includes(term)
      || item.displayName.toLocaleLowerCase("zh-CN").includes(term),
    );
  }, [data, search]);

  function beginCreate() {
    setSelectedUserId(null);
    setCreateDraft(EMPTY_CREATE_DRAFT);
    setShowPassword(false);
    setError(null);
    setNotice(null);
  }

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    setError(null);
    setNotice(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiPost<{ user: ManagedUser }>("/api/admin/users", createDraft);
      setData((current) => current
        ? { ...current, users: [...current.users, response.user] }
        : current);
      setCreateDraft(EMPTY_CREATE_DRAFT);
      setSelectedUserId(response.user.id);
      setNotice(`账号 ${response.user.username} 已创建`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "账号创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !editDraft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiPut<{ user: ManagedUser; sessionsInvalidated: boolean }>(
        `/api/admin/users/${encodeURIComponent(selectedUser.id)}`,
        editDraft,
      );
      setData((current) => current
        ? {
            ...current,
            users: current.users.map((item) => item.id === response.user.id ? response.user : item),
          }
        : current);
      setEditDraft(toEditDraft(response.user));

      if (response.user.id === currentUser?.id && response.sessionsInvalidated) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      if (response.user.id === currentUser?.id) await refreshUser();
      setNotice("账号配置已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "账号配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser) return;
    const confirmed = window.confirm(
      `确定永久删除账号“${selectedUser.username}”吗？已有学习记录的账号不能删除，可改为停用。`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiDelete(`/api/admin/users/${encodeURIComponent(selectedUser.id)}`);
      setData((current) => current
        ? { ...current, users: current.users.filter((item) => item.id !== selectedUser.id) }
        : current);
      setSelectedUserId(data?.users.find((item) => item.id !== selectedUser.id)?.id ?? null);
      setNotice(`账号 ${selectedUser.username} 已删除`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "账号删除失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <ModuleTopBar compact />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <span className="mini-kicker"><ShieldCheck size={16} /> ACCOUNT CONTROL</span>
            <h1>账号与课程</h1>
            <p>创建或停用账号，并决定每个人登录后能进入哪些课程。</p>
          </div>
          <div className="admin-count"><strong>{data?.users.length ?? 0}</strong><span>个账号</span></div>
        </header>

        {error ? <div className="admin-feedback error" role="alert">{error}</div> : null}
        {notice ? <div className="admin-feedback success" role="status"><Check size={17} /> {notice}</div> : null}

        {loading ? (
          <div className="admin-loading" role="status">正在读取账号配置…</div>
        ) : data ? (
          <div className="admin-layout">
            <aside className="admin-user-list-panel">
              <button className="admin-create-button" type="button" onClick={beginCreate}>
                <UserPlus size={18} /> 新增账号
              </button>
              <label className="admin-search">
                <Search size={17} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索用户名或名称"
                  aria-label="搜索账号"
                />
              </label>
              <div className="admin-user-list" aria-label="账号列表">
                {filteredUsers.map((account) => (
                  <button
                    className={selectedUserId === account.id ? "selected" : ""}
                    type="button"
                    onClick={() => selectUser(account.id)}
                    key={account.id}
                  >
                    <span className="admin-user-avatar">{account.displayName.slice(0, 1)}</span>
                    <span className="admin-user-copy">
                      <strong>{account.displayName}</strong>
                      <small>{account.username} · {account.moduleIds.length} 门课程</small>
                    </span>
                    <span className={`admin-user-status ${account.isActive ? "active" : "disabled"}`}>
                      {account.isActive ? "启用" : "停用"}
                    </span>
                  </button>
                ))}
                {filteredUsers.length === 0 ? <p className="admin-no-results">没有匹配的账号</p> : null}
              </div>
            </aside>

            <section className="admin-editor-panel">
              {selectedUser && editDraft ? (
                <EditUserForm
                  currentUserId={currentUser?.id ?? ""}
                  draft={editDraft}
                  modules={data.modules}
                  saving={saving}
                  user={selectedUser}
                  showPassword={showPassword}
                  onDraftChange={setEditDraft}
                  onShowPasswordChange={setShowPassword}
                  onSubmit={handleUpdate}
                  onDelete={() => void handleDelete()}
                />
              ) : (
                <CreateUserForm
                  draft={createDraft}
                  modules={data.modules}
                  saving={saving}
                  showPassword={showPassword}
                  onDraftChange={setCreateDraft}
                  onShowPasswordChange={setShowPassword}
                  onSubmit={handleCreate}
                />
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function CreateUserForm({
  draft,
  modules,
  saving,
  showPassword,
  onDraftChange,
  onShowPasswordChange,
  onSubmit,
}: {
  draft: CreateDraft;
  modules: ManagedLearningModule[];
  saving: boolean;
  showPassword: boolean;
  onDraftChange: (draft: CreateDraft) => void;
  onShowPasswordChange: (visible: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="admin-form-title">
        <span><UserPlus size={22} /></span>
        <div><h2>新增账号</h2><p>用户名创建后不可修改，输入时会自动去除空格。</p></div>
      </div>
      <div className="admin-form-grid">
        <label><span>用户名</span><input required maxLength={64} value={draft.username} onChange={(event) => onDraftChange({ ...draft, username: event.target.value })} /></label>
        <label><span>显示名称</span><input required maxLength={40} value={draft.displayName} onChange={(event) => onDraftChange({ ...draft, displayName: event.target.value })} /></label>
      </div>
      <PasswordField
        label="初始密码"
        value={draft.password}
        visible={showPassword}
        required
        onChange={(password) => onDraftChange({ ...draft, password })}
        onVisibilityChange={onShowPasswordChange}
      />
      <CoursePicker modules={modules} selected={draft.moduleIds} onChange={(moduleIds) => onDraftChange({ ...draft, moduleIds })} />
      <label className="admin-toggle-row">
        <input type="checkbox" checked={draft.isAdmin} onChange={(event) => onDraftChange({ ...draft, isAdmin: event.target.checked })} />
        <span><strong>管理员权限</strong><small>可以进入本页面管理其他账号</small></span>
      </label>
      <button className="admin-primary-action" type="submit" disabled={saving}>
        <UserPlus size={18} /> {saving ? "正在创建…" : "创建账号"}
      </button>
    </form>
  );
}

function EditUserForm({
  currentUserId,
  draft,
  modules,
  saving,
  user,
  showPassword,
  onDraftChange,
  onShowPasswordChange,
  onSubmit,
  onDelete,
}: {
  currentUserId: string;
  draft: EditDraft;
  modules: ManagedLearningModule[];
  saving: boolean;
  user: ManagedUser;
  showPassword: boolean;
  onDraftChange: (draft: EditDraft) => void;
  onShowPasswordChange: (visible: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  const isSelf = currentUserId === user.id;
  const learningCount = user.examAttemptCount + user.listeningAttemptCount + user.mistakePracticeCount;

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="admin-form-title">
        <span><UsersRound size={22} /></span>
        <div><h2>{user.displayName}</h2><p>用户名：{user.username}</p></div>
      </div>
      <div className="admin-account-stats">
        <span><strong>{user.examAttemptCount}</strong>次考试</span>
        <span><strong>{user.listeningAttemptCount}</strong>次听力</span>
        <span><strong>{user.mistakePracticeCount}</strong>次错题练习</span>
      </div>
      <label className="admin-field"><span>显示名称</span><input required maxLength={40} value={draft.displayName} onChange={(event) => onDraftChange({ ...draft, displayName: event.target.value })} /></label>
      <PasswordField
        label="重置密码（不修改请留空）"
        value={draft.password}
        visible={showPassword}
        onChange={(password) => onDraftChange({ ...draft, password })}
        onVisibilityChange={onShowPasswordChange}
      />
      <CoursePicker modules={modules} selected={draft.moduleIds} onChange={(moduleIds) => onDraftChange({ ...draft, moduleIds })} />
      <div className="admin-toggle-stack">
        <label className="admin-toggle-row">
          <input type="checkbox" checked={draft.isActive} disabled={isSelf} onChange={(event) => onDraftChange({ ...draft, isActive: event.target.checked })} />
          <span><strong>启用账号</strong><small>{isSelf ? "不能停用当前登录账号" : "停用后会立即退出该账号当前设备"}</small></span>
        </label>
        <label className="admin-toggle-row">
          <input type="checkbox" checked={draft.isAdmin} disabled={isSelf} onChange={(event) => onDraftChange({ ...draft, isAdmin: event.target.checked })} />
          <span><strong>管理员权限</strong><small>{isSelf ? "不能取消自己的管理员身份" : "允许管理账号和课程分配"}</small></span>
        </label>
      </div>
      <div className="admin-form-actions">
        <button className="admin-primary-action" type="submit" disabled={saving}>
          <Save size={18} /> {saving ? "正在保存…" : "保存配置"}
        </button>
        <button className="admin-delete-action" type="button" disabled={saving || isSelf} onClick={onDelete}>
          <Trash2 size={17} /> 删除账号
        </button>
      </div>
      {learningCount > 0 ? <p className="admin-delete-note">此账号已有学习记录，只能停用，不能永久删除。</p> : null}
    </form>
  );
}

function PasswordField({
  label,
  value,
  visible,
  required = false,
  onChange,
  onVisibilityChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onVisibilityChange: (visible: boolean) => void;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <span className="admin-password-field">
        <KeyRound size={17} aria-hidden="true" />
        <input type={visible ? "text" : "password"} minLength={8} maxLength={128} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" onClick={() => onVisibilityChange(!visible)} aria-label={visible ? "隐藏密码" : "显示密码"}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function CoursePicker({
  modules,
  selected,
  onChange,
}: {
  modules: ManagedLearningModule[];
  selected: string[];
  onChange: (moduleIds: string[]) => void;
}) {
  function toggle(moduleId: string, checked: boolean) {
    const next = checked
      ? [...selected, moduleId]
      : selected.filter((item) => item !== moduleId);
    onChange(modules.map((item) => item.id).filter((moduleId) => next.includes(moduleId)));
  }

  return (
    <fieldset className="admin-course-picker">
      <legend>可见课程</legend>
      <div>
        {modules.map((module) => (
          <label key={module.id}>
            <input type="checkbox" checked={selected.includes(module.id)} onChange={(event) => toggle(module.id, event.target.checked)} />
            <span><Check size={15} /> {module.title}</span>
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onChange(selected.length === modules.length ? [] : modules.map((item) => item.id))}>
        {selected.length === modules.length ? "全部取消" : "选择全部"}
      </button>
    </fieldset>
  );
}
