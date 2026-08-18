import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamPage } from "./pages/ExamPage";
import { ExamsPage } from "./pages/ExamsPage";
import { MaterialDetailPage } from "./pages/MaterialDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { MistakesPage } from "./pages/MistakesPage";
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
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="materials/:materialId" element={<MaterialDetailPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="exams/:examId" element={<ExamPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="results/:resultId" element={<ResultDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
