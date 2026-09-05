import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { ModuleTopBar } from "../components/ModuleTopBar";
import { ErrorState, LoadingState } from "../components/PageBits";
import type {
  AdminHomeworkAnswerResult,
  AdminHomeworkChapter,
  AdminHomeworkChapterResponse,
  AdminHomeworkQuestion,
} from "../types";
import { useRemote } from "../useRemote";

export function AdminHomeworkPracticePage() {
  const { chapterId = "" } = useParams();
  const loadChapter = useCallback(
    (signal: AbortSignal) => apiGet<AdminHomeworkChapterResponse>(
      `/api/admin/homework/${encodeURIComponent(chapterId)}/questions`,
      signal,
    ),
    [chapterId],
  );
  const { data, loading, error } = useRemote(loadChapter, [loadChapter]);
  const [chapter, setChapter] = useState<AdminHomeworkChapter | null>(null);
  const [questions, setQuestions] = useState<AdminHomeworkQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, AdminHomeworkAnswerResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.body.dataset.mode = "comic";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!data) return;
    setChapter(data.chapter);
    setQuestions(data.questions);
    const firstUnanswered = data.questions.findIndex((question) => question.attemptCount === 0);
    setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    setSelections({});
    setResults({});
    setSubmitError(null);
  }, [data]);

  const answeredThisSession = useMemo(() => Object.keys(results).length, [results]);

  function chooseOption(question: AdminHomeworkQuestion, optionId: string) {
    if (results[question.id] || submitting) return;
    setSelections((current) => {
      if (question.type === "single") {
        return { ...current, [question.id]: [optionId] };
      }
      const existing = current[question.id] ?? [];
      return {
        ...current,
        [question.id]: existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId],
      };
    });
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitAnswer(question: AdminHomeworkQuestion) {
    const selectedIds = selections[question.id] ?? [];
    if (selectedIds.length === 0 || submitting || results[question.id]) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answer = await apiPost<AdminHomeworkAnswerResult>(
        `/api/admin/homework/${encodeURIComponent(chapterId)}/questions/${encodeURIComponent(question.id)}/answer`,
        { optionIds: selectedIds },
      );
      setResults((current) => ({ ...current, [question.id]: answer }));
      setQuestions((current) => current.map((item) => (
        item.id === question.id
          ? {
              ...item,
              attemptCount: answer.attemptCount,
              wrongCount: answer.wrongCount,
              lastAnsweredAt: answer.submittedAt,
            }
          : item
      )));
      setChapter((current) => current ? { ...current, ...answer.chapterProgress } : current);
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function retryQuestion(questionId: string) {
    setSelections((current) => ({ ...current, [questionId]: [] }));
    setResults((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setSubmitError(null);
  }

  return (
    <div className="admin-page admin-homework-practice-page">
      <ModuleTopBar compact />
      <main className="homework-practice-main">
        <Link className="focus-back" to="/admin/homework">
          <ArrowLeft size={17} /> 返回课后作业
        </Link>

        {loading ? <LoadingState label="正在准备本章课后题…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && chapter && questions.length > 0 ? (
          <HomeworkPractice
            chapter={chapter}
            questions={questions}
            currentIndex={currentIndex}
            selections={selections}
            results={results}
            submitting={submitting}
            submitError={submitError}
            answeredThisSession={answeredThisSession}
            onChoose={chooseOption}
            onGoTo={goToQuestion}
            onSubmit={submitAnswer}
            onRetry={retryQuestion}
          />
        ) : null}
      </main>
    </div>
  );
}

function HomeworkPractice({
  chapter,
  questions,
  currentIndex,
  selections,
  results,
  submitting,
  submitError,
  answeredThisSession,
  onChoose,
  onGoTo,
  onSubmit,
  onRetry,
}: {
  chapter: AdminHomeworkChapter;
  questions: AdminHomeworkQuestion[];
  currentIndex: number;
  selections: Record<string, string[]>;
  results: Record<string, AdminHomeworkAnswerResult>;
  submitting: boolean;
  submitError: string | null;
  answeredThisSession: number;
  onChoose: (question: AdminHomeworkQuestion, optionId: string) => void;
  onGoTo: (index: number) => void;
  onSubmit: (question: AdminHomeworkQuestion) => Promise<void>;
  onRetry: (questionId: string) => void;
}) {
  const question = questions[currentIndex];
  const selectedIds = selections[question.id] ?? [];
  const result = results[question.id];
  const correctOptionIds = new Set(result?.correctOptions.map((option) => option.id) ?? []);
  const progressPercent = (chapter.attemptedQuestionCount / chapter.questionCount) * 100;

  return (
    <>
      <header className="homework-practice-heading">
        <div>
          <span><ShieldCheck size={15} /> PRIVATE PRACTICE</span>
          <p>第 {chapter.chapterNumber} 章</p>
          <h1>{chapter.title}</h1>
          <small>逐题作答，答错会自动加入错题本；本练习不计分。</small>
        </div>
        <div className="homework-practice-stat" aria-label={`已完成 ${chapter.attemptedQuestionCount} 题，共 ${chapter.questionCount} 题`}>
          <BookOpenCheck size={24} />
          <strong>{chapter.attemptedQuestionCount}/{chapter.questionCount}</strong>
          <span>已做题目</span>
        </div>
      </header>

      <div className="practice-progress homework-practice-progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <nav className="homework-question-map" aria-label="题目导航">
        {questions.map((item, index) => {
          const currentResult = results[item.id];
          const state = currentResult
            ? currentResult.isCorrect ? "correct" : "wrong"
            : item.attemptCount > 0 ? "answered" : "";
          return (
            <button
              className={`${index === currentIndex ? "current" : ""} ${state}`}
              type="button"
              key={item.id}
              aria-label={`第 ${index + 1} 题${item.attemptCount > 0 ? "，已作答" : ""}`}
              aria-current={index === currentIndex ? "step" : undefined}
              onClick={() => onGoTo(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </nav>

      <section className="practice-question-card homework-question-card">
        <div className="practice-question-meta">
          <span>第 {currentIndex + 1} / {questions.length} 题</span>
          <span>{question.section === "case" ? "案例分析题" : question.type === "single" ? "单项选择题" : "多项选择题"}</span>
          <strong>
            {question.wrongCount > 0
              ? <><CircleAlert size={16} /> 曾答错 {question.wrongCount} 次</>
              : question.attemptCount > 0
                ? <><CheckCircle2 size={16} /> 已作答</>
                : "尚未作答"}
          </strong>
        </div>

        {question.section === "case" ? (
          <div className="case-passage">
            <strong>案例材料</strong>
            <p>{question.passage}</p>
            {question.image ? (
              <img
                className="question-reference-image"
                src={question.image.url}
                alt={question.image.alt}
                width={question.image.width}
                height={question.image.height}
              />
            ) : null}
          </div>
        ) : null}

        <h2>{question.prompt}</h2>
        <p className="question-hint">
          {question.type === "single" ? "请选择一个答案" : "请选择所有正确答案"}
          {question.attemptCount > 0 ? <span>本题已作答 {question.attemptCount} 次</span> : null}
        </p>

        <div className="option-list practice-options">
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            const correct = Boolean(result) && correctOptionIds.has(option.id);
            const wrong = Boolean(result) && selected && !correct;
            return (
              <button
                className={`${selected ? "selected" : ""} ${correct ? "practice-correct" : ""} ${wrong ? "practice-wrong" : ""}`}
                key={option.id}
                type="button"
                onClick={() => onChoose(question, option.id)}
                aria-pressed={selected}
                disabled={Boolean(result) || submitting}
              >
                <span className="option-label">
                  {correct ? <Check size={18} /> : wrong ? <XCircle size={18} /> : selected ? <Check size={18} /> : option.label}
                </span>
                <span>{option.content}</span>
              </button>
            );
          })}
        </div>

        {submitError ? (
          <div className="exam-error" role="alert"><AlertCircle size={18} /> {submitError}</div>
        ) : null}

        {result ? (
          <div className={`practice-feedback ${result.isCorrect ? "correct" : "incorrect"}`} role="status">
            <div>
              {result.isCorrect ? <CheckCircle2 size={25} /> : <XCircle size={25} />}
              <div>
                <strong>{result.isCorrect ? "回答正确" : "回答错误，已加入错题本"}</strong>
                <p>正确答案：{result.correctOptions.map((option) => `${option.label}. ${option.content}`).join("；")}</p>
              </div>
            </div>
            {result.explanation ? <p className="practice-explanation"><strong>解析：</strong>{result.explanation}</p> : null}
          </div>
        ) : null}

        <footer className="practice-actions">
          <button
            className="quiet-button"
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onGoTo(currentIndex - 1)}
          >
            <ArrowLeft size={17} /> 上一题
          </button>
          <div>
            {result ? (
              <button className="quiet-button" type="button" onClick={() => onRetry(question.id)}>
                <RotateCcw size={16} /> 重新做本题
              </button>
            ) : null}
            {result && currentIndex < questions.length - 1 ? (
              <button className="focus-button small" type="button" onClick={() => onGoTo(currentIndex + 1)}>
                下一题 <ArrowRight size={17} />
              </button>
            ) : result ? (
              <Link className="focus-button small" to="/admin/homework">
                返回章节 <ArrowRight size={17} />
              </Link>
            ) : (
              <button
                className="focus-button small"
                type="button"
                disabled={selectedIds.length === 0 || submitting}
                onClick={() => void onSubmit(question)}
              >
                {submitting ? "正在判题…" : "提交答案"} <ArrowRight size={17} />
              </button>
            )}
          </div>
        </footer>
        {answeredThisSession > 0 ? (
          <p className="homework-session-note">本次已完成 {answeredThisSession} 题，离开页面也会保留作答记录。</p>
        ) : null}
      </section>
    </>
  );
}
