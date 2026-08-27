export const englishListeningScenes = [
  {
    id: "coffee-shop",
    number: "01",
    englishTitle: "AT THE COFFEE SHOP",
    chineseTitle: "咖啡店点单",
    context: "听清饮品、冷热和糖分选择。",
    level: "入门",
    duration: "18 秒",
    tone: "yellow",
    speechText: "Good morning. Could I get a latte, please? Sure. Would you like it hot or iced? Hot, please, with no sugar.",
    transcript: [
      { speaker: "A", text: "Good morning. Could I get a latte, please?", translation: "早上好，请给我一杯拿铁好吗？", note: "Could I get… 是点单时常见的礼貌表达。" },
      { speaker: "B", text: "Sure. Would you like it hot or iced?", translation: "当然。您想要热的还是冰的？", note: "Would you 中的 would 常弱读，重点听 hot 和 iced。" },
      { speaker: "A", text: "Hot, please, with no sugar.", translation: "热的，谢谢，不加糖。", note: "with no sugar 是需要捕捉的定制信息。" },
    ],
    questions: [
      {
        id: "coffee-place",
        prompt: "这段对话最可能发生在哪里？",
        options: [
          { id: "cafe", label: "A", content: "咖啡店" },
          { id: "hotel", label: "B", content: "酒店前台" },
          { id: "station", label: "C", content: "地铁站" },
        ],
        correctOptionId: "cafe",
        explanation: "对话中出现 latte、hot or iced 等点单信息。",
      },
      {
        id: "coffee-temperature",
        prompt: "顾客最后选择了哪一种？",
        options: [
          { id: "iced", label: "A", content: "冰拿铁" },
          { id: "hot", label: "B", content: "热拿铁" },
          { id: "warm", label: "C", content: "温水" },
        ],
        correctOptionId: "hot",
        explanation: "顾客明确回答了 Hot, please。",
      },
      {
        id: "coffee-sugar",
        prompt: "顾客对糖有什么要求？",
        options: [
          { id: "extra", label: "A", content: "多加糖" },
          { id: "little", label: "B", content: "少量糖" },
          { id: "none", label: "C", content: "不加糖" },
        ],
        correctOptionId: "none",
        explanation: "with no sugar 表示不加糖。",
      },
    ],
  },
  {
    id: "subway",
    number: "02",
    englishTitle: "ON THE SUBWAY",
    chineseTitle: "地铁通勤",
    context: "识别终点、换乘线路和下一站。",
    level: "入门",
    duration: "16 秒",
    tone: "blue",
    speechText: "This train is bound for Central Station. Please change at City Hall for Line Two. The next stop is Museum Road.",
    transcript: [
      { speaker: "广播", text: "This train is bound for Central Station.", translation: "本次列车开往中央车站。", note: "be bound for 表示开往某地，终点在句尾。" },
      { speaker: "广播", text: "Please change at City Hall for Line Two.", translation: "请在市政厅站换乘二号线。", note: "change at 后面是换乘站，for 后面是目标线路。" },
      { speaker: "广播", text: "The next stop is Museum Road.", translation: "下一站是博物馆路。", note: "next stop 后紧跟最需要听清的站名。" },
    ],
    questions: [
      {
        id: "subway-destination",
        prompt: "这趟列车开往哪里？",
        options: [
          { id: "museum", label: "A", content: "Museum Road" },
          { id: "central", label: "B", content: "Central Station" },
          { id: "city-hall", label: "C", content: "City Hall" },
        ],
        correctOptionId: "central",
        explanation: "bound for Central Station 表示列车开往中央车站。",
      },
      {
        id: "subway-transfer",
        prompt: "乘客应在哪里换乘？",
        options: [
          { id: "central", label: "A", content: "Central Station" },
          { id: "museum", label: "B", content: "Museum Road" },
          { id: "city-hall", label: "C", content: "City Hall" },
        ],
        correctOptionId: "city-hall",
        explanation: "广播说 Please change at City Hall。",
      },
      {
        id: "subway-line",
        prompt: "需要换乘哪条线路？",
        options: [
          { id: "one", label: "A", content: "Line One" },
          { id: "two", label: "B", content: "Line Two" },
          { id: "three", label: "C", content: "Line Three" },
        ],
        correctOptionId: "two",
        explanation: "for Line Two 指需要换乘二号线。",
      },
    ],
  },
  {
    id: "meeting",
    number: "03",
    englishTitle: "IN A MEETING",
    chineseTitle: "办公室会议",
    context: "抓住时间调整、确认和待办事项。",
    level: "进阶",
    duration: "20 秒",
    tone: "pink",
    speechText: "Can we move the meeting to three o'clock? That works for me. I'll update the calendar. Great. Please bring the latest sales report.",
    transcript: [
      { speaker: "A", text: "Can we move the meeting to three o'clock?", translation: "我们可以把会议改到三点吗？", note: "move…to… 在这里表示把时间调整到。" },
      { speaker: "B", text: "That works for me. I'll update the calendar.", translation: "我可以。我会更新日历。", note: "That works for me 是同意安排的常用表达。" },
      { speaker: "A", text: "Great. Please bring the latest sales report.", translation: "很好。请带上最新的销售报告。", note: "latest 和 sales report 是待办事项的核心。" },
    ],
    questions: [
      {
        id: "meeting-change",
        prompt: "对话双方主要在调整什么？",
        options: [
          { id: "place", label: "A", content: "会议地点" },
          { id: "time", label: "B", content: "会议时间" },
          { id: "people", label: "C", content: "参会人员" },
        ],
        correctOptionId: "time",
        explanation: "move the meeting to three o'clock 是调整会议时间。",
      },
      {
        id: "meeting-new-time",
        prompt: "会议改到几点？",
        options: [
          { id: "two", label: "A", content: "两点" },
          { id: "three", label: "B", content: "三点" },
          { id: "four", label: "C", content: "四点" },
        ],
        correctOptionId: "three",
        explanation: "第一句明确说 to three o'clock。",
      },
      {
        id: "meeting-bring",
        prompt: "参会者需要带什么？",
        options: [
          { id: "calendar", label: "A", content: "纸质日历" },
          { id: "budget", label: "B", content: "预算表" },
          { id: "sales", label: "C", content: "最新销售报告" },
        ],
        correctOptionId: "sales",
        explanation: "最后一句要求带上 the latest sales report。",
      },
    ],
  },
  {
    id: "restaurant",
    number: "04",
    englishTitle: "AT A RESTAURANT",
    chineseTitle: "餐厅用餐",
    context: "听懂推荐菜品和结账表达。",
    level: "日常",
    duration: "19 秒",
    tone: "green",
    speechText: "What do you recommend today? The grilled fish is very popular. Sounds good. Could we have the bill after dinner?",
    transcript: [
      { speaker: "A", text: "What do you recommend today?", translation: "今天你推荐什么？", note: "recommend 是询问推荐时的关键词。" },
      { speaker: "B", text: "The grilled fish is very popular.", translation: "烤鱼很受欢迎。", note: "grilled fish 是推荐菜品，popular 补充评价。" },
      { speaker: "A", text: "Sounds good. Could we have the bill after dinner?", translation: "听起来不错。吃完后可以给我们账单吗？", note: "have the bill 表示结账；英式英语常用 bill。" },
    ],
    questions: [
      {
        id: "restaurant-purpose",
        prompt: "顾客首先在询问什么？",
        options: [
          { id: "recommendation", label: "A", content: "今日推荐" },
          { id: "table", label: "B", content: "预订餐桌" },
          { id: "allergy", label: "C", content: "食物过敏" },
        ],
        correctOptionId: "recommendation",
        explanation: "What do you recommend today? 是询问今日推荐。",
      },
      {
        id: "restaurant-dish",
        prompt: "服务员推荐了什么？",
        options: [
          { id: "salad", label: "A", content: "沙拉" },
          { id: "fish", label: "B", content: "烤鱼" },
          { id: "steak", label: "C", content: "牛排" },
        ],
        correctOptionId: "fish",
        explanation: "服务员说 The grilled fish is very popular。",
      },
      {
        id: "restaurant-bill",
        prompt: "顾客希望什么时候拿到账单？",
        options: [
          { id: "before", label: "A", content: "用餐前" },
          { id: "during", label: "B", content: "用餐中" },
          { id: "after", label: "C", content: "用餐后" },
        ],
        correctOptionId: "after",
        explanation: "after dinner 表示用餐以后。",
      },
    ],
  },
  {
    id: "airport",
    number: "05",
    englishTitle: "AT THE AIRPORT",
    chineseTitle: "机场登机",
    context: "关注航班、登机口变化和登机时间。",
    level: "进阶",
    duration: "17 秒",
    tone: "orange",
    speechText: "Attention, passengers on Flight two eight six to Singapore. Your gate has changed from A twelve to B six. Boarding will begin in fifteen minutes.",
    transcript: [
      { speaker: "广播", text: "Attention, passengers on Flight 286 to Singapore.", translation: "请注意，搭乘 286 航班前往新加坡的旅客。", note: "机场广播先报航班号和目的地，用于确认是否与自己有关。" },
      { speaker: "广播", text: "Your gate has changed from A12 to B6.", translation: "登机口已从 A12 变更为 B6。", note: "from…to… 表示由原地点改为新地点，重点听 to 后内容。" },
      { speaker: "广播", text: "Boarding will begin in fifteen minutes.", translation: "十五分钟后开始登机。", note: "in fifteen minutes 表示从现在起十五分钟后。" },
    ],
    questions: [
      {
        id: "airport-destination",
        prompt: "航班飞往哪里？",
        options: [
          { id: "tokyo", label: "A", content: "东京" },
          { id: "singapore", label: "B", content: "新加坡" },
          { id: "sydney", label: "C", content: "悉尼" },
        ],
        correctOptionId: "singapore",
        explanation: "广播第一句提到 Flight 286 to Singapore。",
      },
      {
        id: "airport-new-gate",
        prompt: "新的登机口是哪个？",
        options: [
          { id: "a12", label: "A", content: "A12" },
          { id: "b6", label: "B", content: "B6" },
          { id: "b12", label: "C", content: "B12" },
        ],
        correctOptionId: "b6",
        explanation: "changed from A12 to B6，to 后面是新的登机口。",
      },
      {
        id: "airport-boarding",
        prompt: "多久后开始登机？",
        options: [
          { id: "five", label: "A", content: "5 分钟" },
          { id: "fifteen", label: "B", content: "15 分钟" },
          { id: "fifty", label: "C", content: "50 分钟" },
        ],
        correctOptionId: "fifteen",
        explanation: "fifteen minutes 是十五分钟，要注意和 fifty 区分。",
      },
    ],
  },
  {
    id: "hotel",
    number: "06",
    englishTitle: "AT THE HOTEL",
    chineseTitle: "酒店入住",
    context: "识别预订姓名、早餐和退房时间。",
    level: "日常",
    duration: "21 秒",
    tone: "purple",
    speechText: "Hi, I have a reservation under the name Chen. I found it. Breakfast is served from seven to ten. Thank you. What time is check-out?",
    transcript: [
      { speaker: "A", text: "Hi, I have a reservation under the name Chen.", translation: "你好，我有一个陈姓的预订。", note: "under the name… 是说明预订姓名的固定表达。" },
      { speaker: "B", text: "I found it. Breakfast is served from seven to ten.", translation: "找到了。早餐供应时间是七点到十点。", note: "from seven to ten 是一个时间范围。" },
      { speaker: "A", text: "Thank you. What time is check-out?", translation: "谢谢。几点退房？", note: "check-out 在这里作名词，表示退房时间。" },
    ],
    questions: [
      {
        id: "hotel-name",
        prompt: "预订使用了什么姓名？",
        options: [
          { id: "chen", label: "A", content: "Chen" },
          { id: "cheng", label: "B", content: "Cheng" },
          { id: "chang", label: "C", content: "Chang" },
        ],
        correctOptionId: "chen",
        explanation: "客人说 under the name Chen。",
      },
      {
        id: "hotel-breakfast-start",
        prompt: "早餐几点开始供应？",
        options: [
          { id: "six", label: "A", content: "六点" },
          { id: "seven", label: "B", content: "七点" },
          { id: "ten", label: "C", content: "十点" },
        ],
        correctOptionId: "seven",
        explanation: "from seven to ten 中，seven 是开始时间。",
      },
      {
        id: "hotel-final-question",
        prompt: "客人最后询问了什么？",
        options: [
          { id: "wifi", label: "A", content: "无线网络" },
          { id: "breakfast", label: "B", content: "早餐地点" },
          { id: "checkout", label: "C", content: "退房时间" },
        ],
        correctOptionId: "checkout",
        explanation: "最后一句 What time is check-out? 是询问退房时间。",
      },
    ],
  },
];

export function getEnglishListeningScene(sceneId) {
  return englishListeningScenes.find((scene) => scene.id === sceneId) ?? null;
}

export function toPublicListeningScene(scene, { includeQuestions = false } = {}) {
  const publicScene = {
    id: scene.id,
    number: scene.number,
    englishTitle: scene.englishTitle,
    chineseTitle: scene.chineseTitle,
    context: scene.context,
    level: scene.level,
    duration: scene.duration,
    tone: scene.tone,
    speechText: scene.speechText,
    questionCount: scene.questions.length,
  };

  if (!includeQuestions) return publicScene;
  return {
    ...publicScene,
    questions: scene.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
    })),
  };
}
