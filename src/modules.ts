export type LearningModuleId = "human-resources" | "economics" | "english";

export interface LearningModule {
  id: LearningModuleId;
  number: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  route: string;
  status: "ready" | "preparing";
  color: "yellow" | "blue" | "pink";
  highlights: string[];
}

export const learningModules: LearningModule[] = [
  {
    id: "human-resources",
    number: "01",
    title: "中级经济师－人力资源",
    shortTitle: "人力资源",
    eyebrow: "ECONOMIST · HR",
    description: "沿用现有题库、模拟考试、错题重练和成绩记录。",
    route: "/",
    status: "ready",
    color: "yellow",
    highlights: ["模拟考试", "错题重练", "成绩记录"],
  },
  {
    id: "economics",
    number: "02",
    title: "中级经济师－经济学",
    shortTitle: "经济学",
    eyebrow: "ECONOMIST · ECONOMICS",
    description: "独立的经济学学习空间，题库和学习内容后续录入。",
    route: "/modules/economics",
    status: "preparing",
    color: "blue",
    highlights: ["知识地图", "专项练习", "学习进度"],
  },
  {
    id: "english",
    number: "03",
    title: "英语",
    shortTitle: "英语",
    eyebrow: "ENGLISH · DAILY GROWTH",
    description: "独立的英语学习空间，后续可加入单词、听力和阅读训练。",
    route: "/modules/english",
    status: "preparing",
    color: "pink",
    highlights: ["词汇积累", "听力训练", "阅读练习"],
  },
];

export function getLearningModule(id: LearningModuleId) {
  const learningModule = learningModules.find((item) => item.id === id);
  if (!learningModule) throw new Error(`Unknown learning module: ${id}`);
  return learningModule;
}
