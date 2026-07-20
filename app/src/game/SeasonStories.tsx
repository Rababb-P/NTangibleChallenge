import athletesJson from "../../../data/athletes.json";
import historyJson from "../../../data/clutch_history.json";
import drillLogJson from "../../../data/drill_log.json";

type Athlete = { id: string; name: string; clutch_score: number; alignment: number };
type Point = { date: string; score: number };
const athletes = athletesJson as Athlete[];
const history = historyJson as Record<string, Point[]>;
const drills = drillLogJson as { athlete_id: string; date: string }[];
const athlete = (id: string) => athletes.find((a) => a.id === id)!;
const reps = (id: string, from = "0000-00-00") => drills.filter((d) => d.athlete_id === id && d.date >= from).length;
const growth = (id: string) => history[id].at(-1)!.score - history[id][0].score;
const scoreAt = (id: string, date: string) => [...history[id]].reverse().find((p) => p.date <= date)?.score ?? history[id][0].score;
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function RoundLongView({ roundIndex }: { roundIndex: number }) {
  const stories = [
    {
      player: "DANI OKAFOR",
      title: "ELITE, BUT DISCONNECTED",
      stat: `${athlete("ath_dani").clutch_score} CF // ${athlete("ath_dani").alignment} ALIGNMENT`,
      body: `Dani owns the highest Clutch Factor in this trio—and one of the highest on the team—but her program alignment is only ${athlete("ath_dani").alignment}. The planted story is the tension between elite ability and low buy-in: can the team keep its star engaged?`,
    },
    {
      player: "HARPER VANCE",
      title: "THE REPS BUILT A CLUTCH PLAYER",
      stat: `${reps("ath_harper")} TOTAL REPS // ${signed(growth("ath_harper"))} CF`,
      body: `Harper has put in ${reps("ath_harper")} mental-training sessions across the season. Her Clutch Factor climbed ${growth("ath_harper")} points to ${athlete("ath_harper").clutch_score}, moving her above the 750 Clutch line. This is the long-term payoff that one round cannot show.`,
    },
    {
      player: "ADAEZE NWOSU",
      title: "THE PRACTICE STREAK BECAME A BREAKOUT",
      stat: `${reps("ath_adaeze", "2025-11-01")} REPS SINCE NOV // ${signed(athlete("ath_adaeze").clutch_score - scoreAt("ath_adaeze", "2025-11-01"))} CF`,
      body: `Adaeze sharply increased her training after November and finished at ${athlete("ath_adaeze").clutch_score}, an Elite score. She missed this individual moment, but her season is one of the dataset’s clearest stories: one result stayed noisy while the sustained habit transformed the larger arc.`,
    },
    {
      player: "GABBY ASHFORD",
      title: "THE SCORE HID THE DIRECTION",
      stat: `${athlete("ath_gabby").clutch_score} CF NOW // ${signed(growth("ath_gabby"))} OVER 18 MONTHS`,
      body: `Gabby still has one of the lowest current scores, but her history is moving quickly. Then she delivers against players with stronger snapshots. Her planted story is simple: current level says where you are; trajectory says where you may be going.`,
    },
    {
      player: "MARISOL DUARTE",
      title: "THE LATE BLOOMER CROSSED THE LINE",
      stat: `${signed(growth("ath_marisol"))} CF // ${athlete("ath_marisol").clutch_score} NOW`,
      body: `Marisol’s improvement arrives late rather than steadily. She climbs into the Clutch tier above 750 after spending much of the history below it. She misses this one moment, which reinforces the real story: a season-long breakout is bigger than one result.`,
    },
  ];
  const story = stories[roundIndex] ?? stories[0];
  return <aside className="tyg-long-view"><span>STORY FOUND // {story.player}</span><h3>{story.title}</h3><strong>{story.stat}</strong><p>{story.body}</p></aside>;
}
