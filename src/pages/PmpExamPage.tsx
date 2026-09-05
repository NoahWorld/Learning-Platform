import { PmpFocusShell } from "../components/PmpFocusShell";
import { ExamPage } from "./ExamPage";

export function PmpExamPage() {
  return (
    <PmpFocusShell exitPath="/modules/pmp" exitLabel="退出考试">
      <ExamPage
        apiBase="/api/pmp/exams"
        backPath="/modules/pmp"
        backLabel="返回 PMP 学习中心"
        resultBase="/modules/pmp/results"
        categoryLabel="PMP 原创情境短卷"
        scoreLabel="分训练目标"
        reviewRule="交卷后可查看原创解析；本模块不提供来源不明的所谓真题。"
      />
    </PmpFocusShell>
  );
}
