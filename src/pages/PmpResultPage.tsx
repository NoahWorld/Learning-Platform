import { PmpFocusShell } from "../components/PmpFocusShell";
import { ResultDetailPage } from "./ResultDetailPage";

export function PmpResultPage() {
  return (
    <PmpFocusShell exitPath="/modules/pmp" exitLabel="退出复盘">
      <ResultDetailPage
        apiBase="/api/pmp/results"
        backPath="/modules/pmp"
        backLabel="返回 PMP 学习中心"
        examBase="/modules/pmp/exams"
        successTitle="达到本次训练目标！"
        retryTitle="复盘一下，再练一轮！"
      />
    </PmpFocusShell>
  );
}
