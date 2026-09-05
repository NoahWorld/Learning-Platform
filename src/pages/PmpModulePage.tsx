import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Clock3,
  ExternalLink,
  FileCheck2,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState, formatDate, formatDuration } from "../components/PageBits";
import type { PmpOverview } from "../types";
import { useRemote } from "../useRemote";

export function PmpModulePage() {
  const { data, loading, error } = useRemote<PmpOverview>(
    (signal) => apiGet("/api/pmp", signal),
    [],
  );

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="module-page pmp-module-page">
      <ModuleTopBar compact />
      <main className="pmp-module-main">
        <Link className="module-back-link" to="/modules">
          <ArrowLeft size={17} /> 返回课程选择
        </Link>

        {loading ? <LoadingState label="正在打开 PMP 学习中心…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {data ? <PmpOverviewContent data={data} /> : null}
      </main>
    </div>
  );
}

function PmpOverviewContent({ data }: { data: PmpOverview }) {
  return (
    <>
      <section className="pmp-hero">
        <div className="pmp-hero-copy">
          <span className="mini-kicker"><Sparkles size={15} /> PMP · PROJECT MANAGEMENT</span>
          <h1>把项目判断力<br /><em>练成肌肉记忆。</em></h1>
          <p>依据 2026 年 7 月新版考纲组织学习，用短笔记建立框架，用原创情境题训练决策顺序。</p>
          <div className="pmp-hero-actions">
            <Link to={`/modules/pmp/materials/${data.materials[0]?.id ?? ""}`}>
              <BookOpenText size={18} /> 从学习地图开始
            </Link>
            <a href={data.examProfile.sourceUrl} target="_blank" rel="noreferrer">
              查看 PMI 官方考纲 <ExternalLink size={16} />
            </a>
          </div>
        </div>
        <div className="pmp-exam-card">
          <span>{data.examProfile.version}</span>
          <strong>{data.examProfile.questionCount}</strong>
          <small>QUESTIONS</small>
          <div>
            <b>{data.examProfile.durationMinutes} 分钟</b>
            <b>{data.examProfile.breaks}</b>
          </div>
        </div>
      </section>

      <section className="pmp-domain-section" aria-labelledby="pmp-domain-title">
        <header className="pmp-section-heading">
          <div><span>EXAM DOMAINS</span><h2 id="pmp-domain-title">三个考试领域</h2></div>
          <p>{data.examProfile.approachNote}</p>
        </header>
        <div className="pmp-domain-grid">
          {data.examProfile.domains.map((domain) => (
            <article className={domain.tone} key={domain.id}>
              <span>{domain.englishTitle}</span>
              <strong>{domain.weight}%</strong>
              <h3>{domain.title}</h3>
              <i style={{ width: `${domain.weight}%` }} />
            </article>
          ))}
        </div>
      </section>

      <section className="pmp-content-section" aria-labelledby="pmp-material-title">
        <header className="pmp-section-heading">
          <div><span>STUDY NOTES</span><h2 id="pmp-material-title">原创学习资料</h2></div>
          <p>6 篇短笔记，从考试地图走到 AI、伦理与合规。</p>
        </header>
        <div className="pmp-material-grid">
          {data.materials.map((material) => (
            <Link to={`/modules/pmp/materials/${material.id}`} key={material.id}>
              <header><span>NOTE · {material.number}</span><i>{material.domain}</i></header>
              <h3>{material.title}</h3>
              <p>{material.summary}</p>
              <footer><span><Clock3 size={15} /> 约 {material.estimatedMinutes} 分钟</span><ArrowRight size={18} /></footer>
            </Link>
          ))}
        </div>
      </section>

      <section className="pmp-content-section" id="mock-exams" aria-labelledby="pmp-exam-title">
        <header className="pmp-section-heading">
          <div><span>SCENARIO PRACTICE</span><h2 id="pmp-exam-title">原创情境模拟题</h2></div>
          <p>3 套短卷共 36 题。不是 PMI 官方真题，交卷前不显示答案与解析。</p>
        </header>
        <div className="pmp-mock-grid">
          {data.exams.map((exam) => (
            <Link to={`/modules/pmp/exams/${exam.id}`} key={exam.id}>
              <span className="pmp-mock-number">0{exam.paperOrder}</span>
              <div><small>ORIGINAL MOCK EXAM</small><h3>{exam.title}</h3><p>{exam.description}</p></div>
              <footer>
                <span><FileCheck2 size={15} /> {exam.questionCount} 题</span>
                <span><Clock3 size={15} /> {exam.durationMinutes} 分钟</span>
                <b>开始答题 <ArrowRight size={16} /></b>
              </footer>
            </Link>
          ))}
        </div>
        <p className="pmp-score-note"><Target size={16} /> {data.examProfile.passingScoreNote}</p>
      </section>

      <section className="pmp-content-section" aria-labelledby="pmp-official-title">
        <header className="pmp-section-heading">
          <div><span>OFFICIAL SOURCES</span><h2 id="pmp-official-title">PMI 官方资料与样题入口</h2></div>
          <p>本站只做入口和中文导学，不复制受版权保护的官方题目。</p>
        </header>
        <div className="pmp-resource-list">
          {data.officialResources.map((resource) => (
            <a href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>
              <span>{resource.kind}</span>
              <div><h3>{resource.title}</h3><p>{resource.description}</p><small>{resource.publisher}</small></div>
              <ExternalLink size={20} />
            </a>
          ))}
        </div>
      </section>

      {data.recentResults.length > 0 ? (
        <section className="pmp-content-section" aria-labelledby="pmp-history-title">
          <header className="pmp-section-heading">
            <div><span>RECENT PRACTICE</span><h2 id="pmp-history-title">最近练习</h2></div>
          </header>
          <div className="pmp-result-list">
            {data.recentResults.map((result) => (
              <Link to={`/modules/pmp/results/${result.id}`} key={result.id}>
                <strong>{result.score}<small>分</small></strong>
                <span><b>{result.examTitle}</b><small>{formatDate(result.submittedAt)} · {formatDuration(result.durationSeconds)}</small></span>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
