export type LearningModuleId = "human-resources" | "economics" | "english";

export interface LearningModule {
  id: LearningModuleId;
  number: string;
  title: string;
  shortTitle: string;
  category: string;
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
    category: "中级经济师",
    eyebrow: "ECONOMIST · HR",
    description: "模拟考试、错题重练与成绩追踪。",
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
    category: "中级经济师",
    eyebrow: "ECONOMIST · ECONOMICS",
    description: "系统学习经济基础知识，逐步巩固重点与难点。",
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
    category: "语言学习",
    eyebrow: "ENGLISH · DAILY GROWTH",
    description: "通过真实场景练习，逐步提升英语听力与理解能力。",
    route: "/modules/english",
    status: "ready",
    color: "pink",
    highlights: ["音标参考", "场景听力", "理解训练"],
  },
];

export function getLearningModule(id: LearningModuleId) {
  const learningModule = learningModules.find((item) => item.id === id);
  if (!learningModule) throw new Error(`Unknown learning module: ${id}`);
  return learningModule;
}
