import { z } from "zod";

const idSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "ID 只能包含字母、数字、下划线和连字符");

const optionSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(8),
  content: z.string().min(1).max(1000),
  correct: z.boolean(),
});

const questionSchema = z
  .object({
    id: idSchema,
    type: z.enum(["single", "multiple"]),
    section: z.enum(["standard", "case"]).default("standard"),
    passage: z.string().max(10000).default(""),
    prompt: z.string().min(1).max(5000),
    explanation: z.string().max(10000).default(""),
    points: z.number().int().positive().max(100).default(1),
    options: z.array(optionSchema).min(2).max(12),
  })
  .superRefine((question, context) => {
    const correctCount = question.options.filter((option) => option.correct).length;
    const optionIds = new Set(question.options.map((option) => option.id));

    if (optionIds.size !== question.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "同一道题的选项 ID 不得重复",
      });
    }

    if (question.type === "single" && correctCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "单选题必须且只能有一个正确选项",
      });
    }

    if (question.type === "multiple" && correctCount < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "多选题至少需要两个正确选项",
      });
    }

    if (question.section === "case" && question.passage.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passage"],
        message: "案例分析题必须提供案例材料",
      });
    }
  });

const materialSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).default(""),
  content: z.string().max(200000).default(""),
  category: z.string().min(1).max(80).default("未分类"),
  estimatedMinutes: z.number().int().min(0).max(10000).default(0),
  status: z.enum(["draft", "published"]).default("published"),
});

const assetSchema = z.object({
  id: idSchema,
  materialId: idSchema,
  role: z.enum(["cover", "attachment"]),
  title: z.string().min(1).max(200),
  source: z.string().min(1).max(2000),
});

const examSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  durationMinutes: z.number().int().positive().max(1440),
  passingScore: z.number().int().min(0).max(100).default(60),
  seriesId: z.union([idSchema, z.literal("")]).default(""),
  seriesTitle: z.string().max(200).default(""),
  seriesDescription: z.string().max(1000).default(""),
  seriesOrder: z.number().int().min(0).max(10000).default(999),
  paperOrder: z.number().int().positive().max(10000).default(1),
  status: z.enum(["draft", "published"]).default("published"),
  questions: z.array(questionSchema).min(1).max(500),
});

export const contentSchema = z
  .object({
    materials: z.array(materialSchema).default([]),
    exams: z.array(examSchema).default([]),
    assets: z.array(assetSchema).default([]),
  })
  .superRefine((content, context) => {
    const ids = [
      ...content.materials.map((material) => material.id),
      ...content.exams.map((exam) => exam.id),
      ...content.exams.flatMap((exam) => exam.questions.map((question) => question.id)),
      ...content.exams.flatMap((exam) =>
        exam.questions.flatMap((question) => question.options.map((option) => option.id)),
      ),
      ...content.assets.map((asset) => asset.id),
    ];

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "资料、试卷、题目和选项的 ID 必须全局唯一",
      });
    }

    const materialIds = new Set(content.materials.map((material) => material.id));
    content.assets.forEach((asset, index) => {
      if (!materialIds.has(asset.materialId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assets", index, "materialId"],
          message: "附件指向的资料必须同时出现在本次导入文件中",
        });
      }
    });

    const coverMaterialIds = content.assets
      .filter((asset) => asset.role === "cover")
      .map((asset) => asset.materialId);
    if (new Set(coverMaterialIds).size !== coverMaterialIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assets"],
        message: "每条资料最多只能配置一张封面图",
      });
    }
  });

export const submissionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(604800).default(0),
  startedAt: z.string().datetime().optional(),
  answers: z
    .array(
      z.object({
        questionId: idSchema,
        optionIds: z.array(idSchema).max(12),
      }),
    )
    .max(500),
});

export const mistakePracticeSubmissionSchema = z.object({
  optionIds: z.array(idSchema).min(1, "请至少选择一个答案").max(12),
});

export const listeningSubmissionSchema = z.object({
  accent: z.enum(["us", "uk"]),
  listenCount: z.number().int().min(1, "请至少完整收听一次").max(100),
  durationSeconds: z.number().int().min(0).max(3600),
  answers: z
    .array(
      z.object({
        questionId: idSchema,
        optionId: idSchema,
      }),
    )
    .min(1)
    .max(20),
});

export const dailyListeningSubmissionSchema = z.object({
  listenCount: z.number().int().min(1, "请至少完整收听一次").max(100),
  durationSeconds: z.number().int().min(0).max(3600),
  answers: z
    .array(
      z.object({
        questionId: idSchema,
        optionId: idSchema,
      }),
    )
    .min(1)
    .max(20),
});

const usernameSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(
    z
      .string()
      .min(1, "请输入用户名")
      .max(64, "用户名最多 64 个字符"),
  );

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "请输入密码").max(128, "密码最多 128 个字符"),
  captchaId: z.string().min(1, "图片选择码不能为空").max(100),
  captchaOptionId: z.string().min(1, "请选择正确的图片").max(100),
});

const assignedModuleIdsSchema = z
  .array(idSchema)
  .max(100, "课程数量不能超过 100 个")
  .refine((values) => new Set(values).size === values.length, "课程不能重复分配");

export const adminUserCreateSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "请输入显示名称").max(40, "显示名称最多 40 个字符"),
  password: z.string().min(8, "密码至少 8 个字符").max(128, "密码最多 128 个字符"),
  moduleIds: assignedModuleIdsSchema,
  isAdmin: z.boolean().default(false),
});

export const adminUserUpdateSchema = z.object({
  displayName: z.string().trim().min(1, "请输入显示名称").max(40, "显示名称最多 40 个字符"),
  password: z.union([
    z.literal(""),
    z.string().min(8, "新密码至少 8 个字符").max(128, "新密码最多 128 个字符"),
  ]).optional(),
  moduleIds: assignedModuleIdsSchema,
  isAdmin: z.boolean(),
  isActive: z.boolean(),
});
