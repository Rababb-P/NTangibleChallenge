# HOWie Viz Challenge

Welcome to the NTangible intern challenge. This repo contains a fully working copy of **HOWie** — our mental-performance app for youth sports — running entirely on a bundled synthetic season of data, plus that same season as plain JSON/CSV files for you to build with.

**Your mission is in [CHALLENGE.md](CHALLENGE.md).** Short version: build an interactive way to experience this data. Any stack.

## Run the app (60 seconds)

First, **fork this repo** (button top-right) — your fork is where you'll build. Then:

```bash
git clone <your-fork-url>
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
| `athletes.json` | 16 athletes: position, tier, current Clutch Factor (0–1000), alignment (0–100) |
| `clutch_history.json` / `.csv` | 18 months of Clutch Factor per athlete (the app only shows 3 points!) |
| `nterpret.json` / `nterpret_history.csv` | Each athlete's 5-domain mental profile + 6 quarterly snapshots |
| `drills.json` | The 12-drill mental training catalog |
| `drill_log.json` / `.csv` | ~1,800 real-ish drill completions across the season |
| `games.json` / `.csv` | The 24-game season: results, margins, pressure games |
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

Every athlete, score, game, and name in this kit is **synthetic** — generated for this challenge. No real athlete data is included anywhere.

This kit is shared for the NTangible intern challenge — please don't redistribute the code, data, or brand assets.
