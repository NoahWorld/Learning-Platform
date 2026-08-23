import { ArrowRight, BriefcaseBusiness, Languages, Landmark, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { learningModules, type LearningModuleId } from "../modules";

const moduleIcons = {
  "human-resources": BriefcaseBusiness,
  economics: Landmark,
  english: Languages,
} satisfies Record<LearningModuleId, typeof BriefcaseBusiness>;

function requestedHumanResourcesPath(state: unknown) {
  if (!state || typeof state !== "object" || !("from" in state)) return "/";
  const from = String(state.from);
  const humanResourcesPrefixes = ["/exams", "/mistakes", "/results"];
  if (from === "/" || humanResourcesPrefixes.some((prefix) => from === prefix || from.startsWith(`${prefix}/`))) {
    return from;
  }
  return "/";
}

export function ModuleSelectionPage() {
  const location = useLocation();
  const humanResourcesRoute = requestedHumanResourcesPath(location.state);

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="module-page">
      <ModuleTopBar />
      <main className="module-selection-main">
        <section className="module-selection-heading">
          <div>
            <span className="mini-kicker"><Sparkles size={15} /> CHOOSE YOUR WORKSPACE</span>
            <h1>选择学习模块</h1>
            <p>每个模块拥有独立的内容与进度，选择一个方向继续学习。</p>
          </div>
          <div className="module-heading-note" aria-hidden="true">
            <span>当前 {learningModules.length} 个模块</span>
            <strong>独立学习<br />持续扩充</strong>
          </div>
        </section>

        <section className="module-card-grid" aria-label="学习模块">
          {learningModules.map((learningModule) => {
            const Icon = moduleIcons[learningModule.id];
            const route = learningModule.id === "human-resources"
              ? humanResourcesRoute
              : learningModule.route;
            return (
              <Link
                className={`module-card ${learningModule.color}`}
                to={route}
                key={learningModule.id}
              >
                <div className="module-card-meta">
                  <span>MODULE · {learningModule.number}</span>
                  <i className={learningModule.status}>{learningModule.status === "ready" ? "已上线" : "筹备中"}</i>
                </div>
                <div className="module-card-heading">
                  <span className="module-card-icon"><Icon size={27} aria-hidden="true" /></span>
                  <div>
                    <span className="module-card-category">{learningModule.category}</span>
                    <h2>{learningModule.shortTitle}</h2>
                  </div>
                </div>
                <p>{learningModule.description}</p>
                <ul aria-label={`${learningModule.title}功能`}>
                  {learningModule.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
                <span className="module-card-action">
                  <span>{learningModule.status === "ready" ? "进入工作台" : "查看模块"}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>

        <p className="module-selection-footnote">以后新增其他学习类型，也会作为新的独立卡片出现在这里。</p>
      </main>
    </div>
  );
}
