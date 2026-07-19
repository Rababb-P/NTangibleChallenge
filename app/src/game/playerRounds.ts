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
export type PlayKind = "hit" | "k" | "pop" | "glove" | "error";
export function classify(m: Moment): { kind: PlayKind; flash: string } {
  const a = m.action.toLowerCase();
  if (a.includes("wild pitch")) return { kind: "error", flash: "WILD!" };
  if (a.includes("error") || a.includes("bobbled")) return { kind: "error", flash: "E!" };
  if (a.includes("popped up")) return { kind: "pop", flash: "OUT!" };
  if (a.includes("strikeout") || a.includes("caught looking")) return { kind: "k", flash: "K!" };
  if (a.includes("backhand") || a.includes("beats the runner")) return { kind: "glove", flash: "OUT!" };
  if (a.includes("double")) return { kind: "hit", flash: "2B!" };
  if (a.includes("walk-off")) return { kind: "hit", flash: "WALK-OFF!" };
  if (a.includes("single") || a.includes("extra base")) return { kind: "hit", flash: "SAFE!" };
  if (a.includes("sac fly") || a.includes("run scores")) return { kind: "hit", flash: "RUN!" };
  return m.outcome === "positive" ? { kind: "hit", flash: "SAFE!" } : { kind: "k", flash: "K!" };
}

// Situation text → which bases to light up in the scene.
export function basesFrom(situation: string): [boolean, boolean, boolean] {
  const s = situation.toLowerCase();
  if (s.includes("bases loaded")) return [true, true, true];
  if (s.includes("two on")) return [true, true, false];
  if (s.includes("scoring position")) return [false, true, true];
  return [/on first/.test(s), /on second/.test(s), /on third/.test(s)];
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
}
export interface TrioRound {
  theme: string; prompt: string; lesson: string;
  cards: TrioCard[];
  winnerId: string;
  bases: [boolean, boolean, boolean];
  edges: number; // how many signals pointed at the winner (0 = humbling round)
}

const toCard = (moment: Moment): TrioCard => ({
  athlete: athleteById[moment.athlete_id],
  stats: STATS[moment.athlete_id],
  moment,
  game: gameById[moment.game_id],
  cfAt: clutchAt(moment.athlete_id, moment.date),
  trend: trendAt(moment.athlete_id, moment.date),
  reps30: repsBefore(moment.athlete_id, moment.date, 30),
  delivered: moment.outcome === "positive",
  ...classify(moment),
});

// Which of the winner's pre-moment signals genuinely beat both losers?
function edgesOf(winner: TrioCard, losers: TrioCard[]): string[] {
  const edges: string[] = [];
  if (winner.trend > Math.max(...losers.map((l) => l.trend)))
    edges.push(`her score was climbing ${fmtDelta(winner.trend)} in the three months before it — the steepest line on the card`);
  if (winner.reps30 > Math.max(...losers.map((l) => l.reps30)))
    edges.push(`she logged ${winner.reps30} rep sessions in the prior 30 days — the most of the three`);
  const r = winner.stats.resetAvg;
  if (r != null && losers.every((l) => l.stats.resetAvg == null || l.stats.resetAvg > r))
    edges.push(`she resets after mistakes in ${r.toFixed(1)} pitches — the fastest here`);
  return edges;
}

function lessonFor(winner: TrioCard, edges: string[]): string {
  const first = winner.athlete.name.split(" ")[0];
  if (edges.length === 0)
    return `${first} came through with none of the usual signals on her side. The signals move your odds — they never own the outcome. And neither does a slump.`;
  return `${first} came through, and the signals said she might: ${edges.slice(0, 2).join(", and ")}. The work shows up before the result does.`;
}

function buildTrios(): TrioRound[] {
  // 1. group every clutch moment by its situation (the "kind of pressure")
  const bySituation = new Map<string, Moment[]>();
  for (const m of MOMENTS) {
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

export interface TakeawayRow {
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
    { label: "TRAJECTORY (3-MO)", hers: fmtDelta(winner.trend), mine: fmtDelta(yourTrend), good: trendGood },
    { label: "MINDSET · " + herTop.name.toUpperCase(), hers: String(herTop.score), mine: String(myScore), good: mindGood },
  ];

  // The losing side of the lesson: did the misses share a thin-reps pattern,
  // and does your current habit look more like theirs or like the winner's?
  const thin = losers.filter((l) => l.reps30 < winner.reps30);
  let note: string;
  if (thin.length && !paceGood) {
    const names = thin.map((l) => l.athlete.name.split(" ")[0]).join(" and ");
    note = `${names} went into ${thin.length > 1 ? "their misses" : "her miss"} on thinner reps than ${wFirst} carried. Your current pace is closer to ${thin.length > 1 ? "theirs" : "hers"} — your training plan at the end targets exactly that.`;
  } else if (thin.length) {
    note = `The misses here came on thinner reps than ${wFirst}'s. Your habit already outruns that pattern — protect it.`;
  } else {
    note = `No habit gap separated this trio — some moments just break. What you control is the trajectory you bring to the next one.`;
  }
  return { rows, note };
}
