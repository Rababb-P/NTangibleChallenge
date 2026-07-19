// Trust Your Gut — season stats.
// Every number the game shows is computed here, in one pass, straight from the
// canonical season in the repo's data/ folder. Nothing is pre-baked.
//
// Two "pick rules" compete in the game:
//   GUT  = the best season batting average (what the traditional card argues)
//   DATA = the best average in pressure games, margin ≤ 2 (what the mental
//          data argues — the split hiding inside the same box scores)

import athletesJson from "../../../data/athletes.json";
import gamesJson from "../../../data/games.json";
import gameLogJson from "../../../data/game_log.json";
import momentsJson from "../../../data/moments.json";
import clutchHistoryJson from "../../../data/clutch_history.json";
import nterpretJson from "../../../data/nterpret.json";
import drillsJson from "../../../data/drills.json";
import drillLogJson from "../../../data/drill_log.json";

export interface Athlete {
  id: string; name: string; position: string; jersey: number; tier: string;
  clutch_score: number; alignment: number; color: string; quote: string;
}
export interface Game {
  game_id: string; date: string; opponent: string; home_away: string;
  result: string; team_runs: number; opp_runs: number; margin: number; pressure: boolean;
}
export interface StatLine { athlete_id: string; game_id: string; ab: number; h: number; hr: number; rbi: number; }
export interface Moment {
  moment_id: string; game_id: string; date: string; athlete_id: string;
  inning: number; leverage: number; situation: string; action: string;
  outcome: string; reset_pitches: number;
}

export interface Drill { id: string; title: string; axis: string; duration_min: number; description: string; steps: string[]; }
export interface NDomain { key: string; name: string; score: number; summary: string; }
interface NProfile { current: { headline: string; summary: string; domains: NDomain[]; strengths: string[]; growth_areas: string[] }; }

export const ATHLETES = athletesJson as Athlete[];
export const GAMES = gamesJson as Game[];
const LOG = gameLogJson as StatLine[];
export const MOMENTS = momentsJson as Moment[];
const HISTORY = clutchHistoryJson as Record<string, { date: string; score: number }[]>;
const NTERPRET = nterpretJson as unknown as Record<string, NProfile>;
export const DRILLS = drillsJson as Drill[];
const DRILL_LOG = drillLogJson as { athlete_id: string; drill_id: string; date: string }[];

export const athleteById = Object.fromEntries(ATHLETES.map((a) => [a.id, a]));
export const gameById = Object.fromEntries(GAMES.map((g) => [g.game_id, g]));

export const PRESSURE_GAMES = GAMES.filter((g) => g.pressure).length;

export interface SeasonStats {
  ab: number; avg: number; hr: number; rbi: number; // the card front (box score)
  pressureAvg: number; regularAvg: number;          // the card back (the split)
  resetAvg: number | null; momentCount: number;     // clutch-moment log
  clutchDelta: number;                              // 18-month trajectory
}

const battingAvg = (rows: StatLine[]) => {
  const ab = rows.reduce((s, r) => s + r.ab, 0);
  return ab ? rows.reduce((s, r) => s + r.h, 0) / ab : 0;
};

export const STATS: Record<string, SeasonStats> = Object.fromEntries(
  ATHLETES.map((a) => {
    const rows = LOG.filter((r) => r.athlete_id === a.id);
    const pressure = rows.filter((r) => gameById[r.game_id].pressure);
    const regular = rows.filter((r) => !gameById[r.game_id].pressure);
    const myMoments = MOMENTS.filter((m) => m.athlete_id === a.id);
    const hist = HISTORY[a.id];
    return [a.id, {
      ab: rows.reduce((s, r) => s + r.ab, 0),
      avg: battingAvg(rows),
      hr: rows.reduce((s, r) => s + r.hr, 0),
      rbi: rows.reduce((s, r) => s + r.rbi, 0),
      pressureAvg: battingAvg(pressure),
      regularAvg: battingAvg(regular),
      resetAvg: myMoments.length
        ? myMoments.reduce((s, m) => s + m.reset_pitches, 0) / myMoments.length
        : null,
      momentCount: myMoments.length,
      clutchDelta: hist[hist.length - 1].score - hist[0].score,
    }];
  }),
);

// Candidates for a moment: the athlete who was actually in it, plus the two
// best season averages who batted in that same game — the natural gut bait.
export function candidatesFor(m: Moment): string[] {
  const batted = LOG.filter((r) => r.game_id === m.game_id && r.ab > 0).map((r) => r.athlete_id);
  const others = batted
    .filter((id) => id !== m.athlete_id)
    .sort((a, b) => STATS[b].avg - STATS[a].avg)
    .slice(0, 2);
  return [m.athlete_id, ...others];
}

const bestBy = (ids: string[], score: (id: string) => number) =>
  ids.reduce((best, id) => (score(id) > score(best) ? id : best));

export const gutPick = (ids: string[]) => bestBy(ids, (id) => STATS[id].avg);
export const dataPick = (ids: string[]) => bestBy(ids, (id) => STATS[id].pressureAvg);

// The end-screen receipts: across every delivered high-leverage moment in a
// pressure game this season, how often did each rule name the right player?
export const ELIGIBLE = MOMENTS.filter(
  (m) => m.outcome === "positive" && gameById[m.game_id].pressure && m.leverage >= 4,
);
export function calibration() {
  let gut = 0, data = 0, clutch = 0;
  for (const m of ELIGIBLE) {
    const ids = candidatesFor(m);
    if (gutPick(ids) === m.athlete_id) gut++;
    if (dataPick(ids) === m.athlete_id) data++;
    if (bestBy(ids, (id) => athleteById[id].clutch_score) === m.athlete_id) clutch++;
  }
  return { total: ELIGIBLE.length, gut, data, clutch };
}

// ── player-mode signals (all as-of a date, so no round peeks at the future) ──

// Clutch Factor at the time of a moment (last monthly point on or before it).
export function clutchAt(id: string, date: string): number {
  const h = HISTORY[id].filter((p) => p.date <= date);
  return h.length ? h[h.length - 1].score : HISTORY[id][0].score;
}

// Trajectory: how much her Clutch Factor moved over the ~3 months before a date.
export function trendAt(id: string, date: string): number {
  const h = HISTORY[id].filter((p) => p.date <= date);
  return h.length >= 4 ? h[h.length - 1].score - h[h.length - 4].score : 0;
}

// Training habit: drill sessions logged in the N days before a date.
export function repsBefore(id: string, date: string, days = 30): number {
  const cutoff = new Date(date).getTime();
  return DRILL_LOG.filter((r) => {
    if (r.athlete_id !== id || r.date >= date) return false;
    return (cutoff - new Date(r.date).getTime()) / 86400000 <= days;
  }).length;
}

export const repsTotal = (id: string) =>
  DRILL_LOG.filter((r) => r.athlete_id === id).length;

export const historyOf = (id: string) => HISTORY[id];

// ── the training-plan inputs ──
export const domainsOf = (id: string): NDomain[] => NTERPRET[id].current.domains;
export const weakestDomain = (id: string): NDomain =>
  domainsOf(id).reduce((w, d) => (d.score < w.score ? d : w));
export const drillsForAxis = (axis: string) => DRILLS.filter((d) => d.axis === axis);

// "The growers": athletes whose Clutch Factor climbed 150+ points over 18 months.
// Their training pace is the honest, data-backed target (reps ↔ growth, r ≈ 0.74).
const LOG_WEEKS = 48; // drill_log spans Jul 2025 – Jun 2026
export const GROWERS = ATHLETES.filter((a) => STATS[a.id].clutchDelta >= 150);
export const growersPace = () =>
  GROWERS.reduce((s, a) => s + repsTotal(a.id), 0) / GROWERS.length / LOG_WEEKS;
export const growersDelta = () =>
  GROWERS.reduce((s, a) => s + STATS[a.id].clutchDelta, 0) / GROWERS.length;
export const myPace = (id: string) => repsTotal(id) / LOG_WEEKS;

// ── tiny formatters shared by the UI ──
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");
export const fmtDelta = (v: number) => (v >= 0 ? "+" + v : String(v));
