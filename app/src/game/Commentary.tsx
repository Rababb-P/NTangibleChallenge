// Trust Your Gut — booth commentary UI: a broadcast lower-third that mirrors
// the announcer's call line by line, and the COMMENTARY on/off chip.
import { speechAvailable, type SpeechLine } from "./speech";

// Lines appear as they're spoken (the active one lit amber), so the big
// outcome call hits the captions at the same beat it hits your ears. When
// there's no voice at all, the whole call renders at once as a transcript.
export function CaptionBar({ lines, at }: { lines: SpeechLine[]; at: number }) {
  if (lines.length === 0) return null;
  const shown = speechAvailable() ? lines.slice(0, Math.max(at, 0) + 1) : lines;
  return (
    <div className="tyg-caption">
      <span className="tag tyg-blink">● LIVE</span>
      {shown.map((l, i) => (
        <span key={i} className={"line" + (i === at ? " now" : "")}>{l.text}</span>
      ))}
    </div>
  );
}

export function CommentaryToggle({ on, onToggle }: { on: boolean; onToggle: (on: boolean) => void }) {
  const label = on ? (speechAvailable() ? "ON" : "CAPTIONS") : "OFF";
  return (
    <button type="button" className={"tyg-sound" + (on ? " on" : "")} onClick={() => onToggle(!on)}>
      ♦ COMMENTARY: {label}
    </button>
  );
}
