// Browser speech and caption timing for the announcer.
export const speechAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export interface SpeechLine {
  text: string;
  rate?: number;
  pitch?: number;
  delayMsBefore?: number;
  atMs?: number;
}

const MALE_VOICE = /\b(guy|davis|andrew|brian|christopher|eric|jacob|roger|steffan|tony|david|mark|male)\b/i;
let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const english = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith("en");
  const american = (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang);
  voice =
    voices.find((v) => american(v) && /natural/i.test(v.name) && MALE_VOICE.test(v.name)) ??
    voices.find((v) => american(v) && MALE_VOICE.test(v.name)) ??
    voices.find((v) => english(v) && MALE_VOICE.test(v.name)) ??
    voices.find(american) ??
    voices.find(english) ??
    null;
}

if (speechAvailable()) {
  pickVoice();
  speechSynthesis.addEventListener("voiceschanged", pickVoice);
}

let session = 0;
let timers: number[] = [];
const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

export function speak(lines: SpeechLine[], onLineStart?: (i: number) => void) {
  if (lines.length === 0 || typeof window === "undefined") return;
  const id = ++session;
  clearTimers();
  if (speechAvailable()) speechSynthesis.cancel();
  const startedAt = performance.now();

  const say = (index: number) => {
    if (id !== session || index >= lines.length) return;
    const line = lines[index];
    const next = () => say(index + 1);
    const start = () => {
      if (id !== session) return;
      if (!speechAvailable()) {
        onLineStart?.(index);
        timers.push(window.setTimeout(next, 400 + line.text.length * 55));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(line.text);
      if (voice) utterance.voice = voice;
      utterance.rate = line.rate ?? 1.05;
      utterance.pitch = line.pitch ?? 0.95;
      utterance.onstart = () => onLineStart?.(index);
      utterance.onend = next;
      utterance.onerror = next;
      speechSynthesis.speak(utterance);
    };
    const wait = Math.max(
      line.delayMsBefore ?? 0,
      line.atMs == null ? 0 : line.atMs - (performance.now() - startedAt),
      index === 0 ? 60 : 0,
    );
    if (wait > 0) timers.push(window.setTimeout(start, wait));
    else start();
  };

  say(0);
}

export function stopSpeech() {
  session++;
  clearTimers();
  if (speechAvailable()) speechSynthesis.cancel();
}
