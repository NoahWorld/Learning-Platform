import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Headphones,
  Pause,
  Play,
  Rabbit,
  RefreshCw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState } from "../components/PageBits";
import type { ListeningSceneResponse, ListeningSubmissionResult } from "../types";
import { useAudioPlayback } from "../useAudioPlayback";
import { useRemote } from "../useRemote";

export function EnglishListeningPracticePage() {
  const { sceneId = "" } = useParams();
  const { data, loading, error } = useRemote<ListeningSceneResponse>(
    (signal) => apiGet(`/api/english/listening/${encodeURIComponent(sceneId)}`, signal),
    [sceneId],
  );
  const { activeAudio, play, audioError, stop } = useAudioPlayback();
  const [listenCount, setListenCount] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ListeningSubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const scene = data?.scene;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = Boolean(scene) && listenCount > 0 && answeredCount === scene?.questions.length;
  const resultByQuestion = useMemo(
    () => new Map(result?.answers.map((answer) => [answer.questionId, answer]) ?? []),
    [result],
  );

  async function playScene(rate: "normal" | "slow") {
    if (!scene) return;
    const started = await play(rate, scene.audioUrl, rate);
    if (started) setListenCount((count) => count + 1);
  }

  async function submitListening() {
    if (!scene || !canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const submission = await apiPost<ListeningSubmissionResult>(
        `/api/english/listening/${encodeURIComponent(scene.id)}/submissions`,
        {
          accent: "us",
          listenCount,
          durationSeconds: Math.min(3600, Math.max(0, Math.round((Date.now() - startedAt) / 1000))),
          answers: scene.questions.map((question) => ({
            questionId: question.id,
            optionId: answers[question.id],
          })),
        },
      );
      stop();
      setResult(submission);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submissionError) {
      setSubmitError(submissionError instanceof Error ? submissionError.message : "听力答案提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function resetPractice() {
    stop();
    setAnswers({});
    setListenCount(0);
    setResult(null);
    setSubmitError(null);
    setStartedAt(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="module-page listening-practice-page">
      <ModuleTopBar compact />
      <main className="listening-practice-main">
        <Link className="module-back-link" to="/modules/english/listening">
          <ArrowLeft size={17} /> 返回听力场景
        </Link>

        {loading ? <LoadingState label="正在打开听力训练…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {scene ? (
          <>
            <header className={`listening-practice-hero ${scene.tone}`}>
              <div className="listening-practice-number">{scene.number}</div>
              <div>
                <span><Sparkles size={15} /> FOCUSED LISTENING</span>
                <h1>{scene.chineseTitle}</h1>
                <p>{scene.englishTitle} · {scene.context}</p>
              </div>
              <div className="listening-practice-history">
                <small>个人记录</small>
                <strong>{scene.progress.bestScore === null ? "首次练习" : `最好 ${scene.progress.bestScore} 分`}</strong>
                <span>{scene.level} · {scene.duration}</span>
              </div>
            </header>

            <nav className="practice-stepper" aria-label="当前练习步骤">
              <span className={!result ? "active" : "done"}><b>1</b> 盲听</span>
              <span className={!result ? "active" : "done"}><b>2</b> 作答</span>
              <span className={result ? "active" : ""}><b>3</b> 精析</span>
              <span className={result ? "active" : ""}><b>4</b> 慢速复测</span>
            </nav>

            <section className="listening-player" aria-labelledby="player-title">
              <div className="listening-player-copy">
                <span>BLIND LISTENING</span>
                <h2 id="player-title">先闭上“字幕”，只用耳朵听</h2>
                <p>{result ? "现在可以结合原文，用正常或慢速再听一遍。" : "第一遍听场景，第二遍带着问题抓人物、地点、数字和动作。"}</p>
              </div>
              <div className="human-audio-source">
                <span>HUMAN AUDIO</span>
                <a href={scene.audioSource.pageUrl} target="_blank" rel="noreferrer">真人美音 · 官方来源</a>
              </div>
              <div className="listening-play-controls">
                <button className="primary" type="button" onClick={() => void playScene("normal")}>
                  {activeAudio === "normal" ? <Pause /> : <Play />}
                  <span><small>NORMAL</small><strong>{activeAudio === "normal" ? "停止播放" : "正常速度"}</strong></span>
                </button>
                <button type="button" onClick={() => void playScene("slow")}>
                  {activeAudio === "slow" ? <Pause /> : <Rabbit />}
                  <span><small>SLOW</small><strong>{activeAudio === "slow" ? "停止播放" : "慢速再听"}</strong></span>
                </button>
              </div>
              <div className="listen-count"><Headphones size={17} /> 本轮已播放 <strong>{listenCount}</strong> 次</div>
              {audioError ? <div className="listening-speech-error" role="alert">{audioError}</div> : null}
            </section>

            {!result ? (
              <section className="listening-quiz" aria-labelledby="quiz-title">
                <header>
                  <span>LISTEN & CHOOSE</span>
                  <h2 id="quiz-title">你听到了什么？</h2>
                  <p>共 {scene.questions.length} 题，全部作答后才能查看原文和解析。</p>
                </header>
                <div className="listening-question-list">
                  {scene.questions.map((question, questionIndex) => (
                    <fieldset className="listening-question" key={question.id}>
                      <legend><b>{String(questionIndex + 1).padStart(2, "0")}</b>{question.prompt}</legend>
                      <div className="listening-choice-list">
                        {question.options.map((option) => (
                          <button
                            className={answers[question.id] === option.id ? "selected" : ""}
                            type="button"
                            onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                            key={option.id}
                          >
                            <span>{option.label}</span><strong>{option.content}</strong>
                            {answers[question.id] === option.id ? <Check size={18} /> : null}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <div className="listening-submit-panel">
                  <p>
                    {listenCount === 0
                      ? "请至少播放一次听力，再提交答案。"
                      : answeredCount < scene.questions.length
                        ? `还差 ${scene.questions.length - answeredCount} 题未作答。`
                        : "已经准备好，可以揭晓听力结果。"}
                  </p>
                  {submitError ? <div className="listening-speech-error" role="alert">{submitError}</div> : null}
                  <button type="button" disabled={!canSubmit || submitting} onClick={() => void submitListening()}>
                    {submitting ? "正在提交…" : "提交并查看精析"} <CheckCircle2 size={18} />
                  </button>
                </div>
              </section>
            ) : (
              <section className="listening-result" aria-labelledby="result-title">
                <header>
                  <div className={result.score === 100 ? "mastered" : ""}>
                    <strong>{result.score}</strong><small>分</small>
                  </div>
                  <span>
                    <small>LISTENING RESULT</small>
                    <h2 id="result-title">{result.score === 100 ? "这段听懂了！" : "找到没听清的地方"}</h2>
                    <p>答对 {result.correctCount}/{result.totalQuestions} 题 · 播放 {result.listenCount} 次</p>
                  </span>
                </header>

                <div className="listening-answer-review">
                  {scene.questions.map((question, questionIndex) => {
                    const review = resultByQuestion.get(question.id);
                    const correctOption = question.options.find((option) => option.id === review?.correctOptionId);
                    return (
                      <article className={review?.isCorrect ? "correct" : "wrong"} key={question.id}>
                        <span>{review?.isCorrect ? <Check size={18} /> : <X size={18} />}</span>
                        <div>
                          <small>QUESTION {String(questionIndex + 1).padStart(2, "0")}</small>
                          <h3>{question.prompt}</h3>
                          <p>正确答案：{correctOption?.label} · {correctOption?.content}</p>
                          <em>{review?.explanation}</em>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <section className="transcript-analysis">
                  <header>
                    <span>TRANSCRIPT ANALYSIS</span>
                    <h2>逐句听力精析</h2>
                    <p>现在才打开原文：看哪里没听清，再回到上方播放。</p>
                  </header>
                  <div>
                    {result.transcript.map((line, index) => (
                      <article className="transcript-line" key={`${line.speaker}-${index}`}>
                        <b>{line.speaker}</b>
                        <div>
                          <strong>{line.text}</strong>
                          <p>{line.translation}</p>
                          <small><Volume2 size={14} /> {line.note}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <footer className="listening-result-actions">
                  <button type="button" onClick={resetPractice}><RefreshCw size={17} /> 清空答案再练</button>
                  <Link to="/modules/english/listening"><ArrowLeft size={17} /> 返回其他场景</Link>
                  <span><Clock3 size={15} /> 本次用时 {result.durationSeconds} 秒</span>
                </footer>
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
