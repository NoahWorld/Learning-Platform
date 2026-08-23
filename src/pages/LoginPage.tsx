import {
  ArrowRight,
  BookOpenCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../auth";

interface CaptchaChallenge {
  id: string;
  prompt: string;
  options: Array<{ id: string; imageData: string }>;
  expiresInSeconds: number;
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaOptionId, setCaptchaOptionId] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptcha(null);
    setCaptchaOptionId("");
    setCaptchaError(null);
    try {
      const challenge = await apiGet<CaptchaChallenge>("/api/auth/captcha");
      setCaptcha(challenge);
    } catch (challengeError) {
      setCaptchaError(
        challengeError instanceof Error ? challengeError.message : "图片选择码加载失败",
      );
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.mode = "comic";
    if (!loading && !user) void loadCaptcha();
  }, [loadCaptcha, loading, user]);

  if (!loading && user) return <Navigate to="/modules" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!captcha || !captchaOptionId) {
      setError("请先完成图片选择码");
      return;
    }

    setSubmitting(true);
    try {
      await login(username, password, captcha.id, captchaOptionId);
      const requestedPath =
        location.state && typeof location.state === "object" && "from" in location.state
          ? String(location.state.from)
          : "/";
      navigate("/modules", { replace: true, state: { from: requestedPath } });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败，请稍后再试");
      await loadCaptcha();
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
            <p>使用管理员为你创建的用户名和密码。</p>
          </header>

          <form onSubmit={handleSubmit}>
            <label htmlFor="login-username">用户名</label>
            <div className="login-field">
              <UserRound size={19} aria-hidden="true" />
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                maxLength={64}
                placeholder="请输入用户名"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
                required
              />
            </div>

            <label htmlFor="login-password">密码</label>
            <div className="login-field login-password-field">
              <LockKeyhole size={19} aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                maxLength={128}
                placeholder="请输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-visibility-toggle"
                type="button"
                aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                aria-pressed={passwordVisible}
                title={passwordVisible ? "隐藏密码" : "显示密码"}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff size={19} aria-hidden="true" />
                ) : (
                  <Eye size={19} aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="login-captcha-heading">
              <div>
                <ShieldCheck size={17} aria-hidden="true" />
                <span>图片选择码</span>
              </div>
              <button
                type="button"
                onClick={() => void loadCaptcha()}
                disabled={captchaLoading || submitting}
              >
                <RefreshCw size={14} aria-hidden="true" /> 换一组
              </button>
            </div>

            <div className="login-captcha" aria-busy={captchaLoading}>
              {captchaLoading ? (
                <p className="captcha-status">正在准备图片…</p>
              ) : captcha ? (
                <>
                  <p id="captcha-prompt">{captcha.prompt}</p>
                  <div className="captcha-options" role="group" aria-labelledby="captcha-prompt">
                    {captcha.options.map((option, index) => (
                      <button
                        key={option.id}
                        className={captchaOptionId === option.id ? "selected" : ""}
                        type="button"
                        aria-label={`图形选项 ${index + 1}`}
                        aria-pressed={captchaOptionId === option.id}
                        onClick={() => setCaptchaOptionId(option.id)}
                        disabled={submitting}
                      >
                        <img
                          src={option.imageData}
                          alt=""
                          draggable={false}
                          width="66"
                          height="66"
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button className="captcha-retry" type="button" onClick={() => void loadCaptcha()}>
                  重新加载图片选择码
                </button>
              )}
            </div>

            {captchaError ? <div className="captcha-error" role="alert">{captchaError}</div> : null}
            {error ? <div className="login-error" role="alert">{error}</div> : null}

            <button
              className="login-submit"
              type="submit"
              disabled={submitting || loading || captchaLoading || !captcha || !captchaOptionId}
            >
              {submitting ? "正在登录…" : <>进入我的工作台 <ArrowRight size={18} /></>}
            </button>
          </form>

          <p className="login-help">暂不开放自助注册；需要新账号时请联系管理员创建。</p>
        </div>
      </section>
    </main>
  );
}
