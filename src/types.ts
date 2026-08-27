export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface DashboardSummary {
  materialCount: number;
  examCount: number;
  attemptCount: number;
  averageScore: number;
  bestScore: number;
  mistakeCount: number;
  recentAttempt: ResultSummary | null;
}

export type ListeningAccent = "us" | "uk";

export interface ListeningProgress {
  attemptCount: number;
  bestScore: number | null;
  latestScore: number | null;
  lastPracticedAt: string | null;
}

export interface ListeningSceneSummary {
  id: string;
  number: string;
  englishTitle: string;
  chineseTitle: string;
  context: string;
  level: string;
  duration: string;
  tone: "yellow" | "blue" | "pink" | "green" | "orange" | "purple";
  audioUrl: string;
  audioSource: {
    title: string;
    publisher: string;
    pageUrl: string;
  };
  questionCount: number;
  progress: ListeningProgress;
}

export interface ListeningQuestionOption {
  id: string;
  label: string;
  content: string;
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  options: ListeningQuestionOption[];
}

export interface ListeningSceneDetail extends ListeningSceneSummary {
  questions: ListeningQuestion[];
}

export interface ListeningListResponse {
  scenes: ListeningSceneSummary[];
  summary: {
    sceneCount: number;
    practicedSceneCount: number;
    masteredSceneCount: number;
    totalAttemptCount: number;
  };
}

export interface ListeningSceneResponse {
  scene: ListeningSceneDetail;
}

export interface ListeningTranscriptLine {
  speaker: string;
  text: string;
  translation: string;
  note: string;
}

export interface ListeningSubmissionResult {
  id: string;
  sceneId: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  listenCount: number;
  durationSeconds: number;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  transcript: ListeningTranscriptLine[];
}

export interface MaterialSummary {
  id: string;
  title: string;
  summary: string;
  category: string;
  estimatedMinutes: number;
  updatedAt: string;
  coverUrl: string | null;
}

export interface MaterialAttachment {
  id: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface MaterialDetail extends MaterialSummary {
  content: string;
  attachments: MaterialAttachment[];
}

export interface MaterialListResponse {
  materials: MaterialSummary[];
  categories: Array<{ category: string; count: number }>;
}

export interface ExamSummary {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  seriesId: string;
  seriesTitle: string;
  seriesDescription: string;
  seriesOrder: number;
  paperOrder: number;
  questionCount: number;
  totalPoints: number;
  updatedAt: string;
}

export interface ExamOption {
  id: string;
  label: string;
  content: string;
  correct?: boolean;
}

export interface ExamQuestion {
  id: string;
  type: "single" | "multiple";
  section: "standard" | "case";
  passage: string;
  prompt: string;
  points: number;
  explanation?: string;
  options: ExamOption[];
}

export interface ExamDetail extends ExamSummary {
  questions: ExamQuestion[];
}

export interface ResultSummary {
  id: string;
  examId: string;
  examTitle: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  durationSeconds: number;
  passingScore: number;
  submittedAt: string;
}

export interface AnswerReview {
  questionId: string;
  prompt: string;
  explanation: string;
  type: "single" | "multiple";
  section: "standard" | "case";
  passage: string;
  points: number;
  earnedPoints: number;
  isCorrect: boolean;
  selectedOptionIds: string[];
  options: Array<ExamOption & { correct: boolean }>;
}

export interface ResultDetail extends ResultSummary {
  startedAt: string;
  answers: AnswerReview[];
}

export interface MistakeItem {
  questionId: string;
  prompt: string;
  explanation: string;
  type: "single" | "multiple";
  examId: string;
  examTitle: string;
  wrongCount: number;
  correctCount: number;
  lastWrongAt: string;
  corrected: boolean;
  practiceCount: number;
  lastPracticedAt: string | null;
  relearned: boolean;
  correctOptions: Array<Pick<ExamOption, "id" | "label" | "content">>;
}

export interface MistakePracticeQuestion {
  questionId: string;
  prompt: string;
  type: "single" | "multiple";
  section: "standard" | "case";
  passage: string;
  points: number;
  examId: string;
  examTitle: string;
  wrongCount: number;
  lastWrongAt: string;
  practiceCount: number;
  lastPracticedAt: string | null;
  relearned: boolean;
  options: ExamOption[];
}

export interface MistakePracticeResult {
  id: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  submittedAt: string;
  practiceCount: number;
  relearned: boolean;
  correctOptions: Array<Pick<ExamOption, "id" | "label" | "content">>;
  explanation: string;
}
