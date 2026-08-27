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
