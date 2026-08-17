export interface DashboardSummary {
  materialCount: number;
  examCount: number;
  attemptCount: number;
  averageScore: number;
  bestScore: number;
  mistakeCount: number;
  recentAttempt: ResultSummary | null;
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
  correctOptions: Array<Pick<ExamOption, "id" | "label" | "content">>;
}
