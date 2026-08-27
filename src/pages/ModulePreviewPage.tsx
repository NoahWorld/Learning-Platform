import { ArrowLeft, Construction, Landmark } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { getLearningModule } from "../modules";

const previewIcons = {
  economics: Landmark,
};

export function ModulePreviewPage({ moduleId }: { moduleId: "economics" }) {
  const learningModule = getLearningModule(moduleId);
  const HeroIcon = previewIcons[moduleId];

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [moduleId]);

  return (
    <div className={`module-page module-preview-page ${learningModule.color}`}>
      <ModuleTopBar compact />
      <main className="module-preview-main">
        <Link className="module-back-link" to="/modules"><ArrowLeft size={17} /> 返回课程选择</Link>

        <section className="module-preview-hero">
          <div className="module-preview-copy">
            <span className="mini-kicker">{learningModule.eyebrow}</span>
            <h1>{learningModule.title}</h1>
            <p>{learningModule.description}</p>
            <div className="module-preparing-badge"><Construction size={17} /> 内容准备中</div>
          </div>
          <div className="module-preview-art" aria-hidden="true">
            <span className="preview-icon"><HeroIcon size={76} /></span>
            <strong>{learningModule.shortTitle}</strong>
            <i>COMING SOON</i>
          </div>
        </section>

      </main>
    </div>
  );
}
