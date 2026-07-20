// Data and calculations shared by the Player game.

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
interface StatLine { athlete_id: string; ab: number; h: number; }
export interface Moment {
  moment_id: string; game_id: string; date: string; athlete_id: string;
  inning: number; leverage: number; situation: string; action: string;
  outcome: string; reset_pitches: number;
}

interface Drill { id: string; title: string; axis: string; duration_min: number; description: string; steps: string[]; video_url?: string; }
interface NDomain { key: string; name: string; score: number; summary: string; }
interface NProfile { current: { headline: string; summary: string; domains: NDomain[]; strengths: string[]; growth_areas: string[] }; }

export const ATHLETES = athletesJson as Athlete[];
const GAMES = gamesJson as Game[];
const LOG = gameLogJson as StatLine[];
export const MOMENTS = momentsJson as Moment[];
const HISTORY = clutchHistoryJson as Record<string, { date: string; score: number }[]>;
const NTERPRET = nterpretJson as unknown as Record<string, NProfile>;
const DRILLS = drillsJson as Drill[];
const DRILL_LOG = drillLogJson as { athlete_id: string; drill_id: string; date: string }[];

export const athleteById = Object.fromEntries(ATHLETES.map((a) => [a.id, a]));
export const gameById = Object.fromEntries(GAMES.map((g) => [g.game_id, g]));

export interface SeasonStats {
  avg: number;
  resetAvg: number | null;
}

const battingAvg = (rows: StatLine[]) => {
  const ab = rows.reduce((s, r) => s + r.ab, 0);
  return ab ? rows.reduce((s, r) => s + r.h, 0) / ab : 0;
};

export const STATS: Record<string, SeasonStats> = Object.fromEntries(
  ATHLETES.map((a) => {
    const rows = LOG.filter((r) => r.athlete_id === a.id);
    const myMoments = MOMENTS.filter((m) => m.athlete_id === a.id);
    return [a.id, {
      avg: battingAvg(rows),
      resetAvg: myMoments.length
        ? myMoments.reduce((s, m) => s + m.reset_pitches, 0) / myMoments.length
        : null,
    }];
  }),
);

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
export const drillsForAxis = (axis: string) => DRILLS.filter((d) => d.axis === axis);
const LOG_WEEKS = 48; // drill_log spans Jul 2025 – Jun 2026
export const myPace = (id: string) => repsTotal(id) / LOG_WEEKS;

// ── tiny formatters shared by the UI ──
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");
export const fmtDelta = (v: number) => (v >= 0 ? "+" + v : String(v));
