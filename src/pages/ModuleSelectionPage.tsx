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
            <span className="mini-kicker"><Sparkles size={15} /> CHOOSE YOUR COURSE</span>
            <h1>今天学什么？</h1>
            <p>选一个方向，继续今天的学习。</p>
          </div>
        </section>

        <section className="module-card-grid" aria-label="学习课程">
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
                  <span>COURSE · {learningModule.number}</span>
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
                  <span>{learningModule.status === "ready" ? "开始学习" : "查看详情"}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
