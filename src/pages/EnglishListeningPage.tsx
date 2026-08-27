import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Ear,
  Gauge,
  Headphones,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState } from "../components/PageBits";
import { phonemeGroups } from "../englishContent";
import type { ListeningListResponse, ListeningSceneSummary } from "../types";
import { useEnglishSpeech } from "../useEnglishSpeech";
import { useRemote } from "../useRemote";

function progressLabel(scene: ListeningSceneSummary) {
  if (scene.progress.bestScore === 100) return "已掌握";
  if (scene.progress.bestScore !== null) return `最好 ${scene.progress.bestScore} 分`;
  return "未开始";
}

export function EnglishListeningPage() {
  const { data, loading, error } = useRemote<ListeningListResponse>(
    (signal) => apiGet("/api/english/listening", signal),
    [],
  );
  const { activeSpeech, play, speechError } = useEnglishSpeech();
  const phonemeCount = useMemo(
    () => phonemeGroups.reduce((count, group) => count + group.items.length, 0),
    [],
  );

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="module-page english-listening-page">
      <ModuleTopBar compact />
      <main className="english-listening-main">
        <Link className="module-back-link" to="/modules/english"><ArrowLeft size={17} /> 返回英语课程</Link>

        <section className="listening-hero">
          <div className="listening-hero-copy">
            <span className="mini-kicker"><Sparkles size={15} /> LISTEN FIRST · 只练听懂</span>
            <h1><span>LISTENING</span><strong>听</strong></h1>
            <p>不看原文先听，带着问题再听，提交后逐句精析，最后换一种口音复测。</p>
            <div className="listening-hero-facts">
              <span><Headphones size={16} /> {data?.summary.sceneCount ?? 6} 个场景</span>
              <span><CheckCircle2 size={16} /> {data?.summary.practicedSceneCount ?? 0} 个已练</span>
              <span><Volume2 size={16} /> {phonemeCount} 个发音参考</span>
            </div>
          </div>
          <div className="listening-hero-art" aria-hidden="true">
            <span className="listening-headphones"><Headphones size={82} /></span>
            <b>HEAR</b><b>IT!</b>
            <i>♪</i><i>♫</i>
          </div>
        </section>

        <section className="listening-path" aria-label="听力训练流程">
          <div><b>01</b><span><strong>盲听</strong><small>先抓大意</small></span></div>
          <div><b>02</b><span><strong>作答</strong><small>锁定细节</small></span></div>
          <div><b>03</b><span><strong>精析</strong><small>核对原文</small></span></div>
          <div><b>04</b><span><strong>复测</strong><small>切换口音</small></span></div>
        </section>

        {speechError ? <div className="listening-speech-error" role="alert">{speechError}</div> : null}

        <section className="listening-section scene-section" aria-labelledby="scene-title">
          <header className="listening-section-heading">
            <div>
              <span>01 · REAL-LIFE LISTENING</span>
              <h2 id="scene-title">从真实场景开始</h2>
            </div>
            <p><Ear size={17} /> 每个场景 3 道题，提交前不显示原文。</p>
          </header>

          {loading ? <LoadingState label="正在准备听力场景…" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {data ? (
            <div className="listening-scene-grid">
              {data.scenes.map((scene) => {
                const speechId = `preview-${scene.id}`;
                const isPlaying = activeSpeech === speechId;
                return (
                  <article className={`listening-scene-card ${scene.tone}`} key={scene.id}>
                    <header>
                      <span>{scene.number}</span>
                      <div>
                        <small>{scene.englishTitle}</small>
                        <h3>{scene.chineseTitle}</h3>
                      </div>
                      <em className={scene.progress.bestScore === 100 ? "mastered" : ""}>
                        {progressLabel(scene)}
                      </em>
                    </header>
                    <p>{scene.context}</p>
                    <div className="listening-scene-meta">
                      <span><Gauge size={14} /> {scene.level}</span>
                      <span><Clock3 size={14} /> {scene.duration}</span>
                      {scene.progress.attemptCount > 0 ? <span>已练 {scene.progress.attemptCount} 次</span> : null}
                    </div>
                    <div className="listening-scene-footer">
                      <button
                        className="scene-preview-button"
                        type="button"
                        onClick={() => play(speechId, scene.speechText)}
                        aria-label={`${isPlaying ? "停止" : "试听"}${scene.chineseTitle}`}
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        {isPlaying ? "停止" : "先试听"}
                      </button>
                      <Link className="scene-start-link" to={`/modules/english/listening/${scene.id}`}>
                        {scene.progress.attemptCount > 0 ? "再练一次" : "开始精听"} <ArrowRight size={17} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <details className="phoneme-reference">
          <summary>
            <span><Volume2 size={19} /><strong>音标发音参考</strong><small>需要时再查，不作为听力训练起点</small></span>
            <b>展开 {phonemeCount} 个音标</b>
          </summary>
          <section className="listening-section phoneme-section" aria-labelledby="phoneme-title">
            <header className="listening-section-heading">
              <div>
                <span>02 · SOUND REFERENCE</span>
                <h2 id="phoneme-title">音标发音地图</h2>
              </div>
              <p><Volume2 size={17} /> 点击音标，听示例词的声音。</p>
            </header>
            <div className="phoneme-group-list">
              {phonemeGroups.map((group) => (
                <article className={`phoneme-group ${group.tone}`} key={group.englishTitle}>
                  <header>
                    <span>{group.englishTitle}</span>
                    <strong>{group.chineseTitle}</strong>
                    <i>{group.items.length} SOUNDS</i>
                  </header>
                  <div className="phoneme-grid">
                    {group.items.map((phoneme) => {
                      const speechId = `phoneme-${phoneme.symbol}`;
                      const isPlaying = activeSpeech === speechId;
                      return (
                        <button
                          className={isPlaying ? "playing" : ""}
                          type="button"
                          onClick={() => play(speechId, phoneme.example)}
                          aria-label={`${isPlaying ? "停止" : "播放"}音标 /${phoneme.symbol}/ 的示例词 ${phoneme.example}`}
                          key={phoneme.symbol}
                        >
                          <strong>/{phoneme.symbol}/</strong>
                          <small>{phoneme.example}</small>
                          {isPlaying ? <Pause size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </details>

        <aside className="listening-tip">
          <span>LISTENING LOOP</span>
          <strong>一听大意 → 二抓细节 → 三核对原文 → 四换声复测</strong>
          <p>同一个场景听懂三遍，比一次堆很多材料更有效。</p>
        </aside>
      </main>
    </div>
  );
}
