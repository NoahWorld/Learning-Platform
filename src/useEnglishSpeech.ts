import { useEffect, useState } from "react";
import type { ListeningAccent } from "./types";

export type SpeechRate = "normal" | "slow";

interface PlaybackOptions {
  rate?: SpeechRate;
  accent?: ListeningAccent;
}

export function useEnglishSpeech() {
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const supported = typeof window !== "undefined"
    && "speechSynthesis" in window
    && "SpeechSynthesisUtterance" in window;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  function stop() {
    if (supported) window.speechSynthesis.cancel();
    setActiveSpeech(null);
  }

  function play(id: string, speechText: string, options: PlaybackOptions = {}) {
    setSpeechError(null);
    if (!supported) {
      setSpeechError("当前浏览器不支持语音播放，请更换最新版 Chrome、Edge 或 Safari。");
      return false;
    }
    if (activeSpeech === id) {
      stop();
      return false;
    }

    const { rate = "normal", accent = "us" } = options;
    const language = accent === "uk" ? "en-GB" : "en-US";
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = language;
    utterance.rate = rate === "slow" ? 0.68 : 0.9;
    utterance.pitch = 1;
    const preferredVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith(language.toLowerCase()));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => setActiveSpeech((current) => current === id ? null : current);
    utterance.onerror = (event) => {
      setActiveSpeech((current) => current === id ? null : current);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setSpeechError(`音频播放失败：${event.error}`);
      }
    };
    setActiveSpeech(id);
    window.speechSynthesis.speak(utterance);
    return true;
  }

  return { activeSpeech, play, speechError, stop, supported };
}
