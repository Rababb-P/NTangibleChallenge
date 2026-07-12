# The Challenge

NTangible measures the *mental* side of athletic performance — the part the box score misses — and turns it into something athletes, parents, and coaches can actually use. You've got our app and a full season of data for one team.

**Build an interactive way to experience this data.**

That's deliberately open. It could be:

- a new view inside the app (it's a normal Vite + React project),
- a standalone web app or site,
- a notebook that tells a story,
- a game, a simulation, a physical-feeling toy — anything.

Play to your strengths. We picked this challenge because it has room for whatever you're best at — frontend craft, data storytelling, creative coding, product thinking.

## 1. The data

Everything lives in [`data/`](data/) as JSON and CSV: one full season for a 16-athlete fastpitch team — Clutch Factor™ scores with 18 months of history per athlete, NTerpret™ mental profiles with quarterly snapshots, a 12-drill catalog with ~1,800 logged sessions, and a 24-game schedule.

**Start with [`data/DATA.md`](data/DATA.md)** — it explains every file and field, the scales (Clutch Factor is 0–1000 with 750 as "the line"), the join keys, and how to regenerate or remix the season if your idea needs more.

## 2. Scope & rules

- **We want you to use AI.** But own what you ship: if we ask questions — performance tradeoffs, known limitations, why this approach over another — you need to be able to answer them.
- **Fork this repo and start there.** Build inside your fork — extend the app, add a folder for your standalone project, whatever fits. Forks of this private repo stay private.
- **Timebox:** due date is Tuesday July 21st at 12am. Please submit your work before then. Late replies will not be accepted.
- **Any stack, any tools.**

We left the rules very vague on purpose. Show us what your passionate about and what your good at! Have another idea that is not within this scope? Ask us, we are happy to make changes! 

## 3. Submission

1. **Build in your fork** of this repo.
2. **Update the README in your fork** with a description of **what you built, why, and how it works** — plus how to run it (we should get from clone to running in under 5 minutes). A few sentences on "what I'd do next" are welcome too.
3. **Email your fork's GitHub link to [elliot@ntangible.co](mailto:elliot@ntangible.co).**

We'll do a share-out where everyone demos their build.

## 4. Some ideas

You don't need to use any of these. They're here to show the *kind* of thing that gets us excited:

1. **A mental season journey** — one athlete's 18 months as a story, not a line chart. Who's climbing? Who's quietly sliding?
2. **The alignment matrix, reimagined** — the coach app shows a 2×2. What's a version a 16-year-old would actually want to look at?
3. **Do the reps work?** — drill logs meet score history. Is there an athlete whose training streak visibly shows up in her scores?
4. **Pressure games** — 9 games this season were decided by ≤2 runs. How did the team's mental profile relate to how those went?
5. **The scouting card** — generate a beautiful, shareable "mental scouting report" for any athlete.

There are stories deliberately hidden in this dataset. Finding one is worth more than any amount of polish.

## 5. How we'll look at it

| What | What we're asking |
|---|---|
| Creativity | Did you make something we haven't seen before? A standard dashboard is the baseline — surprise us with the form, the framing, or the interaction. |
| Insight | Did you find something in the data that's actually useful — something a coach, parent, or athlete could act on? And does your build make it obvious to them, not just to you? |
| Full implementation | Is this something we could add to our app today? Working end-to-end on the real dataset, runs on the first try, edge cases handled — a finished piece, not a mockup or a half-wired demo. |
| Communication | Can you show and tell it clearly? A README that explains what you built, why, and how it works — and a demo that lands the point in a couple of minutes. |


Questions at any point → [elliot@ntangible.co](mailto:elliot@ntangible.co). We're excited to see what you build.
