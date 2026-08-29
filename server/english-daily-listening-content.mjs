const VOA_CONTENT_REQUEST_URL = "https://learningenglish.voanews.com/p/6861.html";
const AUDIO_OBJECT_PREFIX = "english-listening/daily";

function option(id, label, content) {
  return { id, label, content };
}

function question(id, kind, prompt, options, correctOptionId, explanation) {
  return { id, kind, prompt, options, correctOptionId, explanation };
}

export const englishDailyListeningStories = [
  {
    id: "english-clubs-speaking-practice",
    number: "001",
    releaseDate: "2026-08-29",
    englishTitle: "HOW ENGLISH CLUBS HELP LEARNERS",
    chineseTitle: "英语俱乐部如何帮助口语学习",
    category: "教育",
    level: "入门",
    accent: "美音",
    duration: "48 秒",
    durationSeconds: 48,
    background:
      "很多学习者认识不少单词，却很少有机会真正使用英语；这段短报介绍一种低压力的练习方式。",
    listeningGoal: "第一遍只判断“这段在解决什么问题”，第二遍再找出具体建议。",
    keywords: [
      { word: "speaking", phonetic: "/ˈspiːkɪŋ/", meaning: "口语表达" },
      { word: "master", phonetic: "/ˈmæstər/", meaning: "掌握" },
      { word: "improve", phonetic: "/ɪmˈpruːv/", meaning: "提高" },
      { word: "practice", phonetic: "/ˈpræktɪs/", meaning: "练习" },
      { word: "English club", phonetic: "/ˈɪŋɡlɪʃ klʌb/", meaning: "英语俱乐部" },
    ],
    audioFileName: "voa-english-clubs-opening-48s.mp3",
    audioByteLength: 773642,
    audioSha256: "07231e59fd283b84ab9c68f8a66ce092f1901868cc4ba6489a7b29c9e6f38dab",
    audioObjectKey: `${AUDIO_OBJECT_PREFIX}/voa-english-clubs-opening-48s.mp3`,
    audioSourceUrl:
      "https://voa-audio.voanews.eu/vle/2017/07/17/1959ddf4-5d15-462e-a760-55be5bfd5494_hq.mp3?download=1",
    source: {
      title: "Learning English with English Clubs",
      publisher: "VOA Learning English",
      author: "Phil Dierking",
      pageUrl:
        "https://learningenglish.voanews.com/a/learning-english-with-english-clubs-starting-and-organizing-your-club/3947928.html",
      sourcePublishedAt: "2025-03-18",
      licenseName: "VOA 自制内容 · 公有领域",
      licenseUrl: VOA_CONTENT_REQUEST_URL,
      credit: "Voice of America · VOA Learning English",
    },
    transcript: [
      {
        startSeconds: 0,
        endSeconds: 10,
        text: "[VOA Learning English program introduction]",
        translation: "VOA Learning English 节目片头。",
        note: "片头不是题目考点，听到节目名称后等待正文即可。",
      },
      {
        startSeconds: 10,
        endSeconds: 21,
        text:
          "For many English learners, speaking is the most difficult part of the language to master.",
        translation: "对许多英语学习者来说，口语是这门语言中最难掌握的部分。",
        note: "most difficult part 是主旨信号，后面的 to master 修饰 the language。",
      },
      {
        startSeconds: 21,
        endSeconds: 36,
        text:
          "To improve your speaking skills, you need to be able to practice with other English learners or English speakers.",
        translation: "要提高口语能力，你需要能和其他英语学习者或英语使用者练习。",
        note: "To improve… 先给出目标，practice with… 再给出关键方法。",
      },
      {
        startSeconds: 36,
        endSeconds: 48,
        text: "One way to do this is by joining – or starting – an English club.",
        translation: "一种实现方式是加入——或创办——英语俱乐部。",
        note: "One way… is by… 是新闻与说明文中常见的建议结构。",
      },
    ],
    questions: [
      question(
        "clubs-main-idea",
        "main",
        "这段短报主要在讲什么？",
        [
          option("grammar", "A", "怎样记住更多语法规则"),
          option("practice", "B", "怎样通过与他人练习提高口语"),
          option("travel", "C", "怎样为英语国家旅行做准备"),
        ],
        "practice",
        "正文先说明口语难，再提出与其他学习者或英语使用者练习的方法。",
      ),
      question(
        "clubs-hardest-part",
        "detail",
        "报道说，许多学习者最难掌握哪一部分？",
        [
          option("listening", "A", "听力"),
          option("writing", "B", "写作"),
          option("speaking", "C", "口语"),
        ],
        "speaking",
        "第一句明确说 speaking is the most difficult part。",
      ),
      question(
        "clubs-suggestion",
        "detail",
        "报道给出的具体建议是什么？",
        [
          option("club", "A", "加入或创办英语俱乐部"),
          option("dictionary", "B", "每天抄写一本词典"),
          option("alone", "C", "只在家里独自练习"),
        ],
        "club",
        "最后一句建议 joining – or starting – an English club。",
      ),
    ],
  },
];

export function getEnglishDailyListeningStory(storyId) {
  return englishDailyListeningStories.find((story) => story.id === storyId) ?? null;
}

export function toPublicEnglishDailyListeningStory(
  story,
  { includeQuestions = false } = {},
) {
  const publicStory = {
    id: story.id,
    number: story.number,
    releaseDate: story.releaseDate,
    englishTitle: story.englishTitle,
    chineseTitle: story.chineseTitle,
    category: story.category,
    level: story.level,
    accent: story.accent,
    duration: story.duration,
    durationSeconds: story.durationSeconds,
    background: story.background,
    listeningGoal: story.listeningGoal,
    keywords: story.keywords,
    questionCount: story.questions.length,
    audioUrl: `/api/english/daily-listening/${encodeURIComponent(story.id)}/audio`,
    source: story.source,
  };

  if (!includeQuestions) return publicStory;
  return {
    ...publicStory,
    questions: story.questions.map((item) => ({
      id: item.id,
      kind: item.kind,
      prompt: item.prompt,
      options: item.options,
    })),
  };
}
