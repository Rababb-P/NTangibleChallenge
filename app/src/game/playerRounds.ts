// Player mode — algorithmic round builder.
// Nothing here is hand-picked. The builder groups the season's clutch moments
// by situation, finds every "one delivered, two didn't" trio among distinct
// athletes, ranks trios by leverage, and keeps the five most dramatic with
// distinct winners. Lesson lines are generated from the same signals the cards
// show. Regenerate the season (new seed, new roster) and you get new rounds,
// new lessons, new animations — for free.

import {
  MOMENTS, STATS, athleteById, gameById,
  clutchAt, trendAt, repsBefore, repsTotal, myPace, historyOf, domainsOf,
  fmtDelta,
  type Athlete, type Game, type Moment, type SeasonStats,
} from "./stats";

// ── 8-bit scene classification: action text → animation + flash label ──
// "kswing" swings through the ball, "k" is a called third strike (bat never
// moves), "wild" skips past the catcher to the backstop. Hits carry the
// direction the action names so the ball leaves on the right vector.
export type PlayKind = "hit" | "k" | "kswing" | "pop" | "glove" | "error" | "wild";
export type HitDir = "left" | "middle";
function classify(m: Moment): { kind: PlayKind; flash: string; dir?: HitDir } {
  const a = m.action.toLowerCase();
  const dir: HitDir | undefined =
    a.includes("left side") ? "left" : a.includes("up the middle") ? "middle" : undefined;
  if (a.includes("wild pitch")) return { kind: "wild", flash: "WILD!" };
  if (a.includes("error") || a.includes("bobbled")) return { kind: "error", flash: "ERROR!" };
  if (a.includes("popped up")) return { kind: "pop", flash: "OUT!" };
  if (a.includes("strikeout") && a.includes("swinging")) return { kind: "kswing", flash: "STRIKEOUT!" };
  if (a.includes("strikeout") || a.includes("caught looking")) return { kind: "k", flash: "STRIKEOUT!" };
  if (a.includes("backhand") || a.includes("beats the runner")) return { kind: "glove", flash: "OUT!" };
  if (a.includes("double")) return { kind: "hit", flash: "DOUBLE!", dir };
  if (a.includes("walk-off")) return { kind: "hit", flash: "WALK-OFF!", dir };
  if (a.includes("single") || a.includes("extra base")) return { kind: "hit", flash: "SAFE!", dir };
  if (a.includes("sac fly") || a.includes("run scores")) return { kind: "hit", flash: "RUN!", dir };
  return m.outcome === "positive" ? { kind: "hit", flash: "SAFE!", dir } : { kind: "k", flash: "STRIKEOUT!" };
}

// Situation text → which bases to light up in the scene.
function basesFrom(situation: string): [boolean, boolean, boolean] {
  const s = situation.toLowerCase();
  if (s.includes("bases loaded")) return [true, true, true];
  if (s.includes("two on")) return [true, true, false];
  if (s.includes("scoring position")) return [false, true, true];
  return [/on first/.test(s), /on second/.test(s), /on third/.test(s)];
}

// ── pre-bet context parsers ──
// Everything below reads only the situation text (and a position) — never the
// action, outcome, or final score — so nothing here can leak who delivered.
// The same parsers feed the situation chips, the card fronts, and the booth
// announcer's scene-setting call.

function outsFrom(situation: string): number | null {
  const s = situation.toLowerCase();
  if (s.includes("two out")) return 2;
  if (s.includes("one out")) return 1;
  if (s.includes("nobody out")) return 0;
  return null;
}

function countFrom(situation: string): string | null {
  const s = situation.toLowerCase();
  if (s.includes("full count")) return "3-2";
  const m = s.match(/down (\d)-(\d) in the count/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// The emotional stakes of the situation, as short scoreboard chips.
function stakesFrom(situation: string): string[] {
  const s = situation.toLowerCase();
  const chips: string[] = [];
  if (s.includes("bottom of the seventh")) chips.push("BOTTOM 7");
  if (s.includes("tie game")) chips.push("TIE GAME");
  if (s.includes("down by one")) chips.push("DOWN BY ONE");
  if (s.includes("go-ahead run on second")) chips.push("GO-AHEAD RUN ON 2ND");
  if (s.includes("winning run on second")) chips.push("WINNING RUN ON 2ND");
  if (s.includes("tying run on third")) chips.push("TYING RUN ON 3RD");
  if (s.includes("game on the line")) chips.push("GAME ON THE LINE");
  if (s.includes("rough game")) chips.push("AFTER A ROUGH GAME");
  if (s.includes("after an error")) chips.push("AFTER AN ERROR");
  if (s.includes("teammate's strikeout")) chips.push("AFTER A TEAMMATE'S K");
  return chips;
}

// What the athlete is actually doing in her moment.
function roleKindOf(situation: string): "circle" | "field" | "plate" {
  const s = situation.toLowerCase();
  if (s.startsWith("pitching")) return "circle";
  if (s.includes("defensive")) return "field";
  return "plate";
}
function roleFrom(situation: string, position: string): string {
  const rk = roleKindOf(situation);
  return rk === "circle" ? "IN THE CIRCLE" : rk === "field" ? "IN THE FIELD AT " + position : "AT THE PLATE";
}

// The generated season occasionally pairs a situation with an action that
// can't belong to it — a defensive moment whose action is "Caught looking",
// a first at-bat that ends in a throwing error. Those would replay (and be
// announced) as nonsense, so the round builder skips them.
const COHERENT_KINDS: Record<ReturnType<typeof roleKindOf>, PlayKind[]> = {
  circle: ["k", "kswing", "wild"],
  field: ["glove", "error"],
  plate: ["hit", "k", "kswing", "pop"],
};
const coherent = (m: Moment): boolean =>
  COHERENT_KINDS[roleKindOf(m.situation)].includes(classify(m).kind);

export function basesLabel(b: [boolean, boolean, boolean]): string {
  if (b[0] && b[1] && b[2]) return "BASES LOADED";
  const on = [b[0] && "1ST", b[1] && "2ND", b[2] && "3RD"].filter(Boolean) as string[];
  if (on.length === 0) return "BASES EMPTY";
  return (on.length === 1 ? "RUNNER ON " : "RUNNERS ON ") + on.join(" & ");
}

// Situation text → short arcade round title.
function themeOf(situation: string): string {
  const s = situation.toLowerCase();
  if (s.startsWith("pitching")) return "THE CIRCLE";
  if (s.includes("at-bat back")) return "THE BOUNCE-BACK";
  if (s.includes("defensive")) return "THE GLOVE";
  if (s.includes("teammate")) return "PICK HER UP";
  return situation.split(",")[0].toUpperCase();
}

export interface TrioCard {
  athlete: Athlete;
  stats: SeasonStats;
  moment: Moment;
  game: Game;
  cfAt: number;    // hidden until the reveal
  trend: number;   // 3-month clutch delta before her moment
  reps30: number;  // drill sessions in the 30 days before her moment
  delivered: boolean;
  kind: PlayKind;
  flash: string;
  dir?: HitDir;    // where a hit leaves the bat, when the action says
  role: string;    // what she's doing in the play — safe to show pre-bet
}
export interface TrioRound {
  theme: string; prompt: string; lesson: string;
  cards: TrioCard[];
  winnerId: string;
  bases: [boolean, boolean, boolean];
  outs: number | null;   // parsed from the situation; null = not stated
  count: string | null;
  stakes: string[];
  edges: number; // how many signals pointed at the winner (0 = humbling round)
}

const toCard = (moment: Moment): TrioCard => {
  return {
    athlete: athleteById[moment.athlete_id],
    stats: STATS[moment.athlete_id],
    moment,
    game: gameById[moment.game_id],
    cfAt: clutchAt(moment.athlete_id, moment.date),
    trend: trendAt(moment.athlete_id, moment.date),
    reps30: repsBefore(moment.athlete_id, moment.date, 30),
    delivered: moment.outcome === "positive",
    role: roleFrom(moment.situation, athleteById[moment.athlete_id].position),
    ...classify(moment),
  };
};

// Which of the winner's pre-moment signals genuinely beat both losers?
function edgesOf(winner: TrioCard, losers: TrioCard[]): string[] {
  const edges: string[] = [];
  if (winner.trend > Math.max(...losers.map((l) => l.trend)))
    edges.push(`her score was climbing ${fmtDelta(winner.trend)} in the three months before it — the steepest line on the card`);
  if (winner.reps30 > Math.max(...losers.map((l) => l.reps30)))
    edges.push(`she logged ${winner.reps30} rep sessions in the prior 30 days — the most of the three`);
  const r = winner.stats.resetAvg;
  if (r != null && losers.every((l) => l.stats.resetAvg == null || l.stats.resetAvg > r))
    edges.push(`her ${r.toFixed(1)}-pitch reset average was the quickest of the three`);
  return edges;
}

function lessonFor(winner: TrioCard, edges: string[]): string {
  const first = winner.athlete.name.split(" ")[0];
  if (edges.length === 0)
    return `None of the tracked stats clearly favored ${first}, but she still delivered. These signals can improve the odds, but they do not cause or guarantee one result.`;
  return `What helped explain ${first}'s win: ${edges.join(", and ")}. Those advantages correlate with being prepared for pressure, but they do not guarantee the result.`;
}

function buildTrios(): TrioRound[] {
  // 1. group every clutch moment by its situation (the "kind of pressure"),
  //    dropping moments whose action doesn't fit the situation's role
  const bySituation = new Map<string, Moment[]>();
  for (const m of MOMENTS) {
    if (!coherent(m)) continue;
    const list = bySituation.get(m.situation) ?? [];
    list.push(m);
    bySituation.set(m.situation, list);
  }

  // 2. one candidate trio per situation: the highest-leverage delivered moment,
  //    plus the two highest-leverage misses by two OTHER athletes
  const byDrama = (a: Moment, b: Moment) => b.leverage - a.leverage || a.date.localeCompare(b.date);
  const candidates: TrioRound[] = [];
  for (const [situation, ms] of bySituation) {
    const winnerMoment = ms.filter((m) => m.outcome === "positive").sort(byDrama)[0];
    if (!winnerMoment) continue;
    const seen = new Set([winnerMoment.athlete_id]);
    const loserMoments: Moment[] = [];
    for (const m of ms.filter((x) => x.outcome === "negative").sort(byDrama)) {
      if (seen.has(m.athlete_id)) continue;
      loserMoments.push(m);
      seen.add(m.athlete_id);
      if (loserMoments.length === 2) break;
    }
    if (loserMoments.length < 2) continue;

    const winner = toCard(winnerMoment);
    const losers = loserMoments.map(toCard);
    const edges = edgesOf(winner, losers);
    const cards = [winner, ...losers].sort((a, b) => a.athlete.jersey - b.athlete.jersey);
    candidates.push({
      theme: themeOf(situation),
      prompt: `${situation}. Three teammates faced this in their own games. One came through. Who?`,
      lesson: lessonFor(winner, edges),
      cards,
      winnerId: winnerMoment.athlete_id,
      bases: basesFrom(situation),
      outs: outsFrom(situation),
      count: countFrom(situation),
      stakes: stakesFrom(situation),
      edges: edges.length,
    });
  }

  // 3. rank by total leverage; prefer five rounds with five different winners
  const drama = (t: TrioRound) => t.cards.reduce((s, c) => s + c.moment.leverage, 0);
  candidates.sort((a, b) => drama(b) - drama(a));
  const picked: TrioRound[] = [];
  const usedWinners = new Set<string>();
  for (const t of candidates) {
    if (picked.length === 5) break;
    if (usedWinners.has(t.winnerId)) continue;
    picked.push(t);
    usedWinners.add(t.winnerId);
  }
  for (const t of candidates) {
    if (picked.length === 5) break;
    if (!picked.includes(t)) picked.push(t);
  }

  // 4. readable rounds first, signal-defying rounds last (the humbling finale)
  return picked.sort((a, b) => b.edges - a.edges);
}

export const TRIOS: TrioRound[] = buildTrios();

// ── the personal takeaway: relate the round's winner (and losers) to YOU ──
// Three comparable habits, each with a verdict: keep maintaining it, or train
// it. "Hers" is what the winner carried into her moment; "you" is the chosen
// athlete's current version of the same signal. All computed, no authored text.

interface TakeawayRow {
  label: string;
  hers: string;
  mine: string;
  good: boolean; // true = maintain, false = train this
}

export function takeawaysFor(meId: string, round: TrioRound): { rows: TakeawayRow[]; note: string } {
  const winner = round.cards.find((c) => c.delivered)!;
  const losers = round.cards.filter((c) => !c.delivered);
  const wFirst = winner.athlete.name.split(" ")[0];

  // 1. rep habit — her season pace vs yours (80% of hers counts as keeping up)
  const herPace = repsTotal(winner.athlete.id) / 48;
  const yourPace = myPace(meId);
  const paceGood = yourPace >= herPace * 0.8;

  // 2. trajectory — her 3-month climb going into the moment vs yours right now
  const myHist = historyOf(meId);
  const yourTrend = trendAt(meId, myHist[myHist.length - 1].date);
  const trendGood = yourTrend >= winner.trend;

  // 3. mindset — the winner's strongest mental domain vs your score in it
  const herTop = domainsOf(winner.athlete.id).reduce((t, d) => (d.score > t.score ? d : t));
  const myScore = domainsOf(meId).find((d) => d.key === herTop.key)?.score ?? 0;
  const mindGood = myScore >= herTop.score * 0.9;

  const rows: TakeawayRow[] = [
    { label: "REP HABIT", hers: herPace.toFixed(1) + "/WK", mine: yourPace.toFixed(1) + "/WK", good: paceGood },
    { label: "CLUTCH FACTOR (3-MO CHANGE)", hers: fmtDelta(winner.trend), mine: fmtDelta(yourTrend), good: trendGood },
    { label: "MINDSET · " + herTop.name.toUpperCase(), hers: String(herTop.score), mine: String(myScore), good: mindGood },
  ];

  // The losing side of the lesson: did the misses share a thin-reps pattern,
  // and does your current habit look more like theirs or like the winner's?
  const thin = losers.filter((l) => l.reps30 < winner.reps30);
  let note: string;
  if (thin.length && !paceGood) {
    const names = thin.map((l) => l.athlete.name.split(" ")[0]).join(" and ");
    note = `${names} went into ${thin.length > 1 ? "their misses" : "her miss"} on thinner reps than ${wFirst} carried. Your current habit is closer to ${thin.length > 1 ? "theirs" : "hers"} — that is a useful signal to carry into the next round.`;
  } else if (thin.length) {
    note = `The misses here came on thinner reps than ${wFirst}'s. Your habit already outruns that pattern — protect it.`;
  } else {
    note = `No habit gap separated this trio — some moments just break. What you control is the trajectory you bring to the next one.`;
  }
  return { rows, note };
}
