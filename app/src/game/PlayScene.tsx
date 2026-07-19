// The 8-bit ballpark. A still diamond while you weigh your bet — runners lit
// on the bases the situation describes — then, when you lock it in, it plays
// your athlete's real outcome (classified from the moment's action text).
// Pure SVG rects + CSS keyframes: no libraries, no sprite sheets.
import type { CSSProperties } from "react";
import type { PlayKind } from "./playerRounds";

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

export function PlayScene({ playing, kind, flash, good, bases, accent }: {
  playing: boolean;           // false = idle still; true = run the outcome
  kind: PlayKind;             // hit | k | pop | glove | error
  flash: string;              // "2B!", "K!", "E!", ...
  good: boolean;              // did the picked athlete deliver?
  bases: [boolean, boolean, boolean];
  accent: string;             // picked athlete's color (batter jersey)
}) {
  const base = (x: number, y: number, lit: boolean, key: string) => (
    <rect key={key} x={x} y={y} width="5" height="5" fill={lit ? "var(--amber)" : "#2c2c54"}
      transform={`rotate(45 ${x + 2.5} ${y + 2.5})`} />
  );
  return (
    <svg
      className={"tyg-scene" + (playing ? " play-" + kind : " idle")}
      viewBox="0 0 160 90"
      style={{ "--batter": accent } as CSSProperties}
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
      <Sprite x={77} y={32} color="#8b8fb8" cls="tyg-pitcher" />
      <Sprite x={64} y={62} color="var(--batter)" cls="tyg-batter" />
      <rect className="tyg-bat" x="70" y="63" width="9" height="2" fill="var(--amber)" />
      <Sprite x={88} y={74} color="#4a4a7a" cls="tyg-catcher" />
      <Sprite x={116} y={30} color="#8b8fb8" cls="tyg-fielder" />
      {/* the ball (starts in the pitcher's hand) */}
      <rect className="tyg-ball" x="82" y="40" width="3" height="3" fill="#f2f2f2" />
      {/* outcome flash */}
      <text className="tyg-flash" x="80" y="30" textAnchor="middle"
        fill={good ? "var(--green)" : "var(--red)"}>{flash}</text>
    </svg>
  );
}
