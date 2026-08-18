import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListChecks,
  Send,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { ErrorState, LoadingState } from "../components/PageBits";
import type { ExamDetail, ResultDetail } from "../types";
import { useRemote } from "../useRemote";

type ExamPhase = "intro" | "active" | "submitting";

export function ExamPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const { data: exam, loading, error } = useRemote<ExamDetail>(
    (signal) => apiGet(`/api/exams/${encodeURIComponent(examId)}`, signal),
    [examId],
  );
  const [phase, setPhase] = useState<ExamPhase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const submittedRef = useRef(false);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((optionIds) => optionIds.length > 0).length,
    [answers],
  );

  const submitExam = useCallback(async () => {
    if (!exam || startedAt === null || submittedRef.current) return;
    submittedRef.current = true;
    setPhase("submitting");
    setSubmitError(null);

    try {
      const result = await apiPost<ResultDetail>(
        `/api/exams/${encodeURIComponent(exam.id)}/submissions`,
        {
          startedAt: new Date(startedAt).toISOString(),
          durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
          answers: exam.questions.map((question) => ({
            questionId: question.id,
            optionIds: answers[question.id] ?? [],
          })),
        },
      );
      navigate(`/results/${result.id}`, { replace: true });
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : "提交失败");
      setPhase("active");
      setShowReview(false);
      submittedRef.current = false;
    }
  }, [answers, exam, navigate, startedAt]);

  useEffect(() => {
    if (phase !== "active" || secondsRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => void submitExam(), 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, submitExam]);

  if (loading) return <LoadingState label="正在准备考试环境…" />;
  if (error) return <ErrorState message={error} />;
  if (!exam) return null;

  function startExam() {
    setStartedAt(Date.now());
    setSecondsRemaining(exam!.durationMinutes * 60);
    setPhase("active");
  }

  function chooseOption(questionId: string, optionId: string, type: "single" | "multiple") {
    setAnswers((current) => {
      if (type === "single") {
        return { ...current, [questionId]: [optionId] };
      }

      const existing = current[questionId] ?? [];
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return { ...current, [questionId]: next };
    });
  }

  if (phase === "intro") {
    return (
      <div className="exam-intro">
        <Link className="focus-back" to="/exams"><ArrowLeft size={17} /> 返回试卷列表</Link>
        <div className="exam-intro-card">
          <span className="exam-intro-mark"><Target size={34} /></span>
          <span className="reading-category">模拟考试</span>
          <h1>{exam.title}</h1>
          <p>{exam.description || "准备好后开始答题。"}</p>
          <div className="intro-facts">
            <div><ListChecks size={22} /><strong>{exam.questionCount}</strong><span>道题目</span></div>
            <div><Clock3 size={22} /><strong>{exam.durationMinutes}</strong><span>分钟</span></div>
            <div><Target size={22} /><strong>{exam.passingScore}</strong><span>分及格</span></div>
          </div>
          <div className="exam-rules">
            <strong>开始前请确认</strong>
            <ul>
              <li><CheckCircle2 size={17} /> 开始后立即计时，倒计时结束会自动交卷。</li>
              <li><CheckCircle2 size={17} /> 多选题全选正确得满分；少选每个正确选项得 0.5 分，错选不得分。</li>
              <li><CheckCircle2 size={17} /> 交卷后可查看解析，错题会自动归档。</li>
            </ul>
          </div>
          <button className="focus-button" onClick={startExam} disabled={exam.questionCount === 0}>
            {exam.questionCount > 0 ? "开始答题" : "试卷暂无题目"} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  const question = exam.questions[currentIndex];
  const selectedIds = answers[question.id] ?? [];
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const unanswered = exam.questionCount - answeredCount;

  return (
    <div className="exam-runner">
      <header className="exam-runner-header">
        <div>
          <span>正在答题</span>
          <strong>{exam.title}</strong>
        </div>
        <div className={`exam-timer ${secondsRemaining <= 60 ? "urgent" : ""}`}>
          <Clock3 size={18} />
          <strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>
        </div>
      </header>

      <div className="exam-progress" aria-label={`已完成 ${answeredCount} / ${exam.questionCount} 题`}>
        <span style={{ width: `${(answeredCount / exam.questionCount) * 100}%` }} />
      </div>

      {submitError ? (
        <div className="exam-error" role="alert"><AlertCircle size={18} /> {submitError}</div>
      ) : null}

      <div className="exam-layout">
        <aside className={`question-map ${showQuestionMap ? "expanded" : ""}`} aria-label="题目导航">
          <div>
            <strong>答题进度</strong>
            <div className="question-map-summary">
              <span>{answeredCount}/{exam.questionCount}</span>
              <button
                className="question-map-toggle"
                type="button"
                aria-controls="question-map-grid"
                aria-expanded={showQuestionMap}
                onClick={() => setShowQuestionMap((visible) => !visible)}
              >
                {showQuestionMap ? "收起题号" : "展开题号"}
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav id="question-map-grid">
            {exam.questions.map((item, index) => (
              <button
                className={`${index === currentIndex ? "current" : ""} ${(answers[item.id]?.length ?? 0) > 0 ? "answered" : ""}`}
                key={item.id}
                onClick={() => {
                  setCurrentIndex(index);
                  setShowQuestionMap(false);
                }}
                aria-label={`第 ${index + 1} 题${(answers[item.id]?.length ?? 0) > 0 ? "，已作答" : ""}`}
              >
                {index + 1}
              </button>
            ))}
          </nav>
          <p><span className="map-dot answered" /> 已作答 <span className="map-dot current" /> 当前题</p>
        </aside>

        <section className="question-card">
          <div className="question-topline">
            <span>第 {currentIndex + 1} / {exam.questionCount} 题</span>
            <span>{question.section === "case" ? `案例分析题（${question.type === "single" ? "单选" : "多选"}）` : question.type === "single" ? "单选题" : "多选题"} · {question.points} 分</span>
          </div>
          {question.section === "case" ? <div className="case-passage"><strong>案例材料</strong><p>{question.passage}</p></div> : null}
          <h1>{question.prompt}</h1>
          <p className="question-hint">{question.type === "single" ? "请选择一个答案" : "请选择所有正确答案"}</p>

          <div className="option-list">
            {question.options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <button
                  className={selected ? "selected" : ""}
                  key={option.id}
                  onClick={() => chooseOption(question.id, option.id, question.type)}
                  aria-pressed={selected}
                >
                  <span className="option-label">{selected ? <Check size={18} /> : option.label}</span>
                  <span>{option.content}</span>
                </button>
              );
            })}
          </div>

          <footer className="question-actions">
            <button
              className="quiet-button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => index - 1)}
            >
              <ArrowLeft size={17} /> 上一题
            </button>
            {currentIndex < exam.questionCount - 1 ? (
              <button className="focus-button small" onClick={() => setCurrentIndex((index) => index + 1)}>
                下一题 <ArrowRight size={17} />
              </button>
            ) : (
              <button className="focus-button small" onClick={() => setShowReview(true)}>
                准备交卷 <Send size={17} />
              </button>
            )}
          </footer>
        </section>
      </div>

      {showReview ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowReview(false)}>
          <section
            className="submit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="submit-icon"><Send size={27} /></span>
            <h2 id="submit-title">确认交卷吗？</h2>
            <p>
              已完成 <strong>{answeredCount}</strong> 题，
              {unanswered > 0 ? <><strong>{unanswered}</strong> 题还没有作答。</> : "所有题目都已作答。"}
            </p>
            <div className="dialog-actions">
              <button className="quiet-button" onClick={() => setShowReview(false)}>继续检查</button>
              <button className="focus-button small" onClick={() => void submitExam()} disabled={phase === "submitting"}>
                {phase === "submitting" ? "正在判分…" : "确认交卷"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
