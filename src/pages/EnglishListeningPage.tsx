import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Ear,
  Gauge,
  Headphones,
  Pause,
  Play,
  Rabbit,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { listeningScenes, phonemeGroups } from "../englishContent";

type SpeechRate = "normal" | "slow";

function useEnglishSpeech() {
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const supported = typeof window !== "undefined"
    && "speechSynthesis" in window
    && "SpeechSynthesisUtterance" in window;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setActiveSpeech(null);
  }

  function play(id: string, text: string, rate: SpeechRate = "normal") {
    setSpeechError(null);
    if (!supported) {
      setSpeechError("当前浏览器不支持语音播放，请更换最新版 Chrome、Edge 或 Safari。");
      return;
    }
    if (activeSpeech === id) {
      stop();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate === "slow" ? 0.68 : 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setActiveSpeech((current) => current === id ? null : current);
    utterance.onerror = (event) => {
      setActiveSpeech((current) => current === id ? null : current);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setSpeechError(`“${text.slice(0, 28)}…”播放失败：${event.error}`);
      }
    };
    setActiveSpeech(id);
    window.speechSynthesis.speak(utterance);
  }

  return { activeSpeech, play, speechError };
}

export function EnglishListeningPage() {
  const [revealedScenes, setRevealedScenes] = useState<Set<string>>(() => new Set());
  const { activeSpeech, play, speechError } = useEnglishSpeech();
  const phonemeCount = useMemo(
    () => phonemeGroups.reduce((count, group) => count + group.items.length, 0),
    [],
  );

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  function toggleTranscript(sceneId: string) {
    setRevealedScenes((current) => {
      const next = new Set(current);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }

  return (
    <div className="module-page english-listening-page">
      <ModuleTopBar compact />
      <main className="english-listening-main">
        <Link className="module-back-link" to="/modules/english"><ArrowLeft size={17} /> 返回英语模块</Link>

        <section className="listening-hero">
          <div className="listening-hero-copy">
            <span className="mini-kicker"><Sparkles size={15} /> LISTEN FIRST · 先听懂</span>
            <h1><span>LISTENING</span><strong>听</strong></h1>
            <p>先辨认声音，再抓住关键词，最后把英语放回真实场景里。</p>
            <div className="listening-hero-facts">
              <span><Volume2 size={16} /> {phonemeCount} 个音标</span>
              <span><Headphones size={16} /> {listeningScenes.length} 个场景</span>
            </div>
          </div>
          <div className="listening-hero-art" aria-hidden="true">
            <span className="listening-headphones"><Headphones size={82} /></span>
            <b>HEAR</b><b>IT!</b>
            <i>♪</i><i>♫</i>
          </div>
        </section>

        {speechError ? <div className="listening-speech-error" role="alert">{speechError}</div> : null}

        <section className="listening-section phoneme-section" aria-labelledby="phoneme-title">
          <header className="listening-section-heading">
            <div>
              <span>01 · SOUND MAP</span>
              <h2 id="phoneme-title">音标发音地图</h2>
            </div>
            <p><Volume2 size={17} /> 点击任意音标，先听示例词。</p>
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

        <section className="listening-section scene-section" aria-labelledby="scene-title">
          <header className="listening-section-heading">
            <div>
              <span>02 · REAL-LIFE LISTENING</span>
              <h2 id="scene-title">场景英语听力</h2>
            </div>
            <p><Ear size={17} /> 先不看原文听一遍，再用慢速核对。</p>
          </header>

          <div className="listening-scene-grid">
            {listeningScenes.map((scene) => {
              const normalSpeechId = `scene-${scene.id}-normal`;
              const slowSpeechId = `scene-${scene.id}-slow`;
              const normalPlaying = activeSpeech === normalSpeechId;
              const slowPlaying = activeSpeech === slowSpeechId;
              const revealed = revealedScenes.has(scene.id);
              return (
                <article className={`listening-scene-card ${scene.tone}`} key={scene.id}>
                  <header>
                    <span>{scene.number}</span>
                    <div>
                      <small>{scene.englishTitle}</small>
                      <h3>{scene.chineseTitle}</h3>
                    </div>
                  </header>
                  <p>{scene.context}</p>
                  <div className="listening-scene-meta">
                    <span><Gauge size={14} /> {scene.level}</span>
                    <span><Clock3 size={14} /> {scene.duration}</span>
                  </div>
                  <div className="listening-scene-actions">
                    <button type="button" onClick={() => play(normalSpeechId, scene.speechText)}>
                      {normalPlaying ? <Pause size={16} /> : <Play size={16} />}
                      {normalPlaying ? "停止" : "播放英语"}
                    </button>
                    <button type="button" onClick={() => play(slowSpeechId, scene.speechText, "slow")}>
                      {slowPlaying ? <Pause size={16} /> : <Rabbit size={16} />}
                      {slowPlaying ? "停止" : "慢速"}
                    </button>
                  </div>
                  <button
                    className="transcript-toggle"
                    type="button"
                    onClick={() => toggleTranscript(scene.id)}
                    aria-expanded={revealed}
                  >
                    <BookOpen size={15} /> {revealed ? "收起英文原文" : "听完再看原文"}
                  </button>
                  {revealed ? (
                    <div className="listening-transcript">
                      {scene.transcript.map((line) => <p key={line}>{line}</p>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="listening-tip">
          <span>LISTENING LOOP</span>
          <strong>一听声音 → 二抓关键词 → 三看原文 → 四跟读</strong>
          <p>同一个场景重复三遍，比一次听很多内容更有效。</p>
        </aside>
      </main>
    </div>
  );
}
