const HOMEWORK_OBJECT_PREFIX = "admin-homework/hr-intensive-course-2026";

function chapter({
  chapterNumber,
  title,
  sourceFileName,
  pageCount,
  byteLength,
  sha256,
  hasTextbookUpdate = false,
}) {
  const number = String(chapterNumber).padStart(2, "0");
  return {
    id: `chapter-${number}`,
    chapterNumber,
    number,
    title,
    sourceFileName,
    pageCount,
    byteLength,
    sha256,
    hasTextbookUpdate,
    objectKey: `${HOMEWORK_OBJECT_PREFIX}/chapter-${number}.pdf`,
  };
}

export const adminHomeworkCollection = Object.freeze({
  id: "hr-intensive-course-2026",
  title: "中级经济师 · 人力资源课后作业",
  courseName: "精讲班",
  instructor: "殷巧玲",
});

export const adminHomeworkChapters = Object.freeze([
  chapter({ chapterNumber: 1, title: "劳动合同管理与特殊工具用工", sourceFileName: "01.第1章-劳动合同管理与特殊工具用工.pdf", pageCount: 14, byteLength: 317967, sha256: "cd213ea87f58f65e4075f6165ad7c1ed5605b6105a4535ee8a6397053cdf3957" }),
  chapter({ chapterNumber: 2, title: "社会保障法律", sourceFileName: "02.第2章-社会保障法律.pdf", pageCount: 8, byteLength: 190755, sha256: "5dc21853a797bd99cb183369d40c3d0cce4ddf52deb5dfdc6a25ca158d20441f" }),
  chapter({ chapterNumber: 3, title: "社会保险体系", sourceFileName: "03.第3章-社会保险体系.pdf", pageCount: 13, byteLength: 240192, sha256: "d8bad2d034060cacd562d712daf3730cb6171f55ab91fb936fa2afc04e9caab5" }),
  chapter({ chapterNumber: 4, title: "劳动争议调解仲裁", sourceFileName: "04.第4章-劳动争议调解仲裁.pdf", pageCount: 14, byteLength: 321651, sha256: "9106c2a1f4d441e9d24d08b603a23394d4560bb9917def05a7a261dcc1fad579" }),
  chapter({ chapterNumber: 5, title: "法律责任与行政执法", sourceFileName: "05.第5章-法律责任与行政执法.pdf", pageCount: 9, byteLength: 255336, sha256: "00ddb4554b9a6444cbe83ff19c62f8a87f14e7b91958c88f1d003dd82e6400f8" }),
  chapter({ chapterNumber: 6, title: "人才管理与开发政策", sourceFileName: "06.第6章-人才管理与开发政策.pdf", pageCount: 11, byteLength: 267667, sha256: "b63e03a3502d5acee6eac9be25bf76f7547a057d16c631d11afe5d181bbe371a" }),
  chapter({ chapterNumber: 7, title: "组织激励理论及其应用", sourceFileName: "07.第7章-组织激励理论及其应用.pdf", pageCount: 14, byteLength: 296941, sha256: "8e5dfdf72f2c9609e46267c3d984876adca76b01e8af27b3d7f3620ab68d66ac" }),
  chapter({ chapterNumber: 8, title: "领导行为及其应用", sourceFileName: "08.【新教材变动】第8章-领导行为及其应用.pdf", pageCount: 12, byteLength: 323649, sha256: "17d04042e7084e67a0d00bae9ba0dfe9c9086c766e7950e2477f396b99fa31cb", hasTextbookUpdate: true }),
  chapter({ chapterNumber: 9, title: "组织设计与组织文化概述及其应用", sourceFileName: "09.第9章-组织设计与组织文化概述及其应用.pdf", pageCount: 14, byteLength: 277370, sha256: "f2f338ccd34e8ff201d03ad1c0569d02f8bd59dc4cf954c4bfef5f2469e49f7d" }),
  chapter({ chapterNumber: 10, title: "劳动力市场理论及其应用", sourceFileName: "10.第10章-劳动力市场理论及其应用.pdf", pageCount: 12, byteLength: 289955, sha256: "8ef3805a008a17af79727dd483bfc637f4f7d5880d8eb0c4516ed0769ca24a5f" }),
  chapter({ chapterNumber: 11, title: "工资与就业理论及其应用", sourceFileName: "11.第11章-工资与就业理论及其应用.pdf", pageCount: 14, byteLength: 394842, sha256: "fadd8cfa63c122529e7313a9d48d857174338cf6591d064b5913bab997415732" }),
  chapter({ chapterNumber: 12, title: "人力资本投资理论及其应用", sourceFileName: "12.第12章-人力资本投资理论及其应用.pdf", pageCount: 14, byteLength: 262098, sha256: "e06f1b3806153efe0262fff26b1872c6b0160325a35df46c69bf1c2d80f738c9" }),
  chapter({ chapterNumber: 13, title: "战略性人力资源管理", sourceFileName: "13.第13章-战略性人力资源管理.pdf", pageCount: 12, byteLength: 273327, sha256: "205c809c39ceb010ef707c26c451b69a4f6022478f9d9cf0958c7a29f968d43f" }),
  chapter({ chapterNumber: 14, title: "人力资源规划", sourceFileName: "14.第14章-人力资源规划.pdf", pageCount: 15, byteLength: 372954, sha256: "c1668e8b14aeeba12ce843a67e228e469dcb92cdfe17b15c319d9f8d4db12285" }),
  chapter({ chapterNumber: 15, title: "甄选", sourceFileName: "15.第15章-甄选.pdf", pageCount: 14, byteLength: 334964, sha256: "490a8d2d135a38a1203f040697b3bd7c67ba193d1332fe44bff40fe97f804d01" }),
  chapter({ chapterNumber: 16, title: "绩效管理", sourceFileName: "16.【新教材变动】第16章-绩效管理.pdf", pageCount: 14, byteLength: 435271, sha256: "9cd9187c2524a48d392bd3c847b5a5491c82fbb439bb6485d4c04a9b4ee691de", hasTextbookUpdate: true }),
  chapter({ chapterNumber: 17, title: "薪酬管理", sourceFileName: "17.【新教材变动】第17章-薪酬管理.pdf", pageCount: 13, byteLength: 443455, sha256: "9a622fa05ae8f41f7739174ba15d36cb74ef81f510e79704eb7a91a8f527e663", hasTextbookUpdate: true }),
  chapter({ chapterNumber: 18, title: "培训与开发", sourceFileName: "18.第18章-培训与开发.pdf", pageCount: 12, byteLength: 321035, sha256: "1ebc38ee6436ada6222a45961a40fcfeade29d525734de6c94edf48cb8d87a43" }),
  chapter({ chapterNumber: 19, title: "劳动关系", sourceFileName: "19.【新教材变动】第19章-劳动关系.pdf", pageCount: 7, byteLength: 242280, sha256: "c425ef51cd5a65506131e3a5e176270f1966cd4a0335639f69f1bcf961f4b01b", hasTextbookUpdate: true }),
]);

validateManifest(adminHomeworkChapters);

export function getAdminHomeworkChapter(chapterId) {
  return adminHomeworkChapters.find((item) => item.id === chapterId) ?? null;
}

export function toPublicAdminHomeworkChapter(item) {
  return {
    id: item.id,
    number: item.number,
    chapterNumber: item.chapterNumber,
    title: item.title,
    pageCount: item.pageCount,
    byteLength: item.byteLength,
    hasTextbookUpdate: item.hasTextbookUpdate,
    fileUrl: `/api/admin/homework/${encodeURIComponent(item.id)}/file`,
  };
}

export function adminHomeworkSummary() {
  return {
    ...adminHomeworkCollection,
    chapterCount: adminHomeworkChapters.length,
    pageCount: adminHomeworkChapters.reduce((sum, item) => sum + item.pageCount, 0),
    byteLength: adminHomeworkChapters.reduce((sum, item) => sum + item.byteLength, 0),
  };
}

function validateManifest(chapters) {
  if (chapters.length !== 19) {
    throw new Error(`Admin homework manifest must contain 19 chapters; received ${chapters.length}`);
  }
  const ids = new Set();
  const sourceFiles = new Set();
  const objectKeys = new Set();
  for (const [index, item] of chapters.entries()) {
    const expectedChapterNumber = index + 1;
    if (item.chapterNumber !== expectedChapterNumber) {
      throw new Error(
        `Admin homework chapters must be sequential; expected ${expectedChapterNumber}, received ${item.chapterNumber}`,
      );
    }
    if (!Number.isSafeInteger(item.pageCount) || item.pageCount <= 0) {
      throw new Error(`Invalid page count for ${item.id}: ${item.pageCount}`);
    }
    if (!Number.isSafeInteger(item.byteLength) || item.byteLength <= 5) {
      throw new Error(`Invalid byte length for ${item.id}: ${item.byteLength}`);
    }
    if (!/^[0-9a-f]{64}$/.test(item.sha256)) {
      throw new Error(`Invalid SHA-256 for ${item.id}: ${item.sha256}`);
    }
    for (const [set, value, label] of [
      [ids, item.id, "id"],
      [sourceFiles, item.sourceFileName, "source file"],
      [objectKeys, item.objectKey, "object key"],
    ]) {
      if (set.has(value)) throw new Error(`Duplicate admin homework ${label}: ${value}`);
      set.add(value);
    }
  }
}
