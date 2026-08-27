import { useEffect, useRef, useState } from "react";

type PlaybackRate = "normal" | "slow";

export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const playbackTokenRef = useRef(0);
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  function clearCurrentAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    activeIdRef.current = null;
    setActiveAudio(null);
  }

  function stop() {
    playbackTokenRef.current += 1;
    clearCurrentAudio();
  }

  useEffect(() => () => {
    playbackTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
  }, []);

  async function play(id: string, audioUrl: string, rate: PlaybackRate = "normal") {
    setAudioError(null);
    if (activeIdRef.current === id) {
      stop();
      return false;
    }

    stop();
    const playbackToken = playbackTokenRef.current;
    try {
      const availability = await fetch(audioUrl, {
        credentials: "same-origin",
        headers: { Range: "bytes=0-0" },
      });
      if (!availability.ok) {
        const contentType = availability.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await availability.json()
          : null;
        const message = payload && typeof payload === "object" && "error" in payload
          && typeof payload.error === "string"
          ? payload.error
          : `真人音频暂时无法播放（${availability.status}）`;
        throw new Error(message);
      }
      await availability.arrayBuffer();
      if (playbackTokenRef.current !== playbackToken) return false;

      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.playbackRate = rate === "slow" ? 0.8 : 1;
      audio.onended = () => {
        if (audioRef.current === audio) clearCurrentAudio();
      };
      audio.onerror = () => {
        if (audioRef.current !== audio) return;
        const mediaCode = audio.error?.code;
        clearCurrentAudio();
        setAudioError(
          mediaCode
            ? `真人音频播放中断（媒体错误 ${mediaCode}），请检查网络后重试。`
            : "真人音频播放中断，请检查网络后重试。",
        );
      };
      audioRef.current = audio;
      activeIdRef.current = id;
      setActiveAudio(id);
      await audio.play();
      if (playbackTokenRef.current !== playbackToken) {
        clearCurrentAudio();
        return false;
      }
      return true;
    } catch (error) {
      if (playbackTokenRef.current !== playbackToken) return false;
      clearCurrentAudio();
      setAudioError(error instanceof Error ? error.message : "真人音频播放失败");
      return false;
    }
  }

  return { activeAudio, audioError, play, stop };
}
