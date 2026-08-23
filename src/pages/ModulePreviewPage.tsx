import { ArrowLeft, BookOpen, ClipboardCheck, Construction, Languages, Landmark, LineChart } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { getLearningModule, type LearningModuleId } from "../modules";

const previewIcons = {
  economics: Landmark,
  english: Languages,
} satisfies Record<Exclude<LearningModuleId, "human-resources">, typeof Landmark>;

export function ModulePreviewPage({ moduleId }: { moduleId: "economics" | "english" }) {
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
        <Link className="module-back-link" to="/modules"><ArrowLeft size={17} /> 返回模块选择</Link>

        <section className="module-preview-hero">
          <div className="module-preview-copy">
            <span className="mini-kicker">{learningModule.eyebrow}</span>
            <h1>{learningModule.title}</h1>
            <p>{learningModule.description}</p>
            <div className="module-preparing-badge"><Construction size={17} /> 独立模块已建立，内容待补充</div>
          </div>
          <div className="module-preview-art" aria-hidden="true">
            <span className="preview-icon"><HeroIcon size={76} /></span>
            <strong>{learningModule.shortTitle}</strong>
            <i>COMING SOON</i>
          </div>
        </section>

        <section className="module-preview-features" aria-label="计划功能">
          <article>
            <BookOpen size={27} />
            <span>01</span>
            <h2>学习内容</h2>
            <p>后续录入本模块自己的资料和知识点，不与人力资源内容混用。</p>
          </article>
          <article>
            <ClipboardCheck size={27} />
            <span>02</span>
            <h2>练习与自测</h2>
            <p>题库接入后提供专项练习和模拟测试，并单独记录作答结果。</p>
          </article>
          <article>
            <LineChart size={27} />
            <span>03</span>
            <h2>学习进度</h2>
            <p>按模块汇总成绩、错题和学习进度，避免不同学科相互干扰。</p>
          </article>
        </section>
      </main>
    </div>
  );
}
