import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, ListChecks, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../components/PageBits";
import type { ExamSummary } from "../types";
import { useRemote } from "../useRemote";

export function ExamsPage() {
  const { data, loading, error } = useRemote<{ exams: ExamSummary[] }>(
    (signal) => apiGet("/api/exams", signal),
    [],
  );

  return (
    <div className="standard-page exams-page">
      <PageHeader
        eyebrow="MOCK EXAM ARENA"
        title="模拟考试"
        description="把“好像会了”变成可验证的分数。每次提交后都会生成逐题解析。"
      />

      <section className="exam-manifesto">
        <div className="manifesto-icon"><Target size={38} /></div>
        <div>
          <span>考前提示</span>
          <strong>答题时，页面会自动切换成安静的专注模式。</strong>
        </div>
        <ul>
          <li><CheckCircle2 size={17} /> 自动计时</li>
          <li><CheckCircle2 size={17} /> 自动判分</li>
          <li><CheckCircle2 size={17} /> 错题归档</li>
        </ul>
      </section>

      {loading ? <LoadingState label="正在准备试卷…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && data?.exams.length === 0 ? (
        <EmptyState
          title="还没有可用试卷"
          description="录入题目并发布试卷后，就可以在这里开始第一次模拟考试。"
          actionLabel="先去学习资料"
          actionTo="/materials"
        />
      ) : null}

      {data?.exams.length ? (
        <div className="exam-list">
          {data.exams.map((exam, index) => (
            <article className={`exam-card exam-tone-${(index % 3) + 1}`} key={exam.id}>
              <div className="exam-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
              <div className="exam-card-main">
                <span className="exam-label"><ClipboardCheck size={15} /> MOCK TEST</span>
                <h2>{exam.title}</h2>
                <p>{exam.description || "这套试卷暂时没有说明。"}</p>
                <div className="exam-facts">
                  <span><ListChecks size={17} /> {exam.questionCount} 题</span>
                  <span><Clock3 size={17} /> {exam.durationMinutes} 分钟</span>
                  <span><Target size={17} /> {exam.passingScore} 分及格</span>
                </div>
              </div>
              <Link className="comic-button dark" to={`/exams/${exam.id}`}>
                查看试卷 <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
