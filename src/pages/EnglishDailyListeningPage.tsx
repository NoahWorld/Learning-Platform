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
  Target,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState } from "../components/PageBits";
import type {
  DailyListeningStoryResponse,
  DailyListeningSubmissionResult,
} from "../types";
import { useAudioPlayback } from "../useAudioPlayback";
import { useRemote } from "../useRemote";

type SubtitleMode = "none" | "english" | "bilingual";

function timeLabel(seconds: number) {
  return `0:${String(seconds).padStart(2, "0")}`;
}

export function EnglishDailyListeningPage() {
  const { storyId = "" } = useParams();
  const { data, loading, error } = useRemote<DailyListeningStoryResponse>(
    (signal) => apiGet(`/api/english/daily-listening/${encodeURIComponent(storyId)}`, signal),
    [storyId],
  );
  const { activeAudio, play, audioError, stop } = useAudioPlayback();
  const [listenCount, setListenCount] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DailyListeningSubmissionResult | null>(null);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>("bilingual");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const story = data?.story;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = Boolean(story) && listenCount > 0 && answeredCount === story?.questions.length;
  const resultByQuestion = useMemo(
    () => new Map(result?.answers.map((answer) => [answer.questionId, answer]) ?? []),
    [result],
  );

  async function playStory(rate: "normal" | "slow", audioId: string = rate) {
    if (!story) return;
    const started = await play(audioId, story.audioUrl, rate);
    if (started) setListenCount((count) => count + 1);
  }

  async function submitListening() {
    if (!story || !canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const submission = await apiPost<DailyListeningSubmissionResult>(
        `/api/english/daily-listening/${encodeURIComponent(story.id)}/submissions`,
        {
          listenCount,
          durationSeconds: Math.min(3600, Math.max(0, Math.round((Date.now() - startedAt) / 1000))),
          answers: story.questions.map((question) => ({
            questionId: question.id,
            optionId: answers[question.id],
          })),
        },
      );
      stop();
      setResult(submission);
      setSubtitleMode("bilingual");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submissionError) {
      setSubmitError(
        submissionError instanceof Error ? submissionError.message : "每日听闻答案提交失败",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetPractice() {
    stop();
    setAnswers({});
    setListenCount(0);
    setResult(null);
    setSubtitleMode("bilingual");
    setSubmitError(null);
    setStartedAt(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function replayWithoutSubtitles() {
    setSubtitleMode("none");
    await playStory("normal", "final-replay");
  }

  return (
    <div className="module-page daily-listening-page">
      <ModuleTopBar compact />
      <main className="daily-listening-main">
        <Link className="module-back-link" to="/modules/english/listening">
          <ArrowLeft size={17} /> 返回听力首页
        </Link>

        {loading ? <LoadingState label="正在打开今日听闻…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {story ? (
          <>
            <header className="daily-practice-hero">
              <div className="daily-practice-number">
                <small>DAILY</small>
                <strong>{story.number}</strong>
              </div>
              <div className="daily-practice-title">
                <span><Sparkles size={15} /> {story.category} · {story.accent} · {story.duration}</span>
                <small>{story.englishTitle}</small>
                <h1>{story.chineseTitle}</h1>
              </div>
              <div className="daily-practice-progress">
                <small>个人记录</small>
                <strong>
                  {story.progress.bestScore === null ? "首次练习" : `最好 ${story.progress.bestScore} 分`}
                </strong>
                <span>只需抓住主旨和关键词</span>
              </div>
            </header>

            <nav className="daily-practice-stepper" aria-label="每日听闻训练流程">
              <span className={!result ? "active" : "done"}><b>1</b> 看背景</span>
              <span className={!result ? "active" : "done"}><b>2</b> 盲听作答</span>
              <span className={result ? "active" : ""}><b>3</b> 字幕核对</span>
              <span className={result ? "active" : ""}><b>4</b> 无字幕复听</span>
            </nav>

            <section className="daily-listening-primer" aria-labelledby="daily-primer-title">
              <div className="daily-context-card">
                <span>BACKGROUND · 听前背景</span>
                <h2 id="daily-primer-title">先知道它在谈什么，不提前看答案</h2>
                <p>{story.background}</p>
                <strong><Target size={17} /> {story.listeningGoal}</strong>
              </div>
              <div className="daily-keyword-card">
                <span>5 KEYWORDS · 五个关键词</span>
                <div className="daily-keyword-list">
                  {story.keywords.map((keyword) => (
                    <article key={keyword.word}>
                      <strong>{keyword.word}</strong>
                      <small>{keyword.phonetic}</small>
                      <span>{keyword.meaning}</span>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="daily-audio-player" aria-labelledby="daily-player-title">
              <div>
                <span>HUMAN AUDIO · 真人原声</span>
                <h2 id="daily-player-title">第一遍，不看字幕</h2>
                <p>
                  {result
                    ? "答案已经揭晓，可以用字幕核对；最后记得再关掉字幕听一次。"
                    : "先完整听一遍抓主旨，再带着下面 3 个问题听第二遍。听不懂每个词也没关系。"}
                </p>
              </div>
              <div className="daily-audio-actions">
                <button className="primary" type="button" onClick={() => void playStory("normal")}>
                  {activeAudio === "normal" ? <Pause /> : <Play />}
                  <span><small>NORMAL</small><strong>{activeAudio === "normal" ? "停止播放" : "正常速度"}</strong></span>
                </button>
                <button type="button" onClick={() => void playStory("slow")}>
                  {activeAudio === "slow" ? <Pause /> : <Rabbit />}
                  <span><small>SLOW</small><strong>{activeAudio === "slow" ? "停止播放" : "慢速再听"}</strong></span>
                </button>
              </div>
              <div className="daily-audio-foot">
                <span><Headphones size={17} /> 本轮已播放 <strong>{listenCount}</strong> 次</span>
                <a href={story.source.pageUrl} target="_blank" rel="noreferrer">
                  {story.source.publisher} · 查看来源
                </a>
              </div>
              {audioError ? <div className="listening-speech-error" role="alert">{audioError}</div> : null}
            </section>

            {!result ? (
              <section className="daily-listening-quiz" aria-labelledby="daily-quiz-title">
                <header>
                  <span>QUICK CHECK</span>
                  <h2 id="daily-quiz-title">听懂大意就已经成功</h2>
                  <p>1 道主旨题 + 2 道细节题。可以重复播放，不限次数。</p>
                </header>
                <div className="listening-question-list">
                  {story.questions.map((question, questionIndex) => (
                    <fieldset className="listening-question" key={question.id}>
                      <legend>
                        <b>{String(questionIndex + 1).padStart(2, "0")}</b>
                        <span><small>{question.kind === "main" ? "主旨" : "细节"}</small>{question.prompt}</span>
                      </legend>
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
                      ? "请至少播放一次真人原声，再提交答案。"
                      : answeredCount < story.questions.length
                        ? `还差 ${story.questions.length - answeredCount} 题未作答。`
                        : "已经准备好，可以查看答案和逐句字幕。"}
                  </p>
                  {submitError ? <div className="listening-speech-error" role="alert">{submitError}</div> : null}
                  <button type="button" disabled={!canSubmit || submitting} onClick={() => void submitListening()}>
                    {submitting ? "正在提交…" : "提交并打开字幕"} <CheckCircle2 size={18} />
                  </button>
                </div>
              </section>
            ) : (
              <section className="daily-listening-result" aria-labelledby="daily-result-title">
                <header className="daily-result-summary">
                  <div className={result.score === 100 ? "mastered" : ""}>
                    <strong>{result.score}</strong><small>分</small>
                  </div>
                  <span>
                    <small>DAILY LISTEN RESULT</small>
                    <h2 id="daily-result-title">
                      {result.correctCount >= 2 ? "主旨已经抓住了" : "先找到最关键的那句话"}
                    </h2>
                    <p>答对 {result.correctCount}/{result.totalQuestions} 题 · 播放 {result.listenCount} 次</p>
                  </span>
                </header>

                <div className="listening-answer-review daily-answer-review">
                  {story.questions.map((question, questionIndex) => {
                    const review = resultByQuestion.get(question.id);
                    const correctOption = question.options.find(
                      (option) => option.id === review?.correctOptionId,
                    );
                    return (
                      <article className={review?.isCorrect ? "correct" : "wrong"} key={question.id}>
                        <span>{review?.isCorrect ? <Check size={18} /> : <X size={18} />}</span>
                        <div>
                          <small>{question.kind === "main" ? "MAIN IDEA" : `DETAIL ${questionIndex}`}</small>
                          <h3>{question.prompt}</h3>
                          <p>正确答案：{correctOption?.label} · {correctOption?.content}</p>
                          <em>{review?.explanation}</em>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <section className="daily-transcript" aria-labelledby="daily-transcript-title">
                  <header>
                    <div>
                      <span>TRANSCRIPT · 字幕核对</span>
                      <h2 id="daily-transcript-title">按自己的难度看字幕</h2>
                      <p>先用英文找没听清的词，需要时再打开中文。</p>
                    </div>
                    <div className="subtitle-mode-switch" aria-label="字幕显示方式">
                      {([
                        ["none", "无字幕"],
                        ["english", "英文"],
                        ["bilingual", "中英"],
                      ] as const).map(([mode, label]) => (
                        <button
                          className={subtitleMode === mode ? "active" : ""}
                          type="button"
                          onClick={() => setSubtitleMode(mode)}
                          key={mode}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </header>

                  {subtitleMode === "none" ? (
                    <div className="subtitles-off">
                      <Headphones size={28} />
                      <strong>字幕已关闭</strong>
                      <p>回到上方播放，看看这次能不能直接听出主旨和关键词。</p>
                    </div>
                  ) : (
                    <div className="daily-transcript-lines">
                      {result.transcript.map((line, index) => (
                        <article key={`${line.startSeconds}-${index}`}>
                          <time>{timeLabel(line.startSeconds)}–{timeLabel(line.endSeconds)}</time>
                          <div>
                            <strong>{line.text}</strong>
                            {subtitleMode === "bilingual" ? <p>{line.translation}</p> : null}
                            {subtitleMode === "bilingual" ? <small><Volume2 size={14} /> {line.note}</small> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="daily-final-replay">
                  <div>
                    <span>FINAL LISTEN</span>
                    <h2>最后关掉字幕，再完整听一遍</h2>
                    <p>能抓住 “speaking”“practice”“English club”，今天这一段就过关。</p>
                  </div>
                  <button type="button" onClick={() => void replayWithoutSubtitles()}>
                    {activeAudio === "final-replay" ? <Pause size={19} /> : <Play size={19} />}
                    {activeAudio === "final-replay" ? "停止播放" : "无字幕复听"}
                  </button>
                </section>

                <footer className="daily-result-actions">
                  <button type="button" onClick={resetPractice}><RefreshCw size={17} /> 清空答案再练</button>
                  <Link to="/modules/english/listening"><ArrowLeft size={17} /> 返回听力首页</Link>
                  <span><Clock3 size={15} /> 本次用时 {result.durationSeconds} 秒</span>
                </footer>
              </section>
            )}

            <p className="daily-source-credit">
              音频与原文：<a href={story.source.pageUrl} target="_blank" rel="noreferrer">{story.source.title}</a>
              ，{story.source.credit}。授权说明：
              <a href={story.source.licenseUrl} target="_blank" rel="noreferrer">{story.source.licenseName}</a>。
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
