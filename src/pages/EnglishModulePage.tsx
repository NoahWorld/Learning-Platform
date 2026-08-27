import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Ear,
  MessageCircleMore,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ModuleTopBar } from "../components/ModuleTopBar";

const englishSkills = [
  {
    number: "01",
    english: "LISTENING",
    chinese: "听",
    description: "音标发音与真实场景听力",
    status: "ready",
    route: "/modules/english/listening",
    tone: "yellow",
    icon: Ear,
  },
  {
    number: "02",
    english: "SPEAKING",
    chinese: "说",
    description: "跟读、情景对话与口语表达",
    status: "preparing",
    tone: "blue",
    icon: MessageCircleMore,
  },
  {
    number: "03",
    english: "READING",
    chinese: "读",
    description: "分级阅读与重点词句理解",
    status: "preparing",
    tone: "pink",
    icon: BookOpenText,
  },
  {
    number: "04",
    english: "WRITING",
    chinese: "写",
    description: "句型积累与实用写作练习",
    status: "preparing",
    tone: "green",
    icon: PenLine,
  },
] as const;

export function EnglishModulePage() {
  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="module-page english-module-page">
      <ModuleTopBar compact />
      <main className="english-module-main">
        <Link className="module-back-link" to="/modules"><ArrowLeft size={17} /> 返回模块选择</Link>

        <section className="english-module-hero">
          <div>
            <span className="mini-kicker"><Sparkles size={15} /> ENGLISH LAB · 英语实验室</span>
            <h1>Learn it.<br /><em>Use it.</em></h1>
            <p>从真实声音和日常场景开始，把英语拆成听、说、读、写四个独立板块。</p>
          </div>
          <div className="english-hero-sticker" aria-hidden="true">
            <strong>Aa</strong>
            <span>/ˈɪŋɡlɪʃ/</span>
            <i>START SMALL<br />GO EVERY DAY!</i>
          </div>
        </section>

        <section className="english-skill-section" aria-labelledby="english-skills-title">
          <header className="english-section-heading">
            <div>
              <span>FOUR CORE SKILLS</span>
              <h2 id="english-skills-title">四大板块</h2>
            </div>
            <p>今天，从「听」开始。</p>
          </header>

          <div className="english-skill-grid">
            {englishSkills.map((skill) => {
              const Icon = skill.icon;
              const content = (
                <>
                  <div className="english-skill-meta">
                    <span>{skill.number}</span>
                    <i>{skill.status === "ready" ? "已开放" : "筹备中"}</i>
                  </div>
                  <Icon size={30} aria-hidden="true" />
                  <h3><span>{skill.english}</span><strong>{skill.chinese}</strong></h3>
                  <p>{skill.description}</p>
                  <div className="english-skill-action">
                    {skill.status === "ready" ? "开始学习" : "即将开放"}
                    {skill.status === "ready" ? <ArrowRight size={17} aria-hidden="true" /> : null}
                  </div>
                </>
              );

              return skill.status === "ready" ? (
                <Link className={`english-skill-card ${skill.tone}`} to={skill.route} key={skill.english}>
                  {content}
                </Link>
              ) : (
                <article className={`english-skill-card ${skill.tone} disabled`} key={skill.english}>
                  {content}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
