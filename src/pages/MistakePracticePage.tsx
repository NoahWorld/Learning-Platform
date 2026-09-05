import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/PageBits";
import type { MistakePracticeQuestion, MistakePracticeResult } from "../types";
import { useRemote } from "../useRemote";

interface PracticeResponse {
  questions: MistakePracticeQuestion[];
}

export function MistakePracticePage() {
  const [searchParams] = useSearchParams();
  const requestedQuestionId = searchParams.get("question");
  const { data, loading, error } = useRemote<PracticeResponse>(
    (signal) => apiGet("/api/mistakes/practice", signal),
    [],
  );
  const [questions, setQuestions] = useState<MistakePracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, MistakePracticeResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setQuestions(data.questions);
    const requestedIndex = requestedQuestionId
      ? data.questions.findIndex((question) => question.questionId === requestedQuestionId)
      : -1;
    const firstUnlearnedIndex = data.questions.findIndex((question) => !question.relearned);
    setCurrentIndex(
      requestedIndex >= 0 ? requestedIndex : Math.max(firstUnlearnedIndex, 0),
    );
  }, [data, requestedQuestionId]);

  const relearnedCount = useMemo(
    () => questions.filter((question) => question.relearned).length,
    [questions],
  );

  if (loading) return <LoadingState label="正在生成你的错题练习…" />;
  if (error) return <ErrorState message={error} />;
  if (questions.length === 0) {
    return (
      <div className="mistake-practice-page">
        <Link className="focus-back" to="/mistakes"><ArrowLeft size={17} /> 返回错题本</Link>
        <EmptyState
          title="暂时没有可练习的错题"
          description="完成模拟考试并产生错题后，就可以在这里逐题重练。"
          actionLabel="去参加模拟考试"
          actionTo="/exams"
        />
      </div>
    );
  }

  const question = questions[currentIndex];
  const selectedIds = selections[question.questionId] ?? [];
  const result = results[question.questionId];
  const correctOptionIds = new Set(result?.correctOptions.map((option) => option.id) ?? []);

  function chooseOption(optionId: string) {
    if (result || submitting) return;
    setSelections((current) => {
      if (question.type === "single") {
        return { ...current, [question.questionId]: [optionId] };
      }
      const existing = current[question.questionId] ?? [];
      return {
        ...current,
        [question.questionId]: existing.includes(optionId)
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

  async function submitAnswer() {
    if (selectedIds.length === 0 || submitting || result) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const practiceResult = await apiPost<MistakePracticeResult>(
        `/api/mistakes/${encodeURIComponent(question.questionId)}/practice`,
        { optionIds: selectedIds },
      );
      setResults((current) => ({ ...current, [question.questionId]: practiceResult }));
      setQuestions((current) => current.map((item) => (
        item.questionId === question.questionId
          ? {
              ...item,
              practiceCount: practiceResult.practiceCount,
              lastPracticedAt: practiceResult.submittedAt,
              relearned: practiceResult.relearned,
            }
          : item
      )));
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function retryQuestion() {
    setSelections((current) => ({ ...current, [question.questionId]: [] }));
    setResults((current) => {
      const next = { ...current };
      delete next[question.questionId];
      return next;
    });
    setSubmitError(null);
  }

  return (
    <div className="mistake-practice-page">
      <Link className="focus-back" to="/mistakes"><ArrowLeft size={17} /> 返回错题本</Link>

      <header className="practice-heading">
        <div>
          <span><Sparkles size={15} /> MISTAKE RETRAINING</span>
          <h1>错题重练</h1>
          <p>逐题作答，答对即标记“已重学”；状态保留，但你随时可以继续重做。</p>
        </div>
        <div className="practice-heading-stat">
          <Target size={25} />
          <strong>{relearnedCount}/{questions.length}</strong>
          <span>已重学</span>
        </div>
      </header>

      <div className="practice-progress" aria-label={`当前第 ${currentIndex + 1} 题，共 ${questions.length} 题`}>
        <span style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <section className={`practice-question-card ${question.relearned ? "relearned" : "learning"}`}>
        <div className="practice-question-meta">
          <span>第 {currentIndex + 1} / {questions.length} 题</span>
          <span>{question.examTitle}</span>
          <strong>
            {question.relearned
              ? <><CheckCircle2 size={16} /> 已重学</>
              : <><RotateCcw size={16} /> 待重学</>}
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
          <span> · 历史答错 {question.wrongCount} 次 · 已重练 {question.practiceCount} 次</span>
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
                onClick={() => chooseOption(option.id)}
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
                <strong>{result.isCorrect ? "回答正确，已标记为“已重学”" : "这次还没答对，再理解一下"}</strong>
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
            onClick={() => goToQuestion(currentIndex - 1)}
          >
            <ArrowLeft size={17} /> 上一题
          </button>
          <div>
            {result ? (
              <button className="quiet-button" type="button" onClick={retryQuestion}>
                <RotateCcw size={16} /> 重新做本题
              </button>
            ) : currentIndex < questions.length - 1 ? (
              <button className="quiet-button" type="button" onClick={() => goToQuestion(currentIndex + 1)}>
                稍后再做
              </button>
            ) : null}
            {result && currentIndex < questions.length - 1 ? (
              <button className="focus-button small" type="button" onClick={() => goToQuestion(currentIndex + 1)}>
                下一题 <ArrowRight size={17} />
              </button>
            ) : result ? (
              <Link className="focus-button small" to="/mistakes">完成本轮练习</Link>
            ) : (
              <button
                className="focus-button small"
                type="button"
                disabled={selectedIds.length === 0 || submitting}
                onClick={() => void submitAnswer()}
              >
                {submitting ? "正在判题…" : "提交答案"} <ArrowRight size={17} />
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
