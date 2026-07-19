// Player mode — the five trio rounds.
// Each round is one KIND of pressure. Three teammates each faced it in their
// own game; exactly one delivered. Before the bet you see signals (trajectory,
// rep habit, reset speed, her own words) — never the raw Clutch Factor. The
// reveal shows all three outcomes and the score each carried into her moment.
//
// The arc is deliberate: two signal-readable rounds, a pitching round, a murky
// round (everyone sliding — signals are odds, not destiny), and the crescendo:
// the lowest score on the team, climbing fastest, beats the highest score
// standing still. Trajectory over snapshot — which is what the training plan
// at the end is for.

import {
  MOMENTS, STATS, athleteById, gameById,
  clutchAt, trendAt, repsBefore,
  type Athlete, type Game, type Moment, type SeasonStats,
} from "./stats";

const CONFIG: { theme: string; prompt: string; momentIds: string[]; lesson: string }[] = [
  {
    theme: "FULL COUNT",
    prompt: "Full count, go-ahead run on second. Three teammates stood in this exact spot in three different games. One came through. Who?",
    momentIds: ["m007", "m003", "m063"],
    lesson: "Priya's line was climbing fastest and her reps were the steadiest of the three. The swing that followed was a line-drive double. Trajectory showed up before the result did.",
  },
  {
    theme: "THE CIRCLE",
    prompt: "Pitching with the tying run on third. All three of these arms have stood there. One ended the threat. Who?",
    momentIds: ["m018", "m004", "m056"],
    lesson: "Rowan's score had jumped 66 points in the three months before that jam — the steepest climb of the three at the time. The strikeout looking wasn't luck arriving; it was form arriving.",
  },
  {
    theme: "BASES LOADED",
    prompt: "Bases loaded, two out, midwinter. All three of these hitters were in a slide when their moment came. One still made the play. Who?",
    momentIds: ["m009", "m044", "m047"],
    lesson: "Every signal here pointed down — all three were slumping. Rowan made the heads-up play anyway. The signals move your odds; they never own the outcome. Neither does a slump.",
  },
  {
    theme: "DOWN BY ONE",
    prompt: "Two on, nobody out, down by one. Three teammates, three games, same weight. Who delivered?",
    momentIds: ["m041", "m008", "m026"],
    lesson: "Harper had the deepest rep habit and the fastest reset of the three. When the moment came she put the ball up the middle. The work you do between games is what walks to the plate with you.",
  },
  {
    theme: "THE BOUNCE-BACK",
    prompt: "First at-bat back after a rough game — the at-bat that tests what you carry with you. One of these three flushed it and delivered. Who?",
    momentIds: ["m002", "m006", "m034"],
    lesson: "Gabby carried the LOWEST score on this card — and the steepest climb on the team, 86 points in a quarter. The highest score here was standing still, and it showed. A snapshot tells you where someone is. A trajectory tells you who's coming.",
  },
];

export interface TrioCard {
  athlete: Athlete;
  stats: SeasonStats;
  moment: Moment;
  game: Game;
  cfAt: number;    // hidden until the reveal
  trend: number;   // 3-month clutch delta before her moment
  reps30: number;  // drill sessions in the 30 days before her moment
  delivered: boolean;
}
export interface TrioRound {
  theme: string; prompt: string; lesson: string;
  cards: TrioCard[];
  winnerId: string;
}

export const TRIOS: TrioRound[] = CONFIG.flatMap(({ theme, prompt, momentIds, lesson }) => {
  const moments = momentIds
    .map((id) => MOMENTS.find((m) => m.moment_id === id))
    .filter((m): m is Moment => !!m);
  const winner = moments.find((m) => m.outcome === "positive");
  if (moments.length !== 3 || !winner) return []; // regenerated dataset — drop the round
  const cards = moments.map((moment) => ({
    athlete: athleteById[moment.athlete_id],
    stats: STATS[moment.athlete_id],
    moment,
    game: gameById[moment.game_id],
    cfAt: clutchAt(moment.athlete_id, moment.date),
    trend: trendAt(moment.athlete_id, moment.date),
    reps30: repsBefore(moment.athlete_id, moment.date, 30),
    delivered: moment.outcome === "positive",
  }));
  // Order by jersey so the winner isn't always the first card.
  cards.sort((a, b) => a.athlete.jersey - b.athlete.jersey);
  return [{ theme, prompt, lesson, cards, winnerId: winner.athlete_id }];
});
