import { randomInt, randomUUID } from "node:crypto";

export const CAPTCHA_TTL_MS = 3 * 60 * 1000;

const ICONS = [
  {
    name: "星星",
    markup:
      '<polygon points="50,19 59,39 81,41 64,56 69,78 50,67 31,78 36,56 19,41 41,39" fill="#ffd84d" stroke="#17233b" stroke-width="5" stroke-linejoin="round"/>',
  },
  {
    name: "爱心",
    markup:
      '<path d="M50 78C42 68 22 56 22 39c0-11 8-18 18-18 6 0 10 3 14 8 4-5 8-8 14-8 10 0 18 7 18 18 0 17-20 29-36 39Z" fill="#ff7fa5" stroke="#17233b" stroke-width="5" stroke-linejoin="round"/>',
  },
  {
    name: "太阳",
    markup:
      '<g fill="none" stroke="#17233b" stroke-width="5" stroke-linecap="round"><path d="M50 12v10M50 78v10M12 50h10M78 50h10M23 23l7 7M70 70l7 7M77 23l-7 7M30 70l-7 7"/><circle cx="50" cy="50" r="19" fill="#ffb54a"/></g>',
  },
  {
    name: "书本",
    markup:
      '<g stroke="#17233b" stroke-width="5" stroke-linejoin="round"><path d="M18 24h27c6 0 9 4 9 9v48c-3-5-7-7-13-7H18Z" fill="#82d9ff"/><path d="M82 24H55v57c3-5 7-7 13-7h14Z" fill="#a7e6b8"/><path d="M55 33v48" fill="none"/></g>',
  },
  {
    name: "月亮",
    markup:
      '<path d="M70 72c-25 8-48-10-48-35 0-13 7-25 18-31-3 6-4 11-4 17 0 23 18 41 41 41 5 0 9-1 13-2-5 5-12 8-20 10Z" fill="#d9c7ff" stroke="#17233b" stroke-width="5" stroke-linejoin="round"/>',
  },
  {
    name: "房子",
    markup:
      '<g stroke="#17233b" stroke-width="5" stroke-linejoin="round"><path d="M15 48 50 17l35 31" fill="#ff9e76"/><path d="M23 44v39h54V44L50 20Z" fill="#fff4c8"/><path d="M43 83V61h15v22" fill="#82d9ff"/></g>',
  },
];

const BACKGROUNDS = ["#fff4c8", "#e7f8ed", "#e8f5ff", "#f8ebff"];

export function createCaptchaChallenge(nowMs = Date.now()) {
  const selectedIcons = takeRandom(ICONS, 4);
  const correctIcon = selectedIcons[randomInt(selectedIcons.length)];
  const options = selectedIcons.map((icon, index) => ({
    id: randomUUID(),
    imageData: createImageData(icon.markup, BACKGROUNDS[index]),
    iconName: icon.name,
  }));
  const correctOption = options.find((option) => option.iconName === correctIcon.name);

  return {
    id: randomUUID(),
    prompt: `请选择「${correctIcon.name}」`,
    options: options.map(({ id, imageData }) => ({ id, imageData })),
    correctOptionId: correctOption.id,
    expiresAt: nowMs + CAPTCHA_TTL_MS,
  };
}

function takeRandom(values, count) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

function createImageData(markup, background) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<rect x="3" y="3" width="94" height="94" rx="20" fill="${background}"/>`,
    markup,
    "</svg>",
  ].join("");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
