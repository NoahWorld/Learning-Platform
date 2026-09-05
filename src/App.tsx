import { Route, Routes } from "react-router-dom";
import { RequireAdmin, RequireAuth, RequireModule } from "./auth";
import { AppShell } from "./components/AppShell";
import { materialsEnabled } from "./features";
import { DashboardPage } from "./pages/DashboardPage";
import { EnglishDailyListeningPage } from "./pages/EnglishDailyListeningPage";
import { EnglishListeningPage } from "./pages/EnglishListeningPage";
import { EnglishListeningPracticePage } from "./pages/EnglishListeningPracticePage";
import { EnglishModulePage } from "./pages/EnglishModulePage";
import { ExamPage } from "./pages/ExamPage";
import { ExamsPage } from "./pages/ExamsPage";
import { MaterialDetailPage } from "./pages/MaterialDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { MistakesPage } from "./pages/MistakesPage";
import { MistakePracticePage } from "./pages/MistakePracticePage";
import { ModulePreviewPage } from "./pages/ModulePreviewPage";
import { ModuleSelectionPage } from "./pages/ModuleSelectionPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResultDetailPage } from "./pages/ResultDetailPage";
import { ResultsPage } from "./pages/ResultsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminHomeworkPage } from "./pages/AdminHomeworkPage";
import { AdminHomeworkPracticePage } from "./pages/AdminHomeworkPracticePage";
import { PmpExamPage } from "./pages/PmpExamPage";
import { PmpMaterialPage } from "./pages/PmpMaterialPage";
import { PmpModulePage } from "./pages/PmpModulePage";
import { PmpResultPage } from "./pages/PmpResultPage";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="modules" element={<ModuleSelectionPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/homework" element={<AdminHomeworkPage />} />
          <Route path="admin/homework/:chapterId" element={<AdminHomeworkPracticePage />} />
        </Route>
        <Route element={<RequireModule moduleId="economics" />}>
          <Route path="modules/economics" element={<ModulePreviewPage moduleId="economics" />} />
        </Route>
        <Route element={<RequireModule moduleId="english" />}>
          <Route path="modules/english" element={<EnglishModulePage />} />
          <Route path="modules/english/listening" element={<EnglishListeningPage />} />
          <Route path="modules/english/listening/daily/:storyId" element={<EnglishDailyListeningPage />} />
          <Route path="modules/english/listening/:sceneId" element={<EnglishListeningPracticePage />} />
        </Route>
        <Route element={<RequireModule moduleId="pmp" />}>
          <Route path="modules/pmp" element={<PmpModulePage />} />
          <Route path="modules/pmp/materials/:materialId" element={<PmpMaterialPage />} />
          <Route path="modules/pmp/exams/:examId" element={<PmpExamPage />} />
          <Route path="modules/pmp/results/:resultId" element={<PmpResultPage />} />
        </Route>
        <Route element={<RequireModule moduleId="human-resources" />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            {materialsEnabled ? <Route path="materials" element={<MaterialsPage />} /> : null}
            {materialsEnabled ? (
              <Route path="materials/:materialId" element={<MaterialDetailPage />} />
            ) : null}
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/:examId" element={<ExamPage />} />
            <Route path="mistakes/practice" element={<MistakePracticePage />} />
            <Route path="mistakes" element={<MistakesPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="results/:resultId" element={<ResultDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
