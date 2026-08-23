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
            <h1>今天想学哪一类？</h1>
            <p>每个模块拥有独立的内容入口。先选方向，再进入对应的学习工作台。</p>
          </div>
          <div className="module-heading-note" aria-hidden="true">
            <span>三个方向</span>
            <strong>任选一个<br />马上开练！</strong>
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
                <span className="module-card-number" aria-hidden="true">{learningModule.number}</span>
                <div className="module-card-meta">
                  <span>{learningModule.eyebrow}</span>
                  <i className={learningModule.status}>{learningModule.status === "ready" ? "已上线" : "待补充内容"}</i>
                </div>
                <span className="module-card-icon"><Icon size={38} aria-hidden="true" /></span>
                <h2>{learningModule.title}</h2>
                <p>{learningModule.description}</p>
                <ul aria-label={`${learningModule.title}功能`}>
                  {learningModule.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
                <span className="module-card-action">
                  {learningModule.status === "ready" ? "进入现有工作台" : "进入模块首页"}
                  <ArrowRight size={20} aria-hidden="true" />
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
