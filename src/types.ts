export interface User {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  moduleIds: string[];
  createdAt: string;
}

export interface ManagedLearningModule {
  id: string;
  title: string;
  displayOrder: number;
}

export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  moduleIds: string[];
  examAttemptCount: number;
  listeningAttemptCount: number;
  mistakePracticeCount: number;
  homeworkAttemptCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResponse {
  modules: ManagedLearningModule[];
  users: ManagedUser[];
}

export interface AdminHomeworkChapter {
  id: string;
  number: string;
  chapterNumber: number;
  title: string;
  questionCount: number;
  pageCount: number;
  byteLength: number;
  hasTextbookUpdate: boolean;
  fileUrl: string;
  attemptedQuestionCount: number;
  wrongQuestionCount: number;
  totalAttemptCount: number;
  lastPracticedAt: string | null;
}

export interface AdminHomeworkQuestionImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface AdminHomeworkQuestion {
  id: string;
  type: "single" | "multiple";
  section: "standard" | "case";
  passage: string;
  prompt: string;
  points: number;
  position: number;
  attemptCount: number;
  wrongCount: number;
  lastAnsweredAt: string | null;
  image: AdminHomeworkQuestionImage | null;
  options: ExamOption[];
}

export interface AdminHomeworkResponse {
  collection: {
    id: string;
    title: string;
    courseName: string;
    instructor: string;
    chapterCount: number;
    questionCount: number;
    pageCount: number;
    byteLength: number;
    attemptedQuestionCount: number;
    wrongQuestionCount: number;
    totalAttemptCount: number;
  };
  chapters: AdminHomeworkChapter[];
}

export interface AdminHomeworkChapterResponse {
  chapter: AdminHomeworkChapter;
  questions: AdminHomeworkQuestion[];
}

export interface AdminHomeworkAnswerResult {
  id: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  submittedAt: string;
  attemptCount: number;
  wrongCount: number;
  correctOptions: Array<Pick<ExamOption, "id" | "label" | "content">>;
  explanation: string;
  chapterProgress: Pick<
    AdminHomeworkChapter,
    "attemptedQuestionCount" | "wrongQuestionCount" | "totalAttemptCount" | "lastPracticedAt"
  >;
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
  soundReference: {
    sounds: EnglishPronunciationSound[];
    source: EnglishPronunciationSource;
  };
  summary: {
    sceneCount: number;
    practicedSceneCount: number;
    masteredSceneCount: number;
    totalAttemptCount: number;
  };
}

export interface EnglishPronunciationSound {
  id: string;
  number: string;
  ipa: string;
  cue: string;
  keywords: string[];
  colorClass:
    | "green"
    | "silver"
    | "gray"
    | "red"
    | "black"
    | "mustard"
    | "olive"
    | "auburn"
    | "blue"
    | "wooden"
    | "rose"
    | "brown"
    | "white"
    | "purple"
    | "turquoise";
  audioUrl: string;
}

export interface EnglishPronunciationSource {
  title: string;
  authors: string;
  publisher: string;
  pageUrl: string;
  licenseName: string;
  licenseUrl: string;
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

export interface DailyListeningKeyword {
  word: string;
  phonetic: string;
  meaning: string;
}

export interface DailyListeningSource {
  title: string;
  publisher: string;
  author: string;
  pageUrl: string;
  sourcePublishedAt: string;
  licenseName: string;
  licenseUrl: string;
  credit: string;
}

export interface DailyListeningStorySummary {
  id: string;
  number: string;
  releaseDate: string;
  englishTitle: string;
  chineseTitle: string;
  category: string;
  level: string;
  accent: string;
  duration: string;
  durationSeconds: number;
  background: string;
  listeningGoal: string;
  keywords: DailyListeningKeyword[];
  questionCount: number;
  audioUrl: string;
  source: DailyListeningSource;
  progress: ListeningProgress;
}

export interface DailyListeningQuestion extends ListeningQuestion {
  kind: "main" | "detail";
}

export interface DailyListeningStoryDetail extends DailyListeningStorySummary {
  questions: DailyListeningQuestion[];
}

export interface DailyListeningListResponse {
  stories: DailyListeningStorySummary[];
  summary: {
    storyCount: number;
    practicedStoryCount: number;
    masteredStoryCount: number;
    totalAttemptCount: number;
  };
}

export interface DailyListeningStoryResponse {
  story: DailyListeningStoryDetail;
}

export interface DailyListeningTranscriptLine {
  startSeconds: number;
  endSeconds: number;
  text: string;
  translation: string;
  note: string;
}

export interface DailyListeningSubmissionResult {
  id: string;
  storyId: string;
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
  transcript: DailyListeningTranscriptLine[];
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

export interface PmpExamDomain {
  id: string;
  title: string;
  englishTitle: string;
  weight: number;
  tone: "yellow" | "blue" | "pink";
}

export interface PmpExamProfile {
  version: string;
  questionCount: number;
  durationMinutes: number;
  breaks: string;
  domains: PmpExamDomain[];
  approachNote: string;
  passingScoreNote: string;
  sourceUrl: string;
}

export interface PmpLearningMaterialSummary {
  id: string;
  number: string;
  title: string;
  summary: string;
  category: string;
  domain: string;
  estimatedMinutes: number;
}

export interface PmpLearningMaterialDetail extends PmpLearningMaterialSummary {
  content: string;
}

export interface PmpOfficialResource {
  id: string;
  title: string;
  publisher: string;
  description: string;
  url: string;
  kind: string;
}

export interface PmpOverview {
  examProfile: PmpExamProfile;
  materials: PmpLearningMaterialSummary[];
  officialResources: PmpOfficialResource[];
  exams: ExamSummary[];
  recentResults: ResultSummary[];
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
  image: AdminHomeworkQuestionImage | null;
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
  image: AdminHomeworkQuestionImage | null;
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
