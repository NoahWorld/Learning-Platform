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
  const correctedCount = mistakes.filter((mistake) => mistake.corrected).length;

  return (
    <div className="standard-page mistakes-page">
      <PageHeader
        eyebrow="MISTAKE PLAYBOOK"
        title="错题复盘"
        description="错题不是失败记录，而是一张会自动更新的“下一步学习地图”。"
        action={
          <Link className="comic-button primary" to="/exams">继续练习 <ArrowRight size={17} /></Link>
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
            <div><CheckCircle2 size={31} /><strong>{correctedCount}</strong><span>道最近已订正</span></div>
            <p><Sparkles size={18} /> 优先重练重复出错、且尚未订正的题目。</p>
          </section>

          <div className="mistake-list">
            {mistakes.map((mistake, index) => (
              <article className={`mistake-card ${mistake.corrected ? "corrected" : "open"}`} key={mistake.questionId}>
                <header>
                  <span className="mistake-index">#{String(index + 1).padStart(2, "0")}</span>
                  <span className="mistake-exam">{mistake.examTitle}</span>
                  <span className="mistake-status">
                    {mistake.corrected ? <><CheckCircle2 size={16} /> 最近已订正</> : <><XCircle size={16} /> 仍需巩固</>}
                  </span>
                </header>
                <h2>{mistake.prompt}</h2>
                <div className="correct-answer-box">
                  <span>正确答案</span>
                  <p>{mistake.correctOptions.map((option) => `${option.label}. ${option.content}`).join("；")}</p>
                </div>
                {mistake.explanation ? <p className="mistake-explanation"><strong>解析：</strong>{mistake.explanation}</p> : null}
                <footer>
                  <span>累计答错 {mistake.wrongCount} 次 · 最近 {formatDate(mistake.lastWrongAt)}</span>
                  <Link to={`/exams/${mistake.examId}`}><RotateCcw size={16} /> 重练这套试卷</Link>
                </footer>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
