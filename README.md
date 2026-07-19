# Trust Your Gut? — my challenge submission

**A retro-arcade with two games built on the season's pressure moments** — one for coaches, one for the athletes themselves. Everything on screen is computed live from [`data/`](data/); only the story captions are authored.

## Run it

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173 and click **🕹 GAME** in the pill at the bottom — or go straight to http://localhost:5173/#game. (The original three-persona app is untouched; the arcade is a fourth view alongside it.)

## The two modes

**COACH MODE — bet the box score against the mental data.** Five real high-leverage moments from the 9 games decided by ≤2 runs. You pick who you'd want at the plate using only traditional stat lines; the cards flip to the mental side (Clutch Factor™, tight-game vs. blowout splits, reset speed) and you see who actually delivered. The gut isn't dumb — it wins round 3 — but the box score is *incomplete*: the team's .371 hitter fades in tight games while a .290 hitter becomes the best on the roster exactly then. The end screen shows receipts computed over **all** delivered high-leverage moments: best season average calls it 2/11, best pressure-game average 4/11, highest Clutch Factor 5/11 — vs. a ~33% coin-flip baseline.

**PLAYER MODE — read the signals, then build your game.** You pick which of the 16 athletes YOU are (retro character select, each athlete's own color from the dataset). Then five trio rounds: three teammates each faced the *same kind* of pressure — a full count, a bases-loaded jam, the first at-bat back after a rough game — in their own games, and exactly one delivered. You see signals only (3-month trajectory, drill reps in the prior 30 days, reset speed, her own words — never the raw score), place your bet, and an **8-bit ballpark plays out your athlete's real outcome** (classified from the moment's action text — strikeout, double, error, walk-off). Every reveal ends with a personal takeaway: the winner's habits (rep pace, trajectory, strongest mental domain) side-by-side with *yours*, each stamped MAINTAIN or TRAIN THIS. The finale is **your training plan** — your weakest NTerpret™ domain, the drills that train that exact axis, and the weekly rep pace of the athletes whose scores actually climbed.

**Nothing is hardwired.** Player-mode rounds are built by an algorithm at load: group the clutch-moment log by situation, find every "one delivered, two didn't" trio among distinct athletes, rank by leverage, keep five with distinct winners, and *generate* each round's lesson from whichever signals genuinely separated the winner from the misses (rounds where no signal did are sorted last, as the humbling finale). Regenerate the season with a new seed and you get new rounds, new lessons, new animations — for free.

## The finding underneath player mode

I validated the "do the reps work?" story before building on it, and the honest answer has two levels:

- **Single moments are noisy.** Athletes who delivered in clutch moments had barely more recent training than those who didn't (10.4 vs. 9.4 sessions in the prior 30 days). The game never claims reps buy you a moment — round 3 is deliberately a round where every signal fails.
- **Trajectories are not.** Total drill reps correlate with 18-month Clutch Factor growth at **r = 0.74**: every athlete with ~175+ logged sessions gained 160–211 points; every athlete under ~30 sessions stayed flat. The crescendo round makes it visible — the *lowest* score on the team, climbing 86 points a quarter behind her reps, delivers while the highest score, standing still, doesn't.

That's the lesson the game teaches and the training plan operationalizes: reps buy the trajectory, and the trajectory is what keeps showing up when the margin gets thin.

## How it works

Small modules in [`app/src/game/`](app/src/game/):

- **`stats.ts`** — imports the season straight from `data/` (no copies) and computes everything in one pass: batting lines, pressure vs. blowout splits (`game_log` × `games.pressure`), reset speeds (`moments`), as-of-date Clutch Factor and 3-month trends (`clutch_history`), rep habits (`drill_log`), weakest NTerpret domain + matching drills (`nterpret` + `drills`), and the "growers" cohort that anchors the training-plan pace. As-of-date functions mean no round peeks at the future.
- **`playerRounds.ts`** — the algorithmic round builder (situation grouping → trio search → leverage ranking → generated lessons), the action-text → animation classifier, and the personalized takeaway generator. **`rounds.ts`** — coach mode's featured moments; candidates and data picks are computed.
- **`PlayScene.tsx`** — the 8-bit ballpark: pure SVG rects + CSS `steps()` keyframes, no libraries. Idle diamond with the situation's runners on base; on lock-in it plays the classified outcome and flashes the call.
- **`Arcade.tsx`**, **`CoachMode.tsx`**, **`PlayerMode.tsx`**, **`game.css`** — the shell and the two games, sharing one retro skin (pixel font, CRT scanlines, card-flip reveals). Wired into the app via a `#game` hash route in `App.tsx`.

## What I'd do next

- Pull `journals.json` into the reveals — the athletes *tell you* about these moments in their own voice, and mood tracks the numbers.
- Extend the algorithmic builder to coach mode too (its candidates and receipts are computed, but its five featured moments are still hand-picked for narrative).
- Export the training plan as a shareable "mental scouting card" image.
- Sound: a little chiptune sting on the outcome flash.

---

# HOWie Viz Challenge (original kit README)

Welcome to the NTangible intern challenge. This repo contains a fully working copy of **HOWie** — our mental-performance app for youth sports — running entirely on a bundled synthetic season of data, plus that same season as plain JSON/CSV files for you to build with.

**Your mission is in [CHALLENGE.md](CHALLENGE.md).** Short version: build an interactive way to experience this data. Any stack.

## Run the app (60 seconds)

```bash
git clone https://github.com/Elliot-Sones/howie-viz-challenge.git
cd howie-viz-challenge/app
npm install
npm run dev
```

Open http://localhost:5173. Use the pill at the bottom of the page to switch between the **Athlete**, **Parent**, and **Coach** experiences — same product, three audiences.

> Howie (the in-app chat) answers with canned lines in this kit; the live product wires it to a real model.

## The data

Everything the app shows — and a lot more depth than it shows — lives in [`data/`](data/):

| File | What it is |
|---|---|
| `team.json` | The team: Alliance Fastpitch — Thunder 16U, 2025–26 season |
| `athletes.json` | 16 athletes: position, tier, current Clutch Factor (0–1000), alignment (0–100), plus bios — hometown, class, quote, fun fact, and a color each athlete owns |
| `clutch_history.json` / `.csv` | 18 months of Clutch Factor per athlete (the app only shows 3 points!) |
| `nterpret.json` / `nterpret_history.csv` | Each athlete's 5-domain mental profile + 6 quarterly snapshots |
| `drills.json` | The 12-drill mental training catalog |
| `drill_log.json` / `.csv` | ~1,800 real-ish drill completions across the season |
| `games.json` / `.csv` | The 24-game season: results, margins, pressure games |
| `game_log.json` / `.csv` | Per-athlete stat lines for every game — where the mental data meets the field |
| `moments.json` / `.csv` | The clutch-moments log: situation, action, outcome, and how fast she reset |
| `journals.json` / `.csv` | Six season journal entries per athlete, in her own voice |
| `guides.json` | The in-app education library |

Full field-by-field dictionary: [`data/DATA.md`](data/DATA.md).

**Python:**

```python
import pandas as pd
log = pd.read_csv("data/drill_log.csv", parse_dates=["date"])
hist = pd.read_csv("data/clutch_history.csv", parse_dates=["date"])
```

**JavaScript:**

```js
const athletes = await (await fetch("./data/athletes.json")).json();
```

Want a different season? The whole dataset is generated: edit the roster or story arcs in `scripts/generate-data.mjs` and re-run it (`node scripts/generate-data.mjs`). It's deterministic — same inputs, same season.

## Repo map

```
app/        The HOWie app (Vite + React + TS) — your reference for the product and its look
data/       The season, in analysis-friendly JSON + CSV — your raw material
scripts/    Data generator + validator
CHALLENGE.md  Your mission
```

The app is your reference. The data is your canvas.

## A note on the data & this repo

**Everything here is mock data.** Every athlete, score, game, and name is synthetic — generated for this challenge. No real athlete data is included anywhere.

This kit exists for the NTangible intern challenge. The HOWie name, product design, and brand assets remain NTangible's — please don't reuse them outside the challenge.
