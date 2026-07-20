import athletesJson from "../../../data/athletes.json";
import historyJson from "../../../data/clutch_history.json";
import drillLogJson from "../../../data/drill_log.json";
import gamesJson from "../../../data/games.json";
import gameLogJson from "../../../data/game_log.json";
import momentsJson from "../../../data/moments.json";
import nterpretJson from "../../../data/nterpret.json";

type Athlete = { id: string; name: string; clutch_score: number; alignment: number };
type Point = { date: string; score: number };
type Game = { game_id: string; pressure: boolean };
type StatLine = { athlete_id: string; game_id: string; ab: number; h: number };
type Profile = {
  current: { domains: { key: string; name: string; score: number }[] };
  quarters: { domains: { key: string; score: number }[] }[];
};
type Story = { score: number; player: string; title: string; stat: string; body: string };

const athletes = athletesJson as Athlete[];
const history = historyJson as Record<string, Point[]>;
const drillLog = drillLogJson as { athlete_id: string; date: string }[];
const games = gamesJson as Game[];
const gameLog = gameLogJson as StatLine[];
const moments = momentsJson as { athlete_id: string; reset_pitches: number }[];
const profiles = nterpretJson as Record<string, Profile>;

const athleteById = Object.fromEntries(athletes.map((a) => [a.id, a]));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const reps = (id: string, from = "0000-00-00", to = "9999-99-99") =>
  drillLog.filter((d) => d.athlete_id === id && d.date >= from && d.date < to).length;
const growth = (id: string) => history[id].at(-1)!.score - history[id][0].score;
const scoreAt = (id: string, date: string) =>
  [...history[id]].reverse().find((point) => point.date <= date)?.score ?? history[id][0].score;
const battingAverage = (id: string, pressure: boolean) => {
  const gameIds = new Set(games.filter((game) => game.pressure === pressure).map((game) => game.game_id));
  const rows = gameLog.filter((row) => row.athlete_id === id && gameIds.has(row.game_id));
  const atBats = rows.reduce((sum, row) => sum + row.ab, 0);
  return atBats ? rows.reduce((sum, row) => sum + row.h, 0) / atBats : 0;
};
const resetAverage = (id: string) => mean(moments.filter((m) => m.athlete_id === id).map((m) => m.reset_pitches));
const domainScore = (id: string, key: string) => profiles[id].current.domains.find((d) => d.key === key)?.score ?? 0;
const medianReps = athletes.map((a) => reps(a.id)).sort((a, b) => a - b)[Math.floor(athletes.length / 2)];
const teamResetAverage = mean(athletes.map((a) => resetAverage(a.id)));

function storiesFor(id: string): Story[] {
  const athlete = athleteById[id];
  const points = history[id];
  const totalGrowth = growth(id);
  const totalReps = reps(id);
  const firstScore = points[0].score;
  const recentGrowth = points.at(-1)!.score - points.at(-4)!.score;
  const beforeNovember = reps(id, "2025-07-01", "2025-11-01") / 4;
  const afterNovember = reps(id, "2025-11-01") / 8;
  const afterNovemberGrowth = athlete.clutch_score - scoreAt(id, "2025-11-01");
  const pressureDifference = battingAverage(id, true) - battingAverage(id, false);
  const resilience = domainScore(id, "resilience");
  const reset = resetAverage(id);
  const candidates: Story[] = [];
  const add = (story: Omit<Story, "player">) => candidates.push({ ...story, player: athlete.name.toUpperCase() });

  if (athlete.clutch_score >= 850 && athlete.alignment < 60) add({
    score: 10 + (athlete.clutch_score - 850) / 50 + (60 - athlete.alignment) / 20,
    title: "ELITE, BUT DISCONNECTED",
    stat: `${athlete.clutch_score} CF // ${athlete.alignment} ALIGNMENT`,
    body: `${athlete.name} combines an Elite-level Clutch Factor with unusually low program alignment. The story is not about ability—it is whether the team can keep a top performer engaged.`,
  });

  if (firstScore < 750 && athlete.clutch_score >= 750) add({
    score: 8 + totalGrowth / 100,
    title: "CROSSED THE CLUTCH LINE",
    stat: `${firstScore} → ${athlete.clutch_score} CF`,
    body: `${athlete.name} began below the 750 Clutch line and finished above it after a ${signed(totalGrowth)}-point climb. The threshold crossing makes the long-term change easy to see.`,
  });

  if (afterNovember > beforeNovember * 1.5 && afterNovemberGrowth >= 50) add({
    score: 9 + afterNovemberGrowth / 100 + afterNovember / 10,
    title: "THE PRACTICE STREAK BECAME A BREAKOUT",
    stat: `${reps(id, "2025-11-01")} REPS SINCE NOV // ${signed(afterNovemberGrowth)} CF`,
    body: `${athlete.name}'s monthly training rate rose from ${beforeNovember.toFixed(1)} to ${afterNovember.toFixed(1)} sessions, while Clutch Factor climbed ${afterNovemberGrowth} points. The trends move together, though the data does not prove the reps caused the rise.`,
  });

  if (totalReps >= medianReps && totalGrowth >= 100) add({
    score: 7 + totalGrowth / 100 + totalReps / 200,
    title: "THE REPS BUILT THE TRAJECTORY",
    stat: `${totalReps} TOTAL REPS // ${signed(totalGrowth)} CF`,
    body: `${athlete.name} completed ${totalReps} mental-training sessions as Clutch Factor rose ${totalGrowth} points. This is a season-long preparation pattern, not a claim that any single rep guaranteed a result.`,
  });

  if (totalGrowth <= -80) add({
    score: 9 + Math.abs(totalGrowth) / 100,
    title: "THE LINE MOVED THE WRONG WAY",
    stat: `${signed(totalGrowth)} CF // ${totalReps} TOTAL REPS`,
    body: `${athlete.name}'s Clutch Factor declined ${Math.abs(totalGrowth)} points across the history. The falling line is more informative than one isolated pressure result.`,
  });

  let peak = points[0].score;
  let deepestDrop = 0;
  let recovery = 0;
  for (const point of points) {
    peak = Math.max(peak, point.score);
    const drop = peak - point.score;
    if (drop > deepestDrop) { deepestDrop = drop; recovery = athlete.clutch_score - point.score; }
  }
  if (deepestDrop >= 50 && recovery >= 40) add({
    score: 7 + (deepestDrop + recovery) / 100,
    title: "THE DIP AND RECOVERY",
    stat: `-${deepestDrop} DIP // +${recovery} RECOVERY`,
    body: `${athlete.name}'s history contains a major drop followed by a ${recovery}-point recovery. That arc shows why a current score alone cannot explain the season.`,
  });

  if (recentGrowth >= 50) add({
    score: 6 + recentGrowth / 50,
    title: "THE SCORE HID THE DIRECTION",
    stat: `${athlete.clutch_score} CF NOW // ${signed(recentGrowth)} IN 3 MONTHS`,
    body: `${athlete.name}'s current score is only a snapshot. A ${recentGrowth}-point three-month rise shows how quickly the underlying direction is changing.`,
  });

  if (Math.abs(pressureDifference) >= 0.08) add({
    score: 6 + Math.abs(pressureDifference) * 10,
    title: pressureDifference > 0 ? "THE PRESSURE-GAME LIFT" : "THE PRESSURE-GAME DROP",
    stat: `${signed(Number(pressureDifference.toFixed(3)))} BATTING AVG IN PRESSURE`,
    body: `${athlete.name}'s batting average changes by ${pressureDifference.toFixed(3)} in games decided by two runs or fewer. The season average hides that pressure split.`,
  });

  if (resilience >= 75 && reset <= teamResetAverage - 0.3) add({
    score: 6 + (resilience - 75) / 10 + (teamResetAverage - reset),
    title: "RESILIENCE BECAME RECOVERY",
    stat: `${resilience} RESILIENCE // ${reset.toFixed(1)} RESET PITCHES`,
    body: `${athlete.name}'s high resilience score appears in an observable behavior: a ${reset.toFixed(1)}-pitch reset average, faster than the team average of ${teamResetAverage.toFixed(1)}.`,
  });

  const domainChanges = profiles[id].current.domains.map((current) => {
    const first = profiles[id].quarters[0].domains.find((d) => d.key === current.key)?.score ?? current.score;
    return { name: current.name, change: current.score - first };
  });
  const biggestDomainChange = domainChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  if (Math.abs(biggestDomainChange.change) >= 10) add({
    score: 6 + Math.abs(biggestDomainChange.change) / 10,
    title: "THE PROFILE CHANGED",
    stat: `${biggestDomainChange.name.toUpperCase()} // ${signed(biggestDomainChange.change)}`,
    body: `${athlete.name}'s largest mental-profile change was ${biggestDomainChange.name}, which moved ${signed(biggestDomainChange.change)} points across the quarterly assessments.`,
  });

  if (candidates.length === 0) add({
    score: 1 + Math.abs(totalGrowth) / 100,
    title: "THE LONGER LINE",
    stat: `${signed(totalGrowth)} CF OVER 18 MONTHS`,
    body: `${athlete.name}'s clearest long-term signal is the ${signed(totalGrowth)}-point Clutch Factor change across the full history. No stronger unusual pattern was detected.`,
  });
  return candidates;
}

export function RoundLongView({ athleteIds }: { athleteIds: string[] }) {
  const story = athleteIds.flatMap(storiesFor).sort((a, b) => b.score - a.score)[0];
  return <aside className="tyg-long-view">
    <span>STORY FOUND // {story.player}</span>
    <h3>{story.title}</h3>
    <strong>{story.stat}</strong>
    <p>{story.body}</p>
  </aside>;
}
