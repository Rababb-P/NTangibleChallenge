// Trust Your Gut — the booth announcer. Pure text generation plus speech
// orchestration; no React. Pre-round calls read only spoiler-safe fields
// (situation, role, bases, stakes — never the action, outcome, or score).
// Outcome lines key off the same action substrings classify() uses, so the
// voice always matches the 8-bit animation on screen.
import { speak, stopSpeech, type SpeechLine } from "./speech";
import type { TrioCard, TrioRound } from "./playerRounds";

// Persisted on/off, mirroring the howie_kit_persona pattern in api.ts.
const KEY = "howie_tyg_commentary";
export const isCommentaryOn = () => localStorage.getItem(KEY) !== "off"; // default ON
export const setCommentaryOn = (on: boolean) => { localStorage.setItem(KEY, on ? "on" : "off"); };

export const stop = stopSpeech;

// Random pool pick that never repeats the last choice for the same key.
const last = new Map<string, number>();
function pick(key: string, pool: string[]): string {
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === last.get(key)) i = (i + 1) % pool.length;
  last.set(key, i);
  return pool[i];
}

// Delivery settings for each kind of announcer line.
const D = {
  hype: { rate: 1.08, pitch: 1.0 },     // openers, handoffs, replay intros
  scene: { rate: 1.02, pitch: 0.9 },    // scene-setting
  trio: { rate: 1.05, pitch: 0.95 },    // athlete intros
  windup: { rate: 1.0, pitch: 0.88 },   // the suspense beat
  outcome: { rate: 1.15, pitch: 1.0 },  // the big call
  verdict: { rate: 1.05, pitch: 0.92 }, // how your bet went
};

// ── the pre-round call: set the scene, introduce the trio, hand off the bet ──

const OPENERS = [
  "Folks, you do not want to miss this one!",
  "Oh baby, here we go again at the yard!",
  "Thunder fans, on your feet!",
  "Welcome back to the booth — this one has playoff electricity!",
];
const SCENES = [
  (s: string) => `${s} — you can feel the tension from up here!`,
  (s: string) => `The scene: ${s}. My goodness, what a spot.`,
  (s: string) => `${s}. This is what pressure looks like, folks!`,
];
const TRIO_LINES = [
  (names: string, verb: string) => `${names} — three teammates, and each one ${verb} in this exact spot.`,
  (names: string, verb: string) => `Three names to know: ${names}. Every one of them ${verb} with the game hanging in the balance.`,
];
const HANDOFFS = [
  "One of them came through. Who's got ice in her veins? Place your bet!",
  "Only one delivered. Trust your gut and lock it in!",
  "Somebody's about to be a hero. Who do you like? Lock it in!",
];

const situationOf = (round: TrioRound) => round.cards[0]?.moment.situation ?? "";
const scenePool = (situation: string) => SCENES.map((f) => f(situation));
function trioPool(round: TrioRound): string[] {
  const role = round.cards[0]?.role ?? "";
  const verb = role.startsWith("IN THE CIRCLE")
    ? "took the ball in the circle"
    : role.startsWith("IN THE FIELD")
      ? "stood ready with the game on her glove"
      : "stepped into the box";
  const [a, b, c] = round.cards.map((x) => x.athlete.name);
  return TRIO_LINES.map((f) => f(`${a}, ${b}, and ${c}`, verb));
}

function buildPreRoundCall(round: TrioRound): SpeechLine[] {
  return [
    { text: pick("open", OPENERS), ...D.hype },
    { text: pick("scene", scenePool(situationOf(round))), ...D.scene },
    { text: pick("trio", trioPool(round)), ...D.trio },
    { text: pick("handoff", HANDOFFS), ...D.hype },
  ];
}

// ── the outcome call: windup over the ball flight, the big call on the flash ──

// The .tyg-flash outcome text pops ~72-80% into the 2s scene animation.
const FLASH_MS = 1450;

const WINDUPS_CIRCLE = [
  (n: string) => `${n} rocks... and fires...`,
  (n: string) => `${n} winds... here it comes...`,
];
const WINDUPS_FIELD = [
  (n: string) => `Contact! It's a shot toward ${n}...`,
  (n: string) => `Ball's in play — this one is coming at ${n}...`,
];
const WINDUPS_PLATE = [
  (n: string) => `Here's the pitch to ${n}...`,
  (n: string) => `${n} digs in... the windup... the pitch...`,
];

function windupOptions(c: TrioCard): { key: string; lines: string[] } {
  const first = c.athlete.name.split(" ")[0];
  const pool = c.role.startsWith("IN THE CIRCLE")
    ? WINDUPS_CIRCLE
    : c.role.startsWith("IN THE FIELD")
      ? WINDUPS_FIELD
      : WINDUPS_PLATE;
  return { key: "windup", lines: pool.map((f) => f(first)) };
}

// Keyed by action substrings, same order classify() checks them.
function outcomeOptions(c: TrioCard): { key: string; lines: string[] } {
  const a = c.moment.action.toLowerCase();
  const first = c.athlete.name.split(" ")[0];
  if (a.includes("wild pitch"))
    return { key: "o-wild", lines: [
      "It skips away! The catcher can't find it, and the run comes in!",
      "Wild pitch! It's to the backstop and the runner is home!",
    ] };
  if (a.includes("error") || a.includes("bobbled"))
    return { key: "o-err", lines: [
      "It's bobbled! Everybody is safe, and the wheels are coming off!",
      "The throw sails! It gets away, and the run scores!",
    ] };
  if (a.includes("popped up"))
    return { key: "o-pop", lines: [
      "Popped up... first pitch... and it settles into the glove. Ohh, no.",
      "A high, lazy pop-up... and the chance is gone. You hate to see it.",
    ] };
  if (a.includes("caught looking"))
    return { key: "o-look", lines: [
      "Froze her! Caught looking, and the threat is over!",
      "Strike three on the corner! She never moved the bat!",
    ] };
  if (a.includes("strikeout"))
    return { key: "o-k", lines: [
      "Swing and a miss! She's rung up, and the rally dies right there!",
      "Strike three! The bat comes around and catches nothing but air!",
    ] };
  if (a.includes("backhand") || a.includes("beats the runner"))
    return { key: "o-glove", lines: [
      "Backhand stab! The throw... in time! Are you kidding me? What a play!",
      `${first} lays out! Scoops it, fires — got her! Unbelievable!`,
    ] };
  if (a.includes("walk-off"))
    return { key: "o-walkoff", lines: [
      "A line drive through the left side — the Thunder walk it off! Ballgame!",
      "Base hit! The winning run is home, and this ballgame is over!",
    ] };
  if (a.includes("double"))
    return { key: "o-2b", lines: [
      "Ripped into the gap! She's into second standing up with a double!",
      "That ball is smoked! It splits the outfielders, and the runs come pouring in!",
    ] };
  if (a.includes("single") || a.includes("extra base"))
    return { key: "o-1b", lines: [
      "Base hit! She drops it into the grass, and the Thunder are in business!",
      `${first} finds a hole! The crowd is on its feet!`,
    ] };
  if (a.includes("sac fly") || a.includes("run scores"))
    return { key: "o-sac", lines: [
      "Deep enough! The tag... and the run scores!",
      "A fly ball to the warning track — that will bring the runner home!",
    ] };
  return c.delivered
    ? { key: "o-pos", lines: [
        `${first} comes through when it matters most!`,
        `She delivers! ${first} answers the bell!`,
      ] }
    : { key: "o-neg", lines: [
        "And it just doesn't go her way this time, folks.",
        "Ohh, and the moment slips past her. That one stings.",
      ] };
}

const windupLine = (c: TrioCard) => { const o = windupOptions(c); return pick(o.key, o.lines); };
const outcomeLine = (c: TrioCard) => { const o = outcomeOptions(c); return pick(o.key, o.lines); };

const VERDICTS_HIT = [
  "Up in the booth — you called it! What a read!",
  "Your gut was dialed in — give that scout a contract!",
  "You saw it coming all the way. Tremendous!",
];
const VERDICTS_MISS = [
  "Ohh, the signals fooled us all. That's softball, folks.",
  "Not this time — this game keeps you humble.",
  "You can read every signal and still get burned. What a sport.",
];

function buildOutcomeCall(card: TrioCard, correct: boolean): SpeechLine[] {
  return [
    { text: windupLine(card), ...D.windup },
    { text: outcomeLine(card), ...D.outcome, atMs: FLASH_MS },
    { text: pick("verdict", correct ? VERDICTS_HIT : VERDICTS_MISS), ...D.verdict, delayMsBefore: 250 },
  ];
}

const REPLAY_OPENERS = [
  "Let's run that back!",
  "One more look, folks!",
  "Roll the tape!",
];

function buildReplayCall(card: TrioCard): SpeechLine[] {
  return [
    { text: pick("replay", REPLAY_OPENERS), ...D.hype },
    { text: outcomeLine(card), ...D.outcome, atMs: FLASH_MS },
  ];
}

// ── orchestration: build the call, speak it, hand the lines to the captions ──

export function callPreRound(round: TrioRound, onLine?: (i: number) => void): SpeechLine[] {
  const lines = buildPreRoundCall(round);
  speak(lines, onLine);
  return lines;
}
export function callOutcome(card: TrioCard, correct: boolean, onLine?: (i: number) => void): SpeechLine[] {
  const lines = buildOutcomeCall(card, correct);
  speak(lines, onLine);
  return lines;
}
export function callReplay(card: TrioCard, onLine?: (i: number) => void): SpeechLine[] {
  const lines = buildReplayCall(card);
  speak(lines, onLine);
  return lines;
}
