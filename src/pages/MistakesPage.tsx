import { ArrowRight, CheckCircle2, RotateCcw, Sparkles, Target, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader, formatDate } from "../components/PageBits";
import type { MistakeItem } from "../types";
import { useRemote } from "../useRemote";

export function MistakesPage() {
  const { data, loading, error } = useRemote<{ mistakes: MistakeItem[] }>(
    (signal) => apiGet("/api/mistakes", signal),
    [],
  );
  const mistakes = data?.mistakes ?? [];
  const relearnedCount = mistakes.filter((mistake) => mistake.relearned).length;

  return (
    <div className="standard-page mistakes-page">
      <PageHeader
        eyebrow="MISTAKE PLAYBOOK"
        title="错题复盘"
        description="逐题重新作答，答对后标记为“已重学”；题目仍会保留，随时可以再练。"
        action={
          <Link className="comic-button primary" to="/mistakes/practice">开始错题练习 <ArrowRight size={17} /></Link>
        }
      />

      {loading ? <LoadingState label="正在整理错题本…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && mistakes.length === 0 ? (
        <EmptyState
          title="错题本现在很干净"
          description="参加模拟考试后，答错的题目会自动带着正确答案和解析来到这里。"
          actionLabel="去参加模拟考试"
          actionTo="/exams"
        />
      ) : null}

      {mistakes.length > 0 ? (
        <>
          <section className="mistake-banner">
            <div><Target size={31} /><strong>{mistakes.length}</strong><span>道历史错题</span></div>
            <div><CheckCircle2 size={31} /><strong>{relearnedCount}</strong><span>道已重学</span></div>
            <p><Sparkles size={18} /> 未重学的错题会排在练习前面，已重学也能继续做。</p>
          </section>

          <div className="mistake-list">
            {mistakes.map((mistake, index) => (
              <article className={`mistake-card ${mistake.relearned ? "corrected" : "open"}`} key={mistake.questionId}>
                <header>
                  <span className="mistake-index">#{String(index + 1).padStart(2, "0")}</span>
                  <span className="mistake-exam">{mistake.examTitle}</span>
                  <span className="mistake-status">
                    {mistake.relearned
                      ? <><CheckCircle2 size={16} /> 已重学</>
                      : mistake.corrected
                        ? <><CheckCircle2 size={16} /> 最近已订正</>
                        : <><XCircle size={16} /> 仍需巩固</>}
                  </span>
                </header>
                <h2>{mistake.prompt}</h2>
                <div className="correct-answer-box">
                  <span>正确答案</span>
                  <p>{mistake.correctOptions.map((option) => `${option.label}. ${option.content}`).join("；")}</p>
                </div>
                {mistake.explanation ? <p className="mistake-explanation"><strong>解析：</strong>{mistake.explanation}</p> : null}
                <footer>
                  <span>
                    累计答错 {mistake.wrongCount} 次 · 错题练习 {mistake.practiceCount} 次 · 最近 {formatDate(mistake.lastWrongAt)}
                  </span>
                  <Link to={`/mistakes/practice?question=${encodeURIComponent(mistake.questionId)}`}>
                    <RotateCcw size={16} /> 练这道题
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
