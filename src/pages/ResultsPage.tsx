import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, Clock3, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ScoreSticker,
  formatDate,
  formatDuration,
} from "../components/PageBits";
import type { ResultSummary } from "../types";
import { useRemote } from "../useRemote";

export function ResultsPage() {
  const { data, loading, error } = useRemote<{ results: ResultSummary[] }>(
    (signal) => apiGet("/api/results", signal),
    [],
  );
  const results = data?.results ?? [];
  const average = results.length
    ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
    : 0;
  const best = results.length ? Math.max(...results.map((result) => result.score)) : 0;
  const passed = results.filter((result) => result.score >= result.passingScore).length;

  return (
    <div className="standard-page results-page">
      <PageHeader
        eyebrow="SCORE ARCHIVE"
        title="考试成绩"
        description="每一次完成都算数。看见趋势，也看见下一次最值得努力的地方。"
        action={
          <Link className="comic-button primary" to="/exams">再考一次 <ArrowRight size={17} /></Link>
        }
      />

      {loading ? <LoadingState label="正在整理成绩单…" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && results.length === 0 ? (
        <EmptyState
          title="第一张成绩单还在等你"
          description="完成一场模拟考试后，分数、用时和逐题解析都会保存在你的账号。"
          actionLabel="去参加模拟考试"
          actionTo="/exams"
        />
      ) : null}

      {results.length > 0 ? (
        <>
          <section className="score-summary">
            <article className="summary-ticket yellow">
              <Trophy size={27} />
              <span>历史最高</span>
              <strong>{best}<small>分</small></strong>
            </article>
            <article className="summary-ticket blue">
              <ChartNoAxesColumnIncreasing size={27} />
              <span>平均成绩</span>
              <strong>{average}<small>分</small></strong>
            </article>
            <article className="summary-ticket pink">
              <CalendarDays size={27} />
              <span>通过场次</span>
              <strong>{passed}<small> / {results.length}</small></strong>
            </article>
          </section>

          <section className="result-history">
            <div className="section-title-row compact-row">
              <div>
                <span className="mini-kicker">EXAM HISTORY</span>
                <h2>全部考试记录</h2>
              </div>
            </div>
            <div className="result-list">
              {results.map((result, index) => (
                <Link to={`/results/${result.id}`} className="result-row" key={result.id}>
                  <span className="result-order">#{String(results.length - index).padStart(2, "0")}</span>
                  <ScoreSticker score={result.score} passingScore={result.passingScore} />
                  <span className="result-main">
                    <strong>{result.examTitle}</strong>
                    <small>
                      <span><CalendarDays size={14} /> {formatDate(result.submittedAt)}</span>
                      <span><Clock3 size={14} /> {formatDuration(result.durationSeconds)}</span>
                    </small>
                  </span>
                  <span className="result-accuracy">答对 {result.correctCount}/{result.totalQuestions}</span>
                  <ArrowRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
