// Trust Your Gut — tiny Web Speech API wrapper for the booth announcer.
// Zero React. One short utterance per line (Chrome stalls out on long ones),
// chained by onend plus optional delays so a call can sync with the 8-bit
// replay animation. speak() always interrupts whatever is playing.

export const speechAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export interface SpeechLine {
  text: string;            // sentence case — all-caps makes some voices spell letters
  rate?: number;
  pitch?: number;
  delayMsBefore?: number;  // pause after the previous line ends
  atMs?: number;           // never start before this many ms into the call
}

// Best available male announcer voice. The API exposes no gender, so match
// the male voice names Windows/Edge/Chrome actually ship (\bmale\b also
// catches "Google UK English Male" without matching "Female"). Voices load
// async in Chrome; the voiceschanged refresh upgrades later lines.
const MALE = /\b(guy|davis|andrew|brian|christopher|eric|jacob|roger|steffan|tony|david|mark|male)\b/i;
let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  const en = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith("en");
  const us = (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang);
  voice =
    vs.find((v) => us(v) && /natural/i.test(v.name) && MALE.test(v.name)) ??
    vs.find((v) => us(v) && MALE.test(v.name)) ??
    vs.find((v) => en(v) && MALE.test(v.name)) ??
    vs.find((v) => us(v) && /natural/i.test(v.name)) ??
    vs.find(us) ??
    vs.find(en) ??
    null;
}
if (speechAvailable()) {
  pickVoice();
  speechSynthesis.addEventListener("voiceschanged", pickVoice);
}

// A session id captured in every closure lets stopSpeech()/a newer speak()
// kill an in-flight chain without racing its onend callbacks.
let session = 0;
let timers: number[] = [];
const clearTimers = () => {
  for (const t of timers) clearTimeout(t);
  timers = [];
};

export function speak(lines: SpeechLine[], onLineStart?: (i: number) => void): void {
  if (!speechAvailable() || lines.length === 0) return;
  const id = ++session;
  clearTimers();
  speechSynthesis.cancel();
  const t0 = performance.now();

  const sayFrom = (i: number) => {
    if (id !== session || i >= lines.length) return;
    const line = lines[i];
    const start = () => {
      if (id !== session) return;
      const u = new SpeechSynthesisUtterance(line.text);
      if (voice) u.voice = voice; // else browser default until voices load
      u.rate = line.rate ?? 1.05;
      u.pitch = line.pitch ?? 0.95; // male announcer register
      u.onstart = () => { if (id === session) onLineStart?.(i); };
      let advanced = false; // some browsers fire both onend and onerror
      const nextOnce = () => { if (!advanced) { advanced = true; sayFrom(i + 1); } };
      u.onend = nextOnce;
      u.onerror = nextOnce; // fires on cancel too; the session guard stops the chain
      speechSynthesis.speak(u);
    };
    const wait = Math.max(
      line.delayMsBefore ?? 0,
      line.atMs != null ? line.atMs - (performance.now() - t0) : 0,
      i === 0 ? 60 : 0, // Chrome drops utterances queued synchronously after cancel()
    );
    if (wait > 0) timers.push(window.setTimeout(start, wait));
    else start();
  };
  sayFrom(0);
}

export function stopSpeech(): void {
  session++;
  clearTimers();
  if (speechAvailable()) speechSynthesis.cancel();
}
