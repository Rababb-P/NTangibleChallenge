# Clutch Up

Clutch Up is a retro arcade game built from NTangible's synthetic softball dataset. The player studies pressure-moment signals, predicts which athlete delivered, sees the outcomes, how it relates to their own game and receives a personal mental-training plan.

# Why I made it

As an athlete who grew up playing AAA ball hockey, it was my whole life. I thought about previous games all the time, watched the Leafs play and thought about their roster, and also played sports videogames like NHL and loved making my own team. This game was made to mimic that feeling while focusing on teaching the athlete valuable lessons's on mental performance.


## Run the project

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173`.

## Game flow

1. Enter the arcade and select one of the 16 athletes. (Imagine yourself as them)
2. Play five rounds. Each round compares three athletes who faced the same type of pressure situation in different games.
3. Read the signals and predict who delivered.
4. Lock in the bet to reveal the outcomes and play an animated field replay.
5. Compare the three athletes and read which signals help explain the winner.
6. Unlock a longer-term dataset story about one athlete in that round, that isn't shown with just one moment.
7. Finish with a comparison between the selected athlete and the five round winners, followed by drills for the chosen development area.

## Signals shown

- **Clutch Factor 3-month change:** change in Clutch Factor over approximately the three months before the moment.
- **Reps:** mental-training sessions completed during the 30 days before the moment.
- **Reset pitches:** average pitches needed to recover after a mistake; lower is better.
- **Season batting average:** hits divided by at-bats across the season.
- **Leverage:** the importance of the game situation on a 1–5 scale.

These statistics are treated as signals, not guarantees. The project shows correlations in synthetic data and does not claim that a drill directly causes a hit or adds Clutch Factor points.

## How rounds are generated

The rounds are algorithmic, not hard coded:

1. Group clutch moments by situation.
2. Find groups containing one positive outcome and two negative outcomes from different athletes.
3. Rank the possible trios by total leverage.
4. Prefer five rounds with different winners.
5. Order clearer statistical results before rounds where the signals fail.

The winner explanation is also generated. It checks whether the winner clearly led both other athletes in Clutch Factor trajectory, recent reps, or reset speed. If no signal clearly favored the winner, the game says so.

All pre-bet calculations use only data dated before that athlete's moment, preventing future information from leaking into the prediction.

## Long-term stories

After each round, the game analyzes the full histories of that round's three athletes and creates candidate stories. The rules look for:

- Elite Clutch Factor paired with low alignment.
- Crossing the 750 Clutch threshold.
- A training-frequency increase followed by score growth.
- High total reps paired with long-term score growth.
- A major decline or a dip followed by recovery.
- Rapid recent improvement.
- Pressure-game batting splits.
- High resilience paired with fast reset pitches.
- Large quarterly changes in a mental domain.

Each candidate receives an interest score based on the size and clarity of the pattern. The highest-scoring story from the trio is displayed. Its wording comes from a fixed template and every value is calculated from the current dataset. If no special pattern qualifies, the fallback is the athlete's largest 18-month Clutch Factor change.

## Personal ending

The selected athlete's five NTerpret mental domains are compared with the average of the five athletes who delivered:

- If the selected athlete trails the group, the game chooses the largest gap.
- If the selected athlete beats every group average, the game chooses their lowest personal domain as the next development area.
- The recommended drills come directly from the drill catalog by matching the drill's `axis` to that domain.
- Drill rows expand to show the purpose, steps, duration, and a YouTube link when one exists in the source material.

## Main files

- `app/src/game/PlayerMode.tsx` — screens, game state, cards, results, and training plan.
- `app/src/game/playerRounds.ts` — round-building algorithm, signal comparison, and outcome classification.
- `app/src/game/stats.ts` — batting, Clutch Factor, rep, reset, and profile calculations.
- `app/src/game/SeasonStories.tsx` — long-term story detection, scoring, and templates.
- `app/src/game/PlayScene.tsx` — SVG field and play animations.
- `app/src/game/announcer.ts` — commentary text for each situation and result.
- `app/src/game/speech.ts` — Web Speech API voice and caption timing.
- `app/src/game/game.css` — arcade styling and animations.
- `data/` — the canonical synthetic season.

## Data used

The game reads directly from:

- `athletes.json`
- `games.json`
- `game_log.json`
- `moments.json`
- `clutch_history.json`
- `nterpret.json`
- `drills.json`
- `drill_log.json`

See [`data/DATA.md`](data/DATA.md) for the complete data dictionary.

## Limitations

- All athletes, games, and results are synthetic.
- Correlation does not establish causation.
- One pressure moment is noisy and cannot validate a training method by itself.
- Story templates use fixed wording so they remain explainable; the game does not use an LLM to write them.

## Expansions

1. Use ElevenLabs to get a more exciting announcer. I used the Web Speech API to read the text, but ElevenLabs has much better voices. Unfortunately, to avoid rate limiting/costs and to allow anyone to clone this repo and try this out, I didn't go the ELevenLabs route.

2. Have more reasoning involved in player recommendations. For each round, the suggestions are fairly static and restricted to a limited number of statistics. With an LLM API, we could
