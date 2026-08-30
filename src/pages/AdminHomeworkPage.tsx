import { ArrowUpRight, BookOpenCheck, FileText, Layers3, ShieldCheck } from "lucide-react";
import { useCallback, useEffect } from "react";
import { apiGet } from "../api";
import { AdminSectionNav } from "../components/AdminSectionNav";
import { ModuleTopBar } from "../components/ModuleTopBar";
import type { AdminHomeworkResponse } from "../types";
import { useRemote } from "../useRemote";

function formatMegabytes(byteLength: number) {
  return `${(byteLength / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminHomeworkPage() {
  const loadHomework = useCallback(
    (signal: AbortSignal) => apiGet<AdminHomeworkResponse>("/api/admin/homework", signal),
    [],
  );
  const { data, loading, error } = useRemote(loadHomework, [loadHomework]);

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="admin-page admin-homework-page">
      <ModuleTopBar compact />
      <main className="admin-main admin-homework-main">
        <header className="admin-heading admin-homework-heading">
          <div>
            <span className="mini-kicker"><ShieldCheck size={16} /> ADMIN ONLY</span>
            <h1>课后作业</h1>
            <p>{data ? `${data.collection.courseName} · ${data.collection.instructor}` : "精讲班 · 殷巧玲"}</p>
          </div>
          <div className="admin-count"><strong>{data?.collection.chapterCount ?? 19}</strong><span>章</span></div>
        </header>

        <AdminSectionNav />

        {error ? <div className="admin-feedback error" role="alert">{error}</div> : null}
        {loading ? (
          <div className="admin-loading" role="status">正在读取课后作业…</div>
        ) : data ? (
          <>
            <section className="homework-summary" aria-label="课后作业概览">
              <div><Layers3 size={21} aria-hidden="true" /><span><strong>{data.collection.chapterCount}</strong>章</span></div>
              <div><BookOpenCheck size={21} aria-hidden="true" /><span><strong>{data.collection.pageCount}</strong>页</span></div>
              <div><FileText size={21} aria-hidden="true" /><span><strong>{formatMegabytes(data.collection.byteLength)}</strong>PDF</span></div>
            </section>

            <section className="homework-grid" aria-label="章节课后题">
              {data.chapters.map((chapter) => (
                <article className="homework-card" key={chapter.id}>
                  <header>
                    <span>CHAPTER</span>
                    {chapter.hasTextbookUpdate ? <b>新教材变动</b> : null}
                  </header>
                  <div className="homework-card-number">{chapter.number}</div>
                  <div className="homework-card-copy">
                    <p>第 {chapter.chapterNumber} 章</p>
                    <h2>{chapter.title}</h2>
                    <small>{chapter.pageCount} 页 · {formatMegabytes(chapter.byteLength)}</small>
                  </div>
                  <a href={chapter.fileUrl} target="_blank" rel="noreferrer">
                    打开课后题 <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
