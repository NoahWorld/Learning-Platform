import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import { materialsEnabled } from "./features";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamPage } from "./pages/ExamPage";
import { ExamsPage } from "./pages/ExamsPage";
import { MaterialDetailPage } from "./pages/MaterialDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { MistakesPage } from "./pages/MistakesPage";
import { MistakePracticePage } from "./pages/MistakePracticePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResultDetailPage } from "./pages/ResultDetailPage";
import { ResultsPage } from "./pages/ResultsPage";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
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
    </Routes>
  );
}
