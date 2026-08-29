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
  Target,
  Volume2,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState } from "../components/PageBits";
import type {
  DailyListeningListResponse,
  ListeningListResponse,
  ListeningSceneSummary,
} from "../types";
import { useAudioPlayback } from "../useAudioPlayback";
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
  const {
    data: dailyData,
    loading: dailyLoading,
    error: dailyError,
  } = useRemote<DailyListeningListResponse>(
    (signal) => apiGet("/api/english/daily-listening", signal),
    [],
  );
  const { activeAudio, audioError, errorAudioId, play: playAudio } = useAudioPlayback();
  const pronunciationSounds = data?.soundReference.sounds ?? [];
  const sceneAudioError = audioError && !errorAudioId?.startsWith("pronunciation-");
  const pronunciationAudioError = audioError && errorAudioId?.startsWith("pronunciation-");

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
            <p>不看原文先听，带着问题再听，提交后逐句精析，最后用慢速重听查漏。</p>
            <div className="listening-hero-facts">
              <span><Headphones size={16} /> {data?.summary.sceneCount ?? 10} 个场景</span>
              <span><CheckCircle2 size={16} /> {data?.summary.practicedSceneCount ?? 0} 个已练</span>
              <span><Volume2 size={16} /> {data ? pronunciationSounds.length : "—"} 组真人发音</span>
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
          <div><b>04</b><span><strong>复测</strong><small>正常 / 慢速</small></span></div>
        </section>

        <section className="daily-listening-section" aria-labelledby="daily-listening-title">
          <header className="listening-section-heading">
            <div>
              <span>DAILY LISTEN · 每日听闻</span>
              <h2 id="daily-listening-title">每天听懂一小段</h2>
            </div>
            <p><Headphones size={17} /> 短原声、少量关键词，只要求抓住主旨。</p>
          </header>
          {dailyLoading ? <LoadingState label="正在准备今日原声…" /> : null}
          {dailyError ? <ErrorState message={dailyError} /> : null}
          {dailyData ? (
            <div className="daily-listening-grid">
              {dailyData.stories.map((story) => (
                <article className="daily-listening-card" key={story.id}>
                  <div className="daily-listening-date">
                    <small>TODAY</small>
                    <strong>{story.durationSeconds}</strong>
                    <span>SEC</span>
                  </div>
                  <div className="daily-listening-card-copy">
                    <div className="daily-listening-eyebrow">
                      <span>{story.category}</span>
                      <span>{story.level}</span>
                      <span>{story.accent}</span>
                    </div>
                    <small>{story.englishTitle}</small>
                    <h3>{story.chineseTitle}</h3>
                    <p>{story.background}</p>
                    <div className="daily-listening-keyword-preview">
                      {story.keywords.map((keyword) => (
                        <span key={keyword.word}>{keyword.word}</span>
                      ))}
                    </div>
                  </div>
                  <div className="daily-listening-card-action">
                    <span><Target size={16} /> {story.questionCount} 个听力检查点</span>
                    <strong>
                      {story.progress.bestScore === null
                        ? "今天还没听"
                        : `最好 ${story.progress.bestScore} 分`}
                    </strong>
                    <Link to={`/modules/english/listening/daily/${story.id}`}>
                      {story.progress.attemptCount > 0 ? "再听一遍" : "开始今日听闻"}
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {sceneAudioError ? <div className="listening-speech-error" role="alert">{audioError}</div> : null}

        <section className="listening-section scene-section" aria-labelledby="scene-title">
          <header className="listening-section-heading">
            <div>
              <span>01 · HUMAN VOICES</span>
              <h2 id="scene-title">从真实场景开始</h2>
            </div>
            <p><Ear size={17} /> 每个场景 3 道题，提交前不显示原文。</p>
          </header>

          <p className="listening-source-note">
            真人美音来自美国国务院 American English：
            <a href="https://americanenglish.state.gov/resources/everyday-conversations-learning-american-english" target="_blank" rel="noreferrer">
              Everyday Conversations
            </a>
          </p>

          {loading ? <LoadingState label="正在准备听力场景…" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {data ? (
            <div className="listening-scene-grid">
              {data.scenes.map((scene) => {
                const audioId = `preview-${scene.id}`;
                const isPlaying = activeAudio === audioId;
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
                        onClick={() => void playAudio(audioId, scene.audioUrl)}
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

        <details className="pronunciation-reference">
          <summary>
            <span><Volume2 size={19} /><strong>真人元音发音参考</strong><small>先听完整记忆词组，再辨认其中共同的元音</small></span>
            <b>展开 {data ? pronunciationSounds.length : "—"} 组录音</b>
          </summary>
          <section className="listening-section pronunciation-section" aria-labelledby="pronunciation-title">
            <header className="listening-section-heading">
              <div>
                <span>02 · SOUND REFERENCE</span>
                <h2 id="pronunciation-title">美式元音声音地图</h2>
              </div>
              <p><Volume2 size={17} /> 每段完整读出记忆词组，不朗读音标符号。</p>
            </header>
            <p className="pronunciation-guide">
              例如先听 <strong>GREEN TEA</strong>，再留意两个词里共同的 <b>/i/</b>。建议先用正常速度，仍不清楚时再听慢速。
            </p>
            {pronunciationAudioError ? <div className="listening-speech-error" role="alert">{audioError}</div> : null}
            <div className="pronunciation-grid">
              {pronunciationSounds.map((sound) => {
                const normalId = `pronunciation-${sound.id}-normal`;
                const slowId = `pronunciation-${sound.id}-slow`;
                const normalPlaying = activeAudio === normalId;
                const slowPlaying = activeAudio === slowId;
                return (
                  <article className={`pronunciation-card ${sound.colorClass}`} key={sound.id}>
                    <header>
                      <span>{sound.number}</span>
                      <strong>/{sound.ipa}/</strong>
                    </header>
                    <h3>{sound.cue}</h3>
                    <div className="pronunciation-keywords" aria-label={`记忆词：${sound.keywords.join("、")}`}>
                      {sound.keywords.map((word) => <span key={word}>{word}</span>)}
                    </div>
                    <div className="pronunciation-controls">
                      <button
                        className={normalPlaying ? "playing" : ""}
                        type="button"
                        onClick={() => void playAudio(normalId, sound.audioUrl, "normal")}
                        aria-label={`${normalPlaying ? "停止" : "正常速度播放"} ${sound.cue}，元音 /${sound.ipa}/`}
                      >
                        {normalPlaying ? <Pause size={15} /> : <Play size={15} />} 正常
                      </button>
                      <button
                        className={slowPlaying ? "playing" : ""}
                        type="button"
                        onClick={() => void playAudio(slowId, sound.audioUrl, "slow")}
                        aria-label={`${slowPlaying ? "停止" : "慢速播放"} ${sound.cue}，元音 /${sound.ipa}/`}
                      >
                        {slowPlaying ? <Pause size={15} /> : <Volume2 size={15} />} 慢速
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {data ? (
              <p className="pronunciation-source-note">
                真人录音与记忆词组来自美国国务院 American English 的
                <a href={data.soundReference.source.pageUrl} target="_blank" rel="noreferrer">
                  {data.soundReference.source.title}
                </a>
                （{data.soundReference.source.authors}，
                <a href={data.soundReference.source.licenseUrl} target="_blank" rel="noreferrer">
                  {data.soundReference.source.licenseName}
                </a>）。
              </p>
            ) : null}
          </section>
        </details>

        <aside className="listening-tip">
          <span>LISTENING LOOP</span>
          <strong>一听大意 → 二抓细节 → 三核对原文 → 四慢速复测</strong>
          <p>同一个场景听懂三遍，比一次堆很多材料更有效。</p>
        </aside>
      </main>
    </div>
  );
}
