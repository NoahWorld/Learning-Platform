const SOURCE_PAGE_URL = "https://americanenglish.state.gov/resources/color-vowel-chart";
const SOURCE_TITLE = "The Color Vowel Chart";
const SOURCE_AUDIO_ROOT = "https://americanenglish.state.gov/files/ae/cvc_ver6/vo-mp3s";
const AUDIO_OBJECT_PREFIX = "english-pronunciation/color-vowel-chart";

function audioMetadata(fileName, audioByteLength, audioSha256) {
  if (!Number.isSafeInteger(audioByteLength) || audioByteLength <= 0) {
    throw new Error(`Invalid audio byte length for ${fileName}: ${audioByteLength}`);
  }
  if (!/^[0-9a-f]{64}$/.test(audioSha256)) {
    throw new Error(
      `Invalid SHA-256 metadata for ${fileName}: expected 64 lowercase hexadecimal characters, received ${audioSha256.length}`,
    );
  }

  return {
    audioFileName: fileName,
    audioByteLength,
    audioSha256,
    audioObjectKey: `${AUDIO_OBJECT_PREFIX}/${fileName}`,
    audioSourceUrl: `${SOURCE_AUDIO_ROOT}/${fileName}`,
  };
}

function sound(id, number, ipa, cue, keywords, colorClass, fileName, byteLength, sha256) {
  return {
    id,
    number,
    ipa,
    cue,
    keywords,
    colorClass,
    ...audioMetadata(fileName, byteLength, sha256),
  };
}

export const englishPronunciationSounds = [
  sound("green-tea", "01", "i", "GREEN TEA", ["GREEN", "TEA"], "green", "GREEN-A.mp3", 15463, "5a8c005b5236fcf77084df495bef41365fcba009a0effa9ec46b0c3a73510461"),
  sound("silver-pin", "02", "ɪ", "SILVER PIN", ["SILVER", "PIN"], "silver", "SILVER-A.mp3", 15967, "00f6f7b62d09f1a37390154bb8f6146df8bf2be0d443d7db2f7a3f5194e1869d"),
  sound("gray-day", "03", "eɪ", "GRAY DAY", ["GRAY", "DAY"], "gray", "GRAY-A.mp3", 16975, "2e7c3982b2aea1e99e7fbc43ad1ed368ba46d8f66ffabd71930559d814956081"),
  sound("red-dress", "04", "ɛ", "RED DRESS", ["RED", "DRESS"], "red", "RED-A.mp3", 15967, "e9b883a58fcdc1602945f8645d6f1235c9361ad9616216f5ede2bf01aedbea9d"),
  sound("black-cat", "05", "æ", "BLACK CAT", ["BLACK", "CAT"], "black", "BLACK-A.mp3", 15715, "7e67cb7998275e605ff8271ee64e4d722504b0bd36e69b86aa9b3eb752650f24"),
  sound("mustard-cup", "06", "ʌ", "A CUP OF MUSTARD", ["CUP", "MUSTARD"], "mustard", "MUSTARD-A.mp3", 15211, "f0d961f6bf21a69d81cd58e10758e2e9ccfae8f43ccb545a073a79b9026ee518"),
  sound("olive-sock", "07", "ɑ", "OLIVE SOCK", ["OLIVE", "SOCK"], "olive", "OLIVE-A.mp3", 15715, "538e6e46848d688e3197715e5ce469452fe60f68a152b16e6470dd8a96b8ac2f"),
  sound("auburn-dog", "08", "ɔ", "AUBURN DOG", ["AUBURN", "DOG"], "auburn", "AUBURN-A.mp3", 15967, "be0c13441941f6ec9217064edb016929f18dbb04532d304a11341d2316cdf6f8"),
  sound("blue-moon", "09", "u", "BLUE MOON", ["BLUE", "MOON"], "blue", "BLUE-A.mp3", 16975, "a1c14126772635836b6f4142e7125fd61339edd8b31ba8db20f0c507969f9366"),
  sound("wooden-hook", "10", "ʊ", "WOODEN HOOK", ["WOODEN", "HOOK"], "wooden", "WOODEN-A.mp3", 13447, "ae14b35fb6bc7b5dfe237cab7b4917cc2bda823c87049302716a390c9e7858ff"),
  sound("rose-coat", "11", "oʊ", "ROSE COAT", ["ROSE", "COAT"], "rose", "ROSE-A.mp3", 16723, "62b82f513f422819cb30213526226c0d3e5ca1b4c86e10da259db825528e5aae"),
  sound("brown-cow", "12", "aʊ", "BROWN COW", ["BROWN", "COW"], "brown", "BROWN-A.mp3", 17479, "4e8979eb18d5b2ecc0067b76c4c96e3b1b849a83f1bb047a10eb0a94af59d957"),
  sound("white-tie", "13", "aɪ", "WHITE TIE", ["WHITE", "TIE"], "white", "WHITE-A.mp3", 16471, "16aa9e25eb08a82c13835a4a24466f6b9736696db9d879cd661fefff966e66da"),
  sound("purple-shirt", "14", "ɝ", "PURPLE SHIRT", ["PURPLE", "SHIRT"], "purple", "PURPLE-A.mp3", 14455, "43a1d5ad74f9f852176a08d19d970c7ff4f082f0e3ed5b0e7458e61c3e35f147"),
  sound("turquoise-toy", "15", "ɔɪ", "TURQUOISE TOY", ["TURQUOISE", "TOY"], "turquoise", "TURQUOISE-A.mp3", 18235, "8d73db5bbadb7b96a535d67ebf896d7ef74a2d4dbf4c759b8c0c72fc56578f04"),
];

export const englishPronunciationSource = {
  title: SOURCE_TITLE,
  authors: "Karen Taylor、Shirley Thompson",
  publisher: "U.S. Department of State · American English",
  pageUrl: SOURCE_PAGE_URL,
  licenseName: "CC BY-NC-ND 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
};

export function getEnglishPronunciationSound(soundId) {
  return englishPronunciationSounds.find((item) => item.id === soundId) ?? null;
}

export function toPublicEnglishPronunciationSound(item) {
  return {
    id: item.id,
    number: item.number,
    ipa: item.ipa,
    cue: item.cue,
    keywords: item.keywords,
    colorClass: item.colorClass,
    audioUrl: `/api/english/pronunciation/${encodeURIComponent(item.id)}/audio`,
  };
}
