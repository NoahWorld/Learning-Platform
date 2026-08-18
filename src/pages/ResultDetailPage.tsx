import { ArrowLeft, Check, Clock3, RotateCcw, Target, Trophy, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { ErrorState, LoadingState, formatDate, formatDuration } from "../components/PageBits";
import type { ResultDetail } from "../types";
import { useRemote } from "../useRemote";

export function ResultDetailPage() {
  const { resultId = "" } = useParams();
  const { data, loading, error } = useRemote<ResultDetail>(
    (signal) => apiGet(`/api/results/${encodeURIComponent(resultId)}`, signal),
    [resultId],
  );

  if (loading) return <LoadingState label="正在生成考试复盘…" />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const passed = data.score >= data.passingScore;

  return (
    <div className="standard-page result-detail-page">
      <Link className="comic-back" to="/results"><ArrowLeft size={17} /> 返回成绩列表</Link>

      <section className={`result-hero ${passed ? "celebrate" : "encourage"}`}>
        <div className="result-burst" aria-hidden="true" />
        <div className="result-score">
          <span>{passed ? <Trophy size={28} /> : <Target size={28} />}</span>
          <strong>{data.score}</strong>
          <small>分</small>
        </div>
        <div className="result-copy">
          <span className="hero-label">{passed ? "MISSION COMPLETE" : "KEEP GOING"}</span>
          <h1>{passed ? "漂亮，稳稳通过！" : "差一点，再来一轮！"}</h1>
          <p>{data.examTitle}</p>
          <div>
            <span><Check size={16} /> 答对 {data.correctCount} 题</span>
            <span><X size={16} /> 答错 {data.wrongCount} 题</span>
            <span><Clock3 size={16} /> {formatDuration(data.durationSeconds)}</span>
          </div>
        </div>
        <div className="result-actions">
          <Link className="comic-button dark" to={`/exams/${data.examId}`}><RotateCcw size={17} /> 再考一次</Link>
          <span>{formatDate(data.submittedAt)}</span>
        </div>
      </section>

      <section className="answer-review">
        <div className="section-title-row compact-row">
          <div>
            <span className="mini-kicker">ANSWER REVIEW</span>
            <h2>逐题解析</h2>
          </div>
          <span className="review-legend"><i className="right" /> 正确答案 <i className="wrong" /> 你的错选</span>
        </div>

        <div className="review-list">
          {data.answers.map((answer, index) => (
            <article className={`review-card ${answer.isCorrect ? "correct" : answer.earnedPoints > 0 ? "partial" : "incorrect"}`} key={answer.questionId}>
              <header>
                <span className="review-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <span>{answer.section === "case" ? `案例分析题（${answer.type === "single" ? "单选" : "多选"}）` : answer.type === "single" ? "单选题" : "多选题"}</span>
                  <h3>{answer.prompt}</h3>
                </div>
                <strong>{answer.isCorrect ? <><Check size={17} /> 正确</> : answer.earnedPoints > 0 ? <>部分得分 {answer.earnedPoints}/{answer.points}</> : <><X size={17} /> 错误</>}</strong>
              </header>
              {answer.section === "case" ? <div className="case-passage review-passage"><strong>案例材料</strong><p>{answer.passage}</p></div> : null}
              <div className="review-options">
                {answer.options.map((option) => {
                  const selected = answer.selectedOptionIds.includes(option.id);
                  const className = option.correct ? "right" : selected ? "wrong" : "";
                  return (
                    <div className={className} key={option.id}>
                      <span>{option.label}</span>
                      <p>{option.content}</p>
                      {option.correct ? <small>正确答案</small> : selected ? <small>你的选择</small> : null}
                    </div>
                  );
                })}
              </div>
              {answer.explanation ? (
                <div className="explanation"><strong>解析</strong><p>{answer.explanation}</p></div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
