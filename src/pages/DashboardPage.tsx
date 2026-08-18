import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { ErrorState, LoadingState, ScoreSticker, formatDate } from "../components/PageBits";
import type { DashboardSummary } from "../types";
import { useRemote } from "../useRemote";

const learningLoop = [
  { number: "01", title: "看资料", text: "把知识拆成小节", icon: BookOpen, color: "yellow" },
  { number: "02", title: "做模拟", text: "用考试检验掌握", icon: ClipboardCheck, color: "pink" },
  { number: "03", title: "翻错题", text: "找到真正的薄弱点", icon: RotateCcw, color: "blue" },
  { number: "04", title: "看成长", text: "让每次进步有记录", icon: Trophy, color: "green" },
];

export function DashboardPage() {
  const { data, loading, error } = useRemote<DashboardSummary>(
    (signal) => apiGet("/api/dashboard", signal),
    [],
  );

  return (
    <div className="dashboard-page">
      <section className="hero-comic">
        <div className="hero-copy">
          <span className="hero-label"><Flame size={17} /> 今日学习工作台</span>
          <h1>
            把零散知识，
            <span>练成稳定得分！</span>
          </h1>
          <p>学习、模拟、复盘、再练习。一个页面接住你的完整学习闭环。</p>
          <div className="hero-actions">
            <Link className="comic-button primary" to="/materials">
              开始学习 <ArrowRight size={18} />
            </Link>
            <Link className="comic-button secondary" to="/exams">
              来场模拟考
            </Link>
          </div>
          <div className="privacy-pill"><CheckCircle2 size={16} /> 账号同步，跨设备保留成绩</div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="sun-burst" />
          <div className="comic-card card-a">
            <span>LEARN</span>
            <BookOpen size={48} />
            <strong>知识 +1</strong>
          </div>
          <div className="comic-card card-b">
            <span>TEST!</span>
            <Target size={46} />
            <strong>命中弱点</strong>
          </div>
          <div className="speech-bubble">今天也<br />超会学！</div>
          <span className="comic-star star-one">★</span>
          <span className="comic-star star-two">✦</span>
        </div>
      </section>

      <section className="dashboard-block">
        <div className="section-title-row">
          <div>
            <span className="mini-kicker"><Sparkles size={14} /> CURRENT STATS</span>
            <h2>我的学习概览</h2>
          </div>
          <Link className="text-link" to="/results">全部成绩 <ArrowRight size={16} /></Link>
        </div>

        {loading ? <LoadingState label="正在读取你的学习记录…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {data ? (
          <div className="stat-strip">
            <article className="stat-card yellow">
              <span>资料库</span>
              <strong>{data.materialCount}</strong>
              <small>篇可学资料</small>
            </article>
            <article className="stat-card pink">
              <span>已完成</span>
              <strong>{data.attemptCount}</strong>
              <small>次模拟考试</small>
            </article>
            <article className="stat-card blue">
              <span>平均分</span>
              <strong>{data.averageScore}</strong>
              <small>历史平均表现</small>
            </article>
            <article className="stat-card green">
              <span>待攻克</span>
              <strong>{data.mistakeCount}</strong>
              <small>道历史错题</small>
            </article>
          </div>
        ) : null}
      </section>

      <section className="dashboard-grid">
        <div className="loop-board">
          <div className="section-title-row compact-row">
            <div>
              <span className="mini-kicker">YOUR LEARNING LOOP</span>
              <h2>四步形成学习闭环</h2>
            </div>
          </div>
          <div className="loop-grid">
            {learningLoop.map(({ number, title, text, icon: Icon, color }) => (
              <article className={`loop-card ${color}`} key={number}>
                <span className="loop-number">{number}</span>
                <Icon size={27} aria-hidden="true" />
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="recent-board">
          <span className="mini-kicker">LAST ROUND</span>
          <h2>最近一次</h2>
          {data?.recentAttempt ? (
            <>
              <ScoreSticker score={data.recentAttempt.score} passingScore={data.recentAttempt.passingScore} />
              <strong className="recent-title">{data.recentAttempt.examTitle}</strong>
              <p>{data.recentAttempt.correctCount}/{data.recentAttempt.totalQuestions} 题正确 · {formatDate(data.recentAttempt.submittedAt)}</p>
              <Link className="comic-button dark" to={`/results/${data.recentAttempt.id}`}>
                查看复盘 <ArrowRight size={17} />
              </Link>
            </>
          ) : (
            <div className="first-run">
              <Target size={38} aria-hidden="true" />
              <strong>等你完成第一场</strong>
              <p>成绩、用时和逐题解析会出现在这里。</p>
              <Link className="comic-button dark" to="/exams">去选试卷</Link>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
