export interface Phoneme {
  symbol: string;
  example: string;
}

export interface PhonemeGroup {
  englishTitle: string;
  chineseTitle: string;
  tone: "yellow" | "blue" | "pink";
  items: Phoneme[];
}

export interface ListeningScene {
  id: string;
  number: string;
  englishTitle: string;
  chineseTitle: string;
  context: string;
  level: string;
  duration: string;
  transcript: string[];
  speechText: string;
  tone: "yellow" | "blue" | "pink" | "green" | "orange" | "purple";
}

export const phonemeGroups: PhonemeGroup[] = [
  {
    englishTitle: "PURE VOWELS",
    chineseTitle: "单元音",
    tone: "yellow",
    items: [
      { symbol: "iː", example: "see" },
      { symbol: "ɪ", example: "sit" },
      { symbol: "e", example: "bed" },
      { symbol: "æ", example: "cat" },
      { symbol: "ʌ", example: "cup" },
      { symbol: "ɑː", example: "car" },
      { symbol: "ɒ", example: "hot" },
      { symbol: "ɔː", example: "door" },
      { symbol: "ʊ", example: "book" },
      { symbol: "uː", example: "food" },
      { symbol: "ɜː", example: "bird" },
      { symbol: "ə", example: "about" },
    ],
  },
  {
    englishTitle: "DIPHTHONGS",
    chineseTitle: "双元音",
    tone: "blue",
    items: [
      { symbol: "eɪ", example: "day" },
      { symbol: "aɪ", example: "time" },
      { symbol: "ɔɪ", example: "boy" },
      { symbol: "aʊ", example: "house" },
      { symbol: "əʊ", example: "go" },
      { symbol: "ɪə", example: "near" },
      { symbol: "eə", example: "hair" },
      { symbol: "ʊə", example: "tour" },
    ],
  },
  {
    englishTitle: "CONSONANTS",
    chineseTitle: "辅音",
    tone: "pink",
    items: [
      { symbol: "p", example: "pen" },
      { symbol: "b", example: "book" },
      { symbol: "t", example: "tea" },
      { symbol: "d", example: "desk" },
      { symbol: "k", example: "key" },
      { symbol: "ɡ", example: "go" },
      { symbol: "f", example: "fish" },
      { symbol: "v", example: "very" },
      { symbol: "θ", example: "think" },
      { symbol: "ð", example: "this" },
      { symbol: "s", example: "sun" },
      { symbol: "z", example: "zoo" },
      { symbol: "ʃ", example: "she" },
      { symbol: "ʒ", example: "vision" },
      { symbol: "h", example: "hat" },
      { symbol: "tʃ", example: "chair" },
      { symbol: "dʒ", example: "job" },
      { symbol: "m", example: "moon" },
      { symbol: "n", example: "name" },
      { symbol: "ŋ", example: "sing" },
      { symbol: "l", example: "light" },
      { symbol: "r", example: "red" },
      { symbol: "j", example: "yes" },
      { symbol: "w", example: "water" },
    ],
  },
];

export const listeningScenes: ListeningScene[] = [
  {
    id: "coffee-shop",
    number: "01",
    englishTitle: "AT THE COFFEE SHOP",
    chineseTitle: "咖啡店点单",
    context: "听清饮品、冷热和糖分选择。",
    level: "入门",
    duration: "18 秒",
    transcript: [
      "A: Good morning. Could I get a latte, please?",
      "B: Sure. Would you like it hot or iced?",
      "A: Hot, please, with no sugar.",
    ],
    speechText: "Good morning. Could I get a latte, please? Sure. Would you like it hot or iced? Hot, please, with no sugar.",
    tone: "yellow",
  },
  {
    id: "subway",
    number: "02",
    englishTitle: "ON THE SUBWAY",
    chineseTitle: "地铁通勤",
    context: "识别站名、换乘和下车提醒。",
    level: "入门",
    duration: "16 秒",
    transcript: [
      "This train is bound for Central Station.",
      "Please change at City Hall for Line Two.",
      "The next stop is Museum Road.",
    ],
    speechText: "This train is bound for Central Station. Please change at City Hall for Line Two. The next stop is Museum Road.",
    tone: "blue",
  },
  {
    id: "meeting",
    number: "03",
    englishTitle: "IN A MEETING",
    chineseTitle: "办公室会议",
    context: "抓住时间调整和待办事项。",
    level: "进阶",
    duration: "20 秒",
    transcript: [
      "A: Can we move the meeting to three o'clock?",
      "B: That works for me. I'll update the calendar.",
      "A: Great. Please bring the latest sales report.",
    ],
    speechText: "Can we move the meeting to three o'clock? That works for me. I'll update the calendar. Great. Please bring the latest sales report.",
    tone: "pink",
  },
  {
    id: "restaurant",
    number: "04",
    englishTitle: "AT A RESTAURANT",
    chineseTitle: "餐厅用餐",
    context: "听懂推荐、忌口和结账表达。",
    level: "日常",
    duration: "19 秒",
    transcript: [
      "A: What do you recommend today?",
      "B: The grilled fish is very popular.",
      "A: Sounds good. Could we have the bill after dinner?",
    ],
    speechText: "What do you recommend today? The grilled fish is very popular. Sounds good. Could we have the bill after dinner?",
    tone: "green",
  },
  {
    id: "airport",
    number: "05",
    englishTitle: "AT THE AIRPORT",
    chineseTitle: "机场登机",
    context: "关注航班、登机口和时间变化。",
    level: "进阶",
    duration: "17 秒",
    transcript: [
      "Attention, passengers on Flight 286 to Singapore.",
      "Your gate has changed from A12 to B6.",
      "Boarding will begin in fifteen minutes.",
    ],
    speechText: "Attention, passengers on Flight two eight six to Singapore. Your gate has changed from A twelve to B six. Boarding will begin in fifteen minutes.",
    tone: "orange",
  },
  {
    id: "hotel",
    number: "06",
    englishTitle: "AT THE HOTEL",
    chineseTitle: "酒店入住",
    context: "识别预订信息、早餐和退房时间。",
    level: "日常",
    duration: "21 秒",
    transcript: [
      "A: Hi, I have a reservation under the name Chen.",
      "B: I found it. Breakfast is served from seven to ten.",
      "A: Thank you. What time is check-out?",
    ],
    speechText: "Hi, I have a reservation under the name Chen. I found it. Breakfast is served from seven to ten. Thank you. What time is check-out?",
    tone: "purple",
  },
];
