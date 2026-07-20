// The 8-bit ballpark. A still diamond while you weigh your bet — runners lit
// on the bases the situation describes — then, when you lock it in, it plays
// your athlete's real outcome (classified from the moment's action text).
// Pure SVG rects + CSS keyframes: no libraries, no sprite sheets.
import type { CSSProperties } from "react";
import type { HitDir, PlayKind } from "./playerRounds";

// Where each position stands on the 8-bit field (sprite head x/y).
// Bases: 1st (106,44) · 2nd (76.5,14) · 3rd (47,44) · home (76,75).
// C is absent on purpose: a catcher athlete IS the catcher sprite.
const FIELD_SPOTS: Record<string, [number, number]> = {
  P: [90, 30], "1B": [114, 34], "2B": [98, 18], SS: [58, 18],
  "3B": [38, 34], LF: [24, 6], CF: [76, 1], RF: [132, 6],
};
const DEFAULT_SPOT: [number, number] = [116, 30];
const CATCHER_SPOT: [number, number] = [88, 74];

// A blocky little ballplayer: head, torso, legs.
function Sprite({ x, y, color, cls }: { x: number; y: number; color: string; cls?: string }) {
  return (
    <g className={cls} style={{ transformBox: "fill-box" } as CSSProperties}>
      <rect x={x} y={y} width="4" height="4" fill={color} />
      <rect x={x - 1} y={y + 4} width="6" height="6" fill={color} />
      <rect x={x} y={y + 10} width="2" height="4" fill={color} />
      <rect x={x + 2} y={y + 10} width="2" height="4" fill={color} />
    </g>
  );
}

export function PlayScene({ playing, kind, flash, good, bases, accent, role, dir }: {
  playing: boolean;           // false = idle still; true = run the outcome
  kind: PlayKind;             // hit | k | kswing | pop | glove | error | wild
  flash: string;              // "2B!", "K!", "E!", ...
  good: boolean;              // did the picked athlete deliver?
  bases: [boolean, boolean, boolean];
  accent: string;             // the athlete you're betting on wears this color
  role: string;               // her role decides WHICH sprite wears it
  dir?: HitDir;               // hit direction, when the action names one
}) {
  // paint the sprite that is actually your athlete; everyone else stays
  // neutral. A catcher athlete takes over the catcher sprite itself — she is
  // not a second player standing beside home plate.
  const inCircle = role.startsWith("IN THE CIRCLE");
  const inField = role.startsWith("IN THE FIELD");
  const fieldPos = inField ? role.slice("IN THE FIELD AT ".length) : "";
  const catcherActor = fieldPos === "C";
  const pitcherColor = inCircle ? accent : "#8b8fb8";
  const catcherColor = catcherActor ? accent : "#4a4a7a";
  const fielderColor = inField && !catcherActor ? accent : "#8b8fb8";
  const batterColor = !inCircle && !inField ? accent : "#e8e8ff";
  // stand the fielder at her actual position, and aim the glove/error ball
  // flight at the athlete making the play: --fx/--fy = contact point
  // (relative to the ball's start), --ex/--ey = where an error squirts to,
  // continuing along the flight line
  const [spotX, spotY] = (inField && !catcherActor && FIELD_SPOTS[fieldPos]) || DEFAULT_SPOT;
  const [targetX, targetY] = catcherActor ? CATCHER_SPOT : [spotX, spotY];
  const fx = targetX - 82;
  const fy = targetY - 34;
  const ex = Math.round(fx + 0.45 * (fx + 5));
  const ey = Math.round(fy + 0.45 * (fy - 34));
  const base = (x: number, y: number, lit: boolean, key: string) => (
    <rect key={key} x={x} y={y} width="5" height="5" fill={lit ? "var(--amber)" : "#2c2c54"}
      transform={`rotate(45 ${x + 2.5} ${y + 2.5})`} />
  );
  return (
    <svg
      className={"tyg-scene" + (playing ? " play-" + kind + (dir ? " dir-" + dir : "") + (catcherActor ? " actor-c" : "") : " idle")}
      viewBox="0 0 160 90"
      style={{
        "--batter": batterColor,
        "--fx": fx + "px", "--fy": fy + "px",
        "--ex": ex + "px", "--ey": ey + "px",
      } as CSSProperties}
      aria-label="8-bit replay of the play"
    >
      {/* park */}
      <rect x="0" y="0" width="160" height="90" fill="#0d0d1f" />
      <path d="M 79 78 L 20 22" stroke="#2c2c54" strokeWidth="1.5" fill="none" />
      <path d="M 79 78 L 138 22" stroke="#2c2c54" strokeWidth="1.5" fill="none" />
      <path d="M 79 78 L 110 48 L 79 18 L 48 48 Z" stroke="#3a3a6e" strokeWidth="1.5" fill="#12122a" />
      {/* bases: 1st, 2nd, 3rd + home */}
      {base(106, 44, bases[0], "b1")}
      {base(76.5, 14, bases[1], "b2")}
      {base(47, 44, bases[2], "b3")}
      <rect x="76" y="75" width="6" height="4" fill="#e8e8ff" />
      {/* mound */}
      <rect x="74" y="46" width="10" height="3" fill="#2c2c54" />
      {/* players */}
      <Sprite x={77} y={32} color={pitcherColor} cls="tyg-pitcher" />
      <Sprite x={64} y={62} color="var(--batter)" cls="tyg-batter" />
      <rect className="tyg-bat" x="70" y="63" width="9" height="2" fill="var(--amber)" />
      <Sprite x={88} y={74} color={catcherColor} cls="tyg-catcher" />
      <Sprite x={spotX} y={spotY} color={fielderColor} cls="tyg-fielder" />
      {/* the ball (starts in the pitcher's hand) */}
      <rect className="tyg-ball" x="82" y="40" width="3" height="3" fill="#f2f2f2" />
      {/* outcome flash */}
      <text className="tyg-flash" x="80" y="30" textAnchor="middle"
        fill={good ? "var(--green)" : "var(--red)"}>{flash}</text>
    </svg>
  );
}
