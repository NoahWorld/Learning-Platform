import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Layers3,
  ListChecks,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../components/PageBits";
import type { ExamSummary } from "../types";
import { useRemote } from "../useRemote";

interface ExamSeries {
  id: string;
  title: string;
  description: string;
  order: number;
  exams: ExamSummary[];
  totalQuestions: number;
  minQuestions: number;
  maxQuestions: number;
  durationMinutes: number;
}

export function ExamsPage() {
  const { data, loading, error } = useRemote<{ exams: ExamSummary[] }>(
    (signal) => apiGet("/api/exams", signal),
    [],
  );
  const series = useMemo(() => groupExamSeries(data?.exams ?? []), [data?.exams]);
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  return (
    <div className="standard-page exams-page">
      <PageHeader
        eyebrow="MOCK EXAM ARENA"
        title="模拟考试"
        description="长题库已经拆成短卷：每套不超过 30 题，25 分钟完成，练习和复盘都更轻松。"
      />

      <section className="exam-manifesto">
        <div className="manifesto-icon"><Target size={38} /></div>
        <div>
          <span>短时训练</span>
          <strong>一次专注 25 分钟，完成一套再休息。</strong>
        </div>
        <ul>
          <li><CheckCircle2 size={17} /> 自动计时</li>
          <li><CheckCircle2 size={17} /> 自动判分</li>
          <li><CheckCircle2 size={17} /> 错题归档</li>
        </ul>
      </section>

      {loading ? <LoadingState label="正在准备试卷…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && series.length === 0 ? (
        <EmptyState
          title="还没有可用试卷"
          description="录入题目并发布试卷后，就可以在这里开始第一次模拟考试。"
          actionLabel="返回工作台"
          actionTo="/"
        />
      ) : null}

      {series.length > 0 ? (
        <div className="exam-series-list">
          {series.map((item, index) => {
            const expanded = openSeriesId === item.id || (openSeriesId === null && index === 0);
            const panelId = `exam-series-${item.id}`;
            const questionRange = item.minQuestions === item.maxQuestions
              ? `${item.minQuestions} 题`
              : `${item.minQuestions}–${item.maxQuestions} 题`;

            return (
              <section className={`exam-series exam-tone-${(index % 3) + 1}`} key={item.id}>
                <div className="exam-series-header">
                  <div className="exam-series-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="exam-series-copy">
                    <span className="exam-label"><Layers3 size={15} /> EXAM SERIES</span>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                    <div className="exam-series-facts">
                      <span><ClipboardCheck size={17} /> {item.exams.length} 套题</span>
                      <span><ListChecks size={17} /> 每套 {questionRange}</span>
                      <span><Clock3 size={17} /> 每套 {item.durationMinutes} 分钟</span>
                    </div>
                  </div>
                  <button
                    className="series-toggle"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenSeriesId(expanded ? "__all_collapsed__" : item.id)}
                  >
                    {expanded ? "收起套题" : `查看 ${item.exams.length} 套题`}
                    <ChevronDown size={20} />
                  </button>
                </div>

                {expanded ? (
                  <div className="exam-paper-grid" id={panelId}>
                    {item.exams.map((exam) => (
                      <article className="exam-paper-card" key={exam.id}>
                        <div className="paper-number" aria-hidden="true">
                          {String(exam.paperOrder).padStart(2, "0")}
                        </div>
                        <div className="paper-card-copy">
                          <span>第 {String(exam.paperOrder).padStart(2, "0")} 套</span>
                          <h3>{exam.title}</h3>
                          <p>{exam.description || "这套试卷暂时没有说明。"}</p>
                          <div>
                            <span><ListChecks size={15} /> {exam.questionCount} 题</span>
                            <span><Clock3 size={15} /> {exam.durationMinutes} 分钟</span>
                            <span><Target size={15} /> {exam.passingScore} 分及格</span>
                          </div>
                        </div>
                        <Link className="paper-start-button" to={`/exams/${exam.id}`}>
                          开始答题 <ArrowRight size={17} />
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function groupExamSeries(exams: ExamSummary[]): ExamSeries[] {
  const groups = new Map<
    string,
    Omit<ExamSeries, "totalQuestions" | "minQuestions" | "maxQuestions" | "durationMinutes">
  >();

  for (const exam of exams) {
    const id = exam.seriesId || "standalone-exams";
    const existing = groups.get(id);
    if (existing) {
      existing.exams.push(exam);
      continue;
    }

    groups.set(id, {
      id,
      title: exam.seriesTitle || "体验试卷",
      description: exam.seriesDescription || "独立小套题，适合快速熟悉答题和成绩复盘流程。",
      order: exam.seriesId ? exam.seriesOrder : 999,
      exams: [exam],
    });
  }

  return [...groups.values()]
    .map((group) => {
      const sortedExams = [...group.exams].sort(
        (left, right) => left.paperOrder - right.paperOrder || left.title.localeCompare(right.title),
      );
      const questionCounts = sortedExams.map((exam) => exam.questionCount);
      return {
        ...group,
        exams: sortedExams,
        totalQuestions: questionCounts.reduce((total, count) => total + count, 0),
        minQuestions: Math.min(...questionCounts),
        maxQuestions: Math.max(...questionCounts),
        durationMinutes: Math.max(...sortedExams.map((exam) => exam.durationMinutes)),
      };
    })
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}
