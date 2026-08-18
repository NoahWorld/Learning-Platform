import { ArrowRight, BookOpenCheck, LockKeyhole, Smartphone, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.dataset.mode = "comic";
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const destination =
        location.state && typeof location.state === "object" && "from" in location.state
          ? String(location.state.from)
          : "/";
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-poster" aria-label="知行台学习介绍">
        <span className="login-spark spark-a">✦</span>
        <span className="login-spark spark-b">★</span>
        <div className="login-brand-mark"><BookOpenCheck size={42} /></div>
        <p className="mini-kicker"><Sparkles size={15} /> LEARN · TEST · GROW</p>
        <h1>把每一次学习，<br /><span>都留在自己的档案里。</span></h1>
        <p>登录后，手机和电脑共享同一份成绩、错题与学习统计。</p>
        <div className="login-comic-note">账号同步中<br /><strong>进度不会走丢！</strong></div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header>
            <span>WELCOME BACK</span>
            <h2>登录知行台</h2>
            <p>使用管理员为你创建的手机号账号。</p>
          </header>

          <form onSubmit={handleSubmit}>
            <label htmlFor="login-username">手机号</label>
            <div className="login-field">
              <Smartphone size={19} aria-hidden="true" />
              <input
                id="login-username"
                name="username"
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                pattern="1[3-9][0-9]{9}"
                maxLength={11}
                placeholder="请输入 11 位手机号"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            <label htmlFor="login-password">密码</label>
            <div className="login-field">
              <LockKeyhole size={19} aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                placeholder="请输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <div className="login-error" role="alert">{error}</div> : null}

            <button className="login-submit" type="submit" disabled={submitting || loading}>
              {submitting ? "正在登录…" : <>进入我的工作台 <ArrowRight size={18} /></>}
            </button>
          </form>

          <p className="login-help">暂不开放自助注册；需要新账号时请联系管理员创建。</p>
        </div>
      </section>
    </main>
  );
}
