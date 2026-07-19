// Trust Your Gut — the five rounds.
// Each round is a real high-leverage moment from one of the season's pressure
// games (margin ≤ 2). The intro and story lines are hand-written framing; every
// number on the cards is computed in stats.ts. The arc is deliberate:
// data wins, data wins, gut wins, nobody wins, hidden gem closes it out.

import {
  ATHLETES, MOMENTS, STATS, athleteById, gameById,
  candidatesFor, dataPick,
  type Athlete, type Game, type Moment, type SeasonStats,
} from "./stats";

const CONFIG: { momentId: string; intro: string; story: string }[] = [
  {
    momentId: "m005",
    intro: "Season opener. Bottom of the 7th, winning run on second, two out. One swing ends it. Who do you want at the plate?",
    story: "The gut goes to the best average on the field. The mental data went to Dani — highest Clutch Factor on the roster, fastest reset after a mistake. She hit the walk-off. She'd do it four more times this season.",
  },
  {
    momentId: "m007",
    intro: "Three weeks later. Full count, go-ahead run on second. Pick your hitter.",
    story: "Priya's box score is the worst of the three. But she gets BETTER when the margin is thin — and her Clutch Factor outranks the team's best average. Line-drive double into the gap.",
  },
  {
    momentId: "m009",
    intro: "Same game, one inning later. Bases loaded, two out. Who do you trust?",
    story: "The gut pick delivers. Rowan owns the best average on the team — the catch is WHEN: she feasts in comfortable games and cools off in tight ones. The data isn't anti-gut. It just knows which version of a player shows up under pressure.",
  },
  {
    momentId: "m020",
    intro: "October. One-run game, 6th inning, the game on the line. Your call.",
    story: "Nobody picks Mika — look at that average. But nobody on this roster has been thrown into more logged clutch moments either. The data improves your odds. It doesn't own the outcome — and neither does your gut.",
  },
  {
    momentId: "m041",
    intro: "January. Down by one, two on, nobody out. Last round — make it count.",
    story: "Harper's season average scares no one — and it hides the biggest pressure jump on the roster. When the margin gets thin, she turns into the best hitter on the team. That gap between the box score and the moment is exactly what Clutch Factor exists to measure.",
  },
];

export interface Candidate { athlete: Athlete; stats: SeasonStats; }
export interface Round {
  moment: Moment; game: Game; intro: string; story: string;
  candidates: Candidate[];
  actualId: string;    // who was really in the moment (the answer)
  dataPickId: string;  // who the mental data would send up
}

export const ROUNDS: Round[] = CONFIG.flatMap(({ momentId, intro, story }) => {
  const moment = MOMENTS.find((m) => m.moment_id === momentId);
  if (!moment) return []; // regenerated dataset — skip rounds that no longer exist
  const ids = candidatesFor(moment);
  return [{
    moment, game: gameById[moment.game_id], intro, story,
    candidates: ids.map((id) => ({ athlete: athleteById[id], stats: STATS[id] })),
    actualId: moment.athlete_id,
    dataPickId: dataPick(ids),
  }];
});

// Shuffle-stable card order: sort by season average so the gut bait reads
// left-to-right and the answer isn't always the first card.
for (const r of ROUNDS) r.candidates.sort((a, b) => b.stats.avg - a.stats.avg);

export const ROSTER_SIZE = ATHLETES.length;
