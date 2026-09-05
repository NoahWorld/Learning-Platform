import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { PmpFocusShell } from "../components/PmpFocusShell";
import { ErrorState, LoadingState } from "../components/PageBits";
import type { PmpLearningMaterialDetail } from "../types";
import { useRemote } from "../useRemote";

export function PmpMaterialPage() {
  const { materialId = "" } = useParams();
  const { data, loading, error } = useRemote<PmpLearningMaterialDetail>(
    (signal) => apiGet(`/api/pmp/materials/${encodeURIComponent(materialId)}`, signal),
    [materialId],
  );

  return (
    <PmpFocusShell exitPath="/modules/pmp" exitLabel="退出阅读">
      {loading ? <LoadingState label="正在打开 PMP 学习资料…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <article className="reading-page">
          <Link className="focus-back" to="/modules/pmp"><ArrowLeft size={17} /> 返回 PMP 学习中心</Link>
          <header className="reading-heading">
            <span className="reading-category">{data.category} · {data.domain}</span>
            <h1>{data.title}</h1>
            <p>{data.summary}</p>
            <div className="reading-meta">
              <span><Clock3 size={16} /> 约 {data.estimatedMinutes} 分钟</span>
              <span>原创导学笔记</span>
            </div>
          </header>
          <div className="prose pmp-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
          </div>
          <footer className="reading-finish">
            <span>学完这一节？</span>
            <strong>用情境短卷检验判断顺序。</strong>
            <Link to="/modules/pmp#mock-exams">去做模拟题 <ArrowRight size={17} /></Link>
          </footer>
        </article>
      ) : null}
    </PmpFocusShell>
  );
}
