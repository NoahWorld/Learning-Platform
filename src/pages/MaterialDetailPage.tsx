import { ArrowLeft, Clock3, Download, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { ErrorState, LoadingState, formatBytes } from "../components/PageBits";
import type { MaterialDetail } from "../types";
import { useRemote } from "../useRemote";

export function MaterialDetailPage() {
  const { materialId = "" } = useParams();
  const { data, loading, error } = useRemote<MaterialDetail>(
    (signal) => apiGet(`/api/materials/${encodeURIComponent(materialId)}`, signal),
    [materialId],
  );

  if (loading) return <LoadingState label="正在打开学习资料…" />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <article className="reading-page">
      <Link className="focus-back" to="/materials"><ArrowLeft size={17} /> 返回资料库</Link>
      <header className="reading-heading">
        <span className="reading-category">{data.category}</span>
        <h1>{data.title}</h1>
        {data.summary ? <p>{data.summary}</p> : null}
        <div className="reading-meta">
          <span><Clock3 size={16} /> 约 {data.estimatedMinutes || "—"} 分钟</span>
          <span>专注阅读模式</span>
        </div>
      </header>

      {data.coverUrl ? <img className="reading-cover" src={data.coverUrl} alt="" /> : null}

      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
      </div>

      {data.attachments.length > 0 ? (
        <section className="attachment-section">
          <span className="reading-category">配套资料</span>
          <h2>下载与延伸阅读</h2>
          <div className="attachment-list">
            {data.attachments.map((attachment) => (
              <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id}>
                <span className="attachment-icon"><FileText size={22} /></span>
                <span>
                  <strong>{attachment.title}</strong>
                  <small>{attachment.fileName} · {formatBytes(attachment.sizeBytes)}</small>
                </span>
                <Download size={19} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="reading-finish">
        <span>读完了吗？</span>
        <strong>用一场模拟考试检验记忆。</strong>
        <Link to="/exams">去模拟考试 <ArrowLeft className="arrow-forward" size={17} /></Link>
      </footer>
    </article>
  );
}
