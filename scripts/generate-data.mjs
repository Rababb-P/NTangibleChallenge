#!/usr/bin/env node
// Generates the full synthetic season for Alliance Fastpitch — Thunder 16U.
// Deterministic (seeded PRNG, fixed tables): re-running always produces the
// same bytes. Edit the roster/arcs below — or use the knobs — to remix.
//
//   node scripts/generate-data.mjs                 # the default season
//   node scripts/generate-data.mjs --seed 7        # same shape, new jitter
//   node scripts/generate-data.mjs --athletes 32   # add procedural athletes
//   node scripts/generate-data.mjs --games 40      # extend the schedule
//
// Writes: data/*.json + data/*.csv (full-depth, analysis-friendly)
//         app/src/data/dataset.json (the same season, bundled for the app)
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Knobs ──
const argv = process.argv.slice(2);
const knob = (name, def, lo, hi) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || !argv[i + 1]) return def;
  const v = parseInt(argv[i + 1], 10);
  if (Number.isNaN(v)) return def;
  return Math.max(lo, Math.min(hi, v));
};
const SEED = knob("seed", 20260712, 1, 2 ** 31);
const N_ATHLETES = knob("athletes", 16, 16, 64);
const N_GAMES = knob("games", 24, 24, 60);
const GENERATED_AT = "2026-07-12"; // fixed so output is byte-stable

// ── PRNG (mulberry32) ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);        // original season stream (do not reorder)
const rng2 = mulberry32(SEED + 1);   // game log / moments / journals stream
const rng3 = mulberry32(SEED + 2);   // knob-driven extras stream
const jitter = (amp) => Math.round((rng() * 2 - 1) * amp);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

// ── Tiers (mirrors backend mock exactly) ──
function tierFor(score) {
  if (score >= 900) return ["Elite", "Elite clutch", "Top tier — performs under the highest pressure."];
  if (score >= 750) return ["Clutch", "Clutch", "Above the line — reliably rises in big moments."];
  if (score >= 500) return ["Rising", "Rising", "Developing — strong in spots, building consistency."];
  return ["Developing", "Developing", "Early — lots of upside to train into."];
}

// ── The roster (id, name, pos, jersey, current score, alignment, arc, dedication, [c,f,r,cf,d]) ──
const ROSTER = [
  ["ath_harper", "Harper Vance", "P", 21, 828, 74, "climber", "high", [84, 78, 66, 81, 88]],
  ["ath_dani", "Dani Okafor", "C", 7, 918, 38, "star_flat", "high", [88, 58, 74, 90, 91]],
  ["ath_reese", "Reese Calloway", "SS", 2, 720, 66, "dip_recover", "med", [72, 70, 61, 68, 74]],
  ["ath_marisol", "Marisol Duarte", "CF", 11, 781, 81, "late_bloomer", "high", [80, 83, 72, 74, 77]],
  ["ath_tati", "Tatiana Brooks", "1B", 24, 793, 71, "plateau", "low", [81, 76, 70, 78, 72]],
  ["ath_kenzie", "Kenzie Moraes", "2B", 5, 596, 52, "volatile", "med", [55, 62, 48, 59, 71]],
  ["ath_priya", "Priya Raman", "3B", 14, 764, 88, "climber", "high", [78, 81, 69, 73, 75]],
  ["ath_sophia", "Sophia Lindqvist", "LF", 9, 573, 45, "plateau", "low", [58, 54, 60, 57, 52]],
  ["ath_ella", "Ella Whitfield", "RF", 3, 705, 63, "dip_recover", "med", [70, 66, 73, 64, 69]],
  ["ath_noa", "Noa Barros", "P", 17, 662, 77, "late_bloomer", "high", [67, 71, 58, 62, 73]],
  ["ath_gabby", "Gabby Ashford", "UT", 8, 488, 31, "volatile", "low", [45, 52, 40, 49, 63]],
  ["ath_mika", "Mika Tanaka", "C", 12, 641, 69, "climber", "med", [66, 60, 57, 63, 70]],
  ["ath_zoe", "Zoe Ferreira", "DP", 29, 452, 58, "plateau", "low", [48, 45, 52, 44, 50]],
  ["ath_adaeze", "Adaeze Nwosu", "CF", 6, 902, 92, "streak_star", "high", [86, 88, 90, 84, 89]],
  ["ath_lena", "Lena Kovac", "SS", 4, 470, 64, "decline", "low", [52, 47, 38, 42, 58]],
  ["ath_rowan", "Rowan McAllister", "P", 19, 755, 47, "volatile", "med", [74, 61, 66, 70, 79]],
];

// ── Bios (hand-authored; procedural for knob-added extras) ──
const BIOS = {
  ath_harper: ["Chandler, AZ", 2027, "R", "R", "The circle is quiet if you get there first.", "Throws four pitches; fully trusts two.", "#C84B31"],
  ath_dani: ["Fresno, CA", 2027, "L", "R", "Frame it, don't fight it.", "Has called her own game since 12U.", "#1F6F8B"],
  ath_reese: ["Boise, ID", 2028, "R", "R", "Feet first, glove follows.", "Hasn't missed a morning ground-ball drill since March.", "#4A7856"],
  ath_marisol: ["El Paso, TX", 2027, "L", "L", "I time the gap, not the pitcher.", "Leads the team in grass stains, and it isn't close.", "#B8860B"],
  ath_tati: ["Peoria, IL", 2027, "R", "R", "Slow heartbeat, fast hands.", "Does homework in the dugout between games.", "#6B4E9B"],
  ath_kenzie: ["Overland Park, KS", 2028, "S", "R", "Switch-hitting is just options.", "Learned to switch-hit off a garage tee in one winter.", "#D96C4F"],
  ath_priya: ["Fremont, CA", 2027, "R", "R", "Third base is a conversation.", "Charts opposing hitters for fun.", "#2E7D6B"],
  ath_sophia: ["Duluth, MN", 2028, "L", "R", "Left field has the best sunsets.", "Keeps a paper scorebook nobody asked for.", "#8A6FA8"],
  ath_ella: ["Savannah, GA", 2028, "R", "R", "The wall is a suggestion.", "Has robbed three home runs this season.", "#C0554E"],
  ath_noa: ["Providence, RI", 2028, "R", "R", "Spin wins.", "Grip experiments have their own notebook.", "#3B6EA5"],
  ath_gabby: ["Reno, NV", 2028, "S", "R", "Wherever coach points, I play.", "Has started at six positions this season.", "#7A8B3F"],
  ath_mika: ["Tacoma, WA", 2028, "R", "R", "Catch first, talk later.", "Blocks rise balls for fun; asks for more.", "#A85C7A"],
  ath_zoe: ["Baton Rouge, LA", 2028, "L", "R", "Designated pressure.", "Walk-up song has changed nine times this season.", "#556B2F"],
  ath_adaeze: ["Columbus, OH", 2027, "R", "R", "Reps don't lie.", "First to practice 41 days straight and counting.", "#B22C4F"],
  ath_lena: ["Pittsburgh, PA", 2027, "R", "R", "Short memory, long season.", "Taught half the team their pregame handshake.", "#5F7470"],
  ath_rowan: ["Asheville, NC", 2028, "L", "L", "The change-up changes everything.", "Pitches faster when her socks don't match.", "#38689E"],
};

// ── Knob-added procedural athletes (rng3 only — defaults touch nothing) ──
const EXTRA_FIRST = ["Avery", "Sky", "Jaylen", "Renata", "Camille", "Bree", "Isla", "Marley", "Tessa", "Yuki", "Dana", "Frankie", "Noor", "Paige", "Simone", "Wren"];
const EXTRA_LAST = ["Alvarez", "Kim", "Osei", "Petrov", "Nakamura", "Silva", "Hughes", "Marsh", "Ito", "Delgado", "Byrne", "Okoye", "Larsen", "Quinn", "Sato", "Vega"];
const EXTRA_TOWNS = ["Mesa, AZ", "Aurora, CO", "Katy, TX", "Naperville, IL", "Cary, NC", "Bellevue, WA", "Chesapeake, VA", "Norman, OK"];
const EXTRA_QUOTES = ["Play loud, think quiet.", "One pitch at a time.", "Earn the last inning.", "Glove work is homework.", "Pressure is a privilege.", "See ball, be ball."];
const EXTRA_FACTS = ["Team's unofficial DJ.", "Collects dirt from every field she plays.", "Runs the team group chat.", "Fastest home-to-first on the roster.", "Braids the whole infield's hair on game day.", "Has never lost a bunting contest."];
const ARCS = ["climber", "plateau", "volatile", "dip_recover", "late_bloomer"];
const DEDS = ["high", "med", "low"];
const POSITIONS = ["UT", "OF", "IF", "C", "1B", "2B", "3B", "SS", "LF", "RF"];
for (let i = 16; i < N_ATHLETES; i++) {
  const k = i - 16;
  const name = `${EXTRA_FIRST[k % EXTRA_FIRST.length]} ${EXTRA_LAST[(k + Math.floor(k / EXTRA_LAST.length)) % EXTRA_LAST.length]}`;
  const id = `ath_x${String(k + 1).padStart(2, "0")}`;
  const current = clamp(440 + rng3() * 470, 0, 1000);
  const align = clamp(25 + rng3() * 65, 0, 100);
  const domBase = Array.from({ length: 5 }, () => clamp(current / 10 + (rng3() * 2 - 1) * 12, 20, 98));
  ROSTER.push([id, name, POSITIONS[k % POSITIONS.length], 30 + k, current, align, ARCS[k % ARCS.length], DEDS[k % DEDS.length], domBase]);
  BIOS[id] = [
    EXTRA_TOWNS[k % EXTRA_TOWNS.length], k % 2 ? 2028 : 2027,
    ["R", "L", "S"][k % 3], ["R", "L"][k % 2],
    EXTRA_QUOTES[k % EXTRA_QUOTES.length], EXTRA_FACTS[k % EXTRA_FACTS.length],
    ["#C84B31", "#1F6F8B", "#4A7856", "#B8860B", "#6B4E9B", "#D96C4F", "#2E7D6B", "#8A6FA8"][k % 8],
  ];
}

const DOMAINS = [
  ["composure", "Composure", "How steady you stay when the moment gets big."],
  ["focus", "Focus", "How well you lock in pitch to pitch."],
  ["resilience", "Resilience", "How fast you bounce back after a mistake."],
  ["confidence", "Confidence", "How much you trust your game in big counts."],
  ["drive", "Competitive Drive", "How much you want the ball when it matters."],
];
const STRENGTH_PHRASE = {
  composure: "Composure under pressure", focus: "Pitch-to-pitch focus",
  resilience: "Quick resets after mistakes", confidence: "Confidence in clutch counts",
  drive: "Competitive drive",
};
const GROWTH_PHRASE = {
  composure: "Staying settled in big innings", focus: "Sustaining focus between innings",
  resilience: "Faster reset after mistakes", confidence: "Trusting the swing in must-hit counts",
  drive: "Channeling intensity into routine",
};

// ── 18 monthly Clutch Factor points: 2025-01-01 … 2026-06-01 ──
const MONTHS = [];
for (let y = 2025, m = 1, i = 0; i < 18; i++) {
  MONTHS.push(`${y}-${String(m).padStart(2, "0")}-01`);
  if (++m > 12) { m = 1; y++; }
}
function series(arc, current, dedication) {
  const n = 18, out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let v;
    if (arc === "climber") v = current - 180 + 180 * t;
    else if (arc === "star_flat") v = current - 25 + 25 * t;
    else if (arc === "dip_recover") {
      v = current - 120 + 120 * t;
      if (i === 12) v -= 60;
      if (i === 13) v -= 90;
      if (i === 14) v -= 40;
    } else if (arc === "late_bloomer") v = i < 8 ? current - 200 : current - 200 + (200 * (i - 8)) / 9;
    else if (arc === "plateau") v = current;
    else if (arc === "volatile") v = current - 40 + (i % 2 === 0 ? -60 : 60) * (0.4 + 0.6 * rng());
    else if (arc === "streak_star") v = i < 10 ? current - 170 : current - 170 + (170 * (i - 10)) / 7;
    else if (arc === "decline") v = i <= 8 ? 470 + 250 * (i / 8) : 720 - 28 * (i - 8);
    else v = current;
    if (i === 13) v -= dedication === "high" ? 5 : 20; // Feb '26 team dip
    out.push(clamp(v + jitter(12), 0, 1000));
  }
  out[n - 1] = current; // pin the present
  return MONTHS.map((date, i) => ({ date, score: out[i] }));
}

// ── NTerpret: current profile + 6 quarterly snapshots ──
const QUARTERS = ["2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2"];
function nterpretFor(domBase, arc) {
  const trend = arc === "climber" || arc === "late_bloomer" || arc === "streak_star" ? 3
    : arc === "decline" ? -4 : 1;
  const quarters = QUARTERS.map((quarter, qi) => ({
    quarter,
    domains: DOMAINS.map(([key], di) => ({
      key,
      score: qi === 5 ? domBase[di]
        : clamp(domBase[di] - (5 - qi) * trend + (arc === "dip_recover" && qi === 4 ? -6 : 0) + jitter(2), 0, 100),
    })),
  }));
  const ranked = DOMAINS.map(([key], di) => [key, domBase[di]]).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 2).map(([k]) => k), bottom = ranked.slice(-2).map(([k]) => k).reverse();
  const current = {
    headline: "How you process the game",
    summary: `${STRENGTH_PHRASE[top[0]]} is the edge; the growth lever is ${GROWTH_PHRASE[bottom[0]].toLowerCase()}.`,
    domains: DOMAINS.map(([key, name, summary], di) => ({ key, name, score: domBase[di], summary })),
    strengths: top.map((k) => STRENGTH_PHRASE[k]),
    growth_areas: bottom.map((k) => GROWTH_PHRASE[k]),
  };
  return { current, quarters };
}

// ── Drills (first four verbatim from the product's mock fixtures) ──
const DRILLS = [
  { id: "drill_reset", title: "10-Second Reset", axis: "resilience", duration_min: 3,
    description: "Train your edge: a between-pitch routine to clear the last play.",
    steps: ["Step off", "One breath in for 4, out for 6", "Tap the bat, cue word", "Re-enter the box"] },
  { id: "drill_box_breath", title: "Box Breathing", axis: "composure", duration_min: 4, video_url: "https://youtu.be/tEmt1Znux58",
    description: "Lower arousal before high-leverage at-bats.", steps: ["In 4", "Hold 4", "Out 4", "Hold 4 (x4)"] },
  { id: "drill_anchor", title: "Anchor Routine", axis: "focus", duration_min: 5, video_url: "https://youtu.be/QliFmb9QFbA",
    description: "Tie focus to a physical cue so it returns on demand.", steps: [] },
  { id: "drill_self_talk", title: "Clutch Self-Talk", axis: "confidence", duration_min: 3, video_url: "https://youtu.be/Qc7q9L_NRlU",
    description: "Rehearse must-hit-count cue phrases.", steps: [] },
  { id: "drill_visualize", title: "First-Pitch Visualization", axis: "focus", duration_min: 4,
    description: "See the first pitch before it happens so the moment feels familiar.",
    steps: ["Close your eyes", "Run the first pitch three ways", "Pick your response to each", "Open and play it"] },
  { id: "drill_pressure_ladder", title: "Pressure Ladder", axis: "composure", duration_min: 6,
    description: "Practice the same rep while imagining rising stakes, rung by rung.",
    steps: ["Rep at practice stakes", "Rep at game stakes", "Rep at championship stakes", "Note what changed"] },
  { id: "drill_flush", title: "Flush the Inning", axis: "resilience", duration_min: 3,
    description: "A dugout ritual that ends the last inning so the next one starts clean.",
    steps: ["Name the mistake out loud", "One physical flush cue", "State the next job"] },
  { id: "drill_win_log", title: "Wins Log", axis: "confidence", duration_min: 5,
    description: "Bank three concrete wins from today you can withdraw under pressure.",
    steps: ["Write three wins", "Say why each was yours", "Read the log before games"] },
  { id: "drill_fire_up", title: "Ignition Routine", axis: "drive", duration_min: 3,
    description: "A repeatable spark for flat days: get to your competitive temperature on demand.",
    steps: ["Pick your song or phrase", "30 seconds of full intensity", "Lock eyes on one target"] },
  { id: "drill_scout_self", title: "Scout Yourself", axis: "drive", duration_min: 6,
    description: "Write the scouting report an opponent would make on your mental game.",
    steps: ["List what pressure does to you", "List what you do to pressure", "Circle one thing to move"] },
  { id: "drill_breath_reset", title: "Two-Breath Reset", axis: "composure", duration_min: 2,
    description: "The fastest legal reset in the game: two breaths between pitches.",
    steps: ["Long exhale", "Slow inhale", "Eyes to target"] },
  { id: "drill_target_lock", title: "Target Lock", axis: "focus", duration_min: 4,
    description: "Narrow your eyes to one seam, one spot, one job.",
    steps: ["Soft eyes wide", "Hard eyes on the target", "Hold three seconds", "Release into the play"] },
];

// ── Drill log: weekly sessions Jul '25 – Jun '26 ──
function isoAddDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
const WEEKS = [];
for (let w = 0, d = "2025-06-30"; w < 52; w++, d = isoAddDays(d, 7)) WEEKS.push(d);

function sessionsPerWeek(a, weekStart) {
  const [id, , , , , , , dedication] = a;
  if (id === "ath_adaeze" && weekStart >= "2025-11-01") return 5;
  if (id === "ath_lena" && weekStart >= "2025-11-01") return 0; // handled separately
  if (dedication === "high") return 3 + (rng() < 0.5 ? 1 : 0);
  if (dedication === "med") return 2;
  return rng() < 0.55 ? 1 : 0;
}
const drillLog = [];
for (const a of ROSTER) {
  const [id, , , , , , , , domBase] = a;
  const ranked = DOMAINS.map(([key], di) => [key, domBase[di]]).sort((x, y) => x[1] - y[1]);
  const weakest = [ranked[0][0], ranked[1][0]];
  for (const week of WEEKS) {
    const n = sessionsPerWeek(a, week);
    for (let s = 0; s < n; s++) {
      const pool = rng() < 0.6 ? DRILLS.filter((d) => weakest.includes(d.axis)) : DRILLS;
      const drill = pool[Math.floor(rng() * pool.length)];
      drillLog.push({ athlete_id: id, drill_id: drill.id, date: isoAddDays(week, Math.floor(rng() * 7)), duration_min: drill.duration_min });
    }
  }
}
// Lena "nearly stops": exactly four late-season sessions, spread out.
for (const week of [WEEKS[24], WEEKS[32], WEEKS[40], WEEKS[48]]) {
  drillLog.push({ athlete_id: "ath_lena", drill_id: "drill_reset", date: isoAddDays(week, 2), duration_min: 3 });
}
drillLog.sort((a, b) => a.date.localeCompare(b.date) || a.athlete_id.localeCompare(b.athlete_id) || a.drill_id.localeCompare(b.drill_id));

// ── Games: hand-balanced 24-game season (15–9; Feb blowouts; 9 pressure games, 6–3) ──
const OPPONENTS = ["Valley Storm 16U", "Metro Breakers", "Coastal Edge", "Ridgeline Riptide", "Summit Select", "Ironwood Elite", "Bluegrass Bandits", "Desert Sunhawks"];
const GAME_ROWS = [
  ["2025-08-16", "Valley Storm 16U", "H", 5, 3], ["2025-08-23", "Metro Breakers", "A", 2, 7],
  ["2025-09-06", "Coastal Edge", "H", 4, 3], ["2025-09-13", "Ridgeline Riptide", "A", 2, 4],
  ["2025-09-27", "Summit Select", "H", 6, 1], ["2025-10-04", "Ironwood Elite", "A", 8, 4],
  ["2025-10-11", "Bluegrass Bandits", "H", 3, 2], ["2025-10-25", "Desert Sunhawks", "A", 1, 5],
  ["2025-11-08", "Valley Storm 16U", "A", 9, 6], ["2025-11-15", "Metro Breakers", "H", 5, 4],
  ["2025-12-06", "Coastal Edge", "A", 6, 3], ["2025-12-13", "Summit Select", "A", 3, 5],
  ["2026-01-10", "Ridgeline Riptide", "H", 7, 5], ["2026-01-17", "Ironwood Elite", "H", 2, 3],
  ["2026-01-31", "Bluegrass Bandits", "A", 4, 1], ["2026-02-07", "Desert Sunhawks", "H", 1, 7],
  ["2026-02-14", "Summit Select", "A", 0, 8], ["2026-02-21", "Valley Storm 16U", "A", 2, 9],
  ["2026-03-07", "Metro Breakers", "H", 6, 2], ["2026-03-21", "Coastal Edge", "H", 6, 3],
  ["2026-04-11", "Ridgeline Riptide", "A", 8, 3], ["2026-04-25", "Ironwood Elite", "A", 7, 6],
  ["2026-05-16", "Bluegrass Bandits", "H", 3, 7], ["2026-06-06", "Desert Sunhawks", "H", 10, 2],
];
for (let i = 24, d = "2026-06-13"; i < N_GAMES; i++, d = isoAddDays(d, 7)) {
  let tr = Math.floor(rng3() * 9), or = Math.floor(rng3() * 9);
  if (tr === or) tr += rng3() < 0.6 ? 1 : -1;
  if (tr < 0) tr = 0;
  GAME_ROWS.push([d, OPPONENTS[i % OPPONENTS.length], i % 2 ? "A" : "H", tr, or]);
}
const games = GAME_ROWS.map(([date, opponent, home_away, team_runs, opp_runs], i) => ({
  game_id: `g${String(i + 1).padStart(2, "0")}`, date, opponent, home_away,
  result: team_runs > opp_runs ? "W" : "L", team_runs, opp_runs,
  margin: Math.abs(team_runs - opp_runs), pressure: Math.abs(team_runs - opp_runs) <= 2,
}));

// ── Guides ──
const GUIDES = [
  { id: "g_what", title: "What Clutch Factor measures", summary: "The mental side of performance, as a single trackable score.", video_url: null },
  { id: "g_use", title: "How to use your score", summary: "Turn your number into reps that move it.", video_url: null },
  { id: "g_nil", title: "Recruiting & NIL playbook", summary: "How to present your mental game to college coaches.", video_url: null },
  { id: "g_read_nterpret", title: "Reading your NTerpret", summary: "Turn the five domains into a plan.", video_url: null },
  { id: "g_habit", title: "Building a drill habit", summary: "Small daily reps beat big rare sessions.", video_url: null },
  { id: "g_drive_home", title: "After a tough game", summary: "What to say on the drive home — and what to skip.", video_url: null },
];

// ── Assemble core ──
const team = {
  team_id: "team_thunder_16u", name: "Alliance Fastpitch — Thunder 16U",
  org: "Alliance Fastpitch", season: "2025–26",
  record: `${games.filter((g) => g.result === "W").length}–${games.filter((g) => g.result === "L").length}`,
};
const athletes = ROSTER.map(([id, name, position, jersey, clutch_score, alignment]) => {
  const [hometown, class_of, bats, throws, quote, fun_fact, color] = BIOS[id];
  return {
    id, name, position, jersey, org: team.org, team_id: team.team_id,
    tier: tierFor(clutch_score)[0], clutch_score, alignment, photo_url: null,
    hometown, class_of, bats, throws, quote, fun_fact, color,
  };
});
const byId = Object.fromEntries(ROSTER.map((a) => [a[0], a]));
const dom = (id, key) => byId[id][8][DOMAINS.findIndex(([k]) => k === key)];

const clutchHistory = {}, nterpret = {}, clutchApp = {}, nterpretApp = {};
for (const a of ROSTER) {
  const [id, , , , current, , arc, dedication, domBase] = a;
  const pts = series(arc, current, dedication);
  clutchHistory[id] = pts;
  const [tier, tier_label, tier_meaning] = tierFor(current);
  clutchApp[id] = {
    score: current, tier, tier_label, tier_meaning, threshold: 750, updated_at: "2026-06-01",
    history: [pts[13], pts[15], pts[17]],
    retest: { eligible: false, on_cooldown: true, cycle_label: "You're set for this cycle.", fee: "$29", assessment_url: "https://assess.ntangible.co/clutch-factor" },
  };
  const n = nterpretFor(domBase, arc);
  nterpret[id] = n;
  nterpretApp[id] = n.current;
}

// ═══ Game log: per-athlete stat lines (rng2 stream) ═══
const PITCHERS = ["ath_harper", "ath_noa", "ath_rowan"];
const gameLog = [];
for (let gi = 0; gi < games.length; gi++) {
  const g = games[gi];
  const feb = g.date.startsWith("2026-02");
  const pitcher = PITCHERS[gi % PITCHERS.length];
  // choose two benched (never the day's pitcher, never late-season Adaeze)
  const benchPool = ROSTER.map((a) => a[0]).filter((id) =>
    id !== pitcher && !(id === "ath_adaeze" && g.date >= "2025-11-01"));
  const benched = new Set();
  if (g.date >= "2025-11-01" && rng2() < 0.6) benched.add("ath_lena"); // the quiet slide shows up in playing time
  while (benched.size < 2 + Math.max(0, ROSTER.length - 16)) benched.add(benchPool[Math.floor(rng2() * benchPool.length)]);
  const lines = [];
  for (const a of ROSTER) {
    const [id, , , , clutch, , , dedication] = a;
    if (benched.has(id)) continue;
    const ab = (clutch >= 700 ? 3 : 2) + (rng2() < 0.45 ? 1 : 0);
    let p = 0.26 + 0.0015 * (dom(id, "drive") - 70);
    if (g.pressure) p += 0.005 * (dom(id, "composure") - 72);
    if (feb) p -= dedication === "high" ? 0.02 : 0.06;
    if (id === "ath_adaeze" && g.date >= "2025-12-01") p += 0.07;
    if (id === "ath_lena" && g.date >= "2025-11-01") p -= 0.06;
    p = Math.max(0.05, Math.min(0.6, p));
    let h = 0;
    for (let i = 0; i < ab; i++) if (rng2() < p) h++;
    const hr = h > 0 && rng2() < 0.05 + 0.001 * (dom(id, "drive") - 70) ? 1 : 0;
    const pSo = Math.max(0.08, Math.min(0.5, 0.3 - 0.0035 * (dom(id, "focus") - 70)));
    let so = 0;
    for (let i = 0; i < ab - h; i++) if (rng2() < pSo) so++;
    const bb = rng2() < 0.15 ? 1 : 0;
    const pErr = Math.max(0.01, Math.min(0.2, 0.1 - 0.001 * ((dom(id, "composure") + dom(id, "resilience")) / 2 - 70)));
    const errors = rng2() < pErr ? 1 : 0;
    lines.push({ athlete_id: id, game_id: g.game_id, date: g.date, ab, h, hr, rbi: 0, bb, so, errors, ip: null, er: null, k_pitched: null });
  }
  // guarantee a hit when the team scored
  if (g.team_runs > 0 && lines.every((l) => l.h === 0)) {
    const top = lines.reduce((m, l) => (dom(l.athlete_id, "drive") > dom(m.athlete_id, "drive") ? l : m));
    top.h = 1; top.so = Math.min(top.so, top.ab - 1);
  }
  // distribute RBIs exactly to team_runs among hitters with hits
  const hitters = lines.filter((l) => l.h > 0);
  for (let r = 0; r < g.team_runs && hitters.length; r++) {
    const w = hitters.map((l) => l.h + 0.5 * l.hr);
    let pick = rng2() * w.reduce((s, x) => s + x, 0);
    let idx = 0;
    while (pick > w[idx]) { pick -= w[idx]; idx++; }
    hitters[Math.min(idx, hitters.length - 1)].rbi++;
  }
  // pitching line
  const pl = lines.find((l) => l.athlete_id === pitcher);
  const teamErrors = lines.reduce((s, l) => s + l.errors, 0);
  pl.ip = 7;
  pl.er = Math.max(0, g.opp_runs - (teamErrors > 0 ? 1 : 0));
  pl.k_pitched = clamp(2 + (dom(pitcher, "focus") + dom(pitcher, "drive")) / 20 + rng2() * 3, 1, 12);
  gameLog.push(...lines);
}

// ═══ Clutch moments (rng2 stream) ═══
const SITUATIONS = [
  ["Bases loaded, two out", 5], ["Runner on third, one out, tie game", 4],
  ["Full count, go-ahead run on second", 4], ["Leadoff at-bat after an error the inning before", 3],
  ["First at-bat back after a rough game", 3], ["Two on, nobody out, down by one", 4],
  ["Defensive play with the game on the line", 5], ["At the plate right after a teammate's strikeout", 2],
  ["Pitching with the tying run on third", 5], ["Down 0-2 in the count, runners in scoring position", 3],
];
const POS_ACTIONS = [
  "RBI single up the middle", "Line-drive double into the gap", "Sac fly, run scores",
  "Backhand stop and the throw beats the runner", "Six-pitch walk keeps the inning alive",
  "Takes the extra base on a shallow single",
];
const NEG_ACTIONS = [
  "Strikeout swinging on a rise ball", "Popped up the first pitch",
  "Throwing error lets the run in", "Caught looking with runners on", "Bobbled exchange, everyone safe",
];
const PITCH_POS = "Strikeout looking ends the threat";
const PITCH_NEG = "Wild pitch scores the tying run";
const moments = [];
let mSeq = 0;
for (let gi = 0; gi < games.length; gi++) {
  const g = games[gi];
  const pitcher = PITCHERS[gi % PITCHERS.length];
  const playing = gameLog.filter((l) => l.game_id === g.game_id).map((l) => l.athlete_id);
  const n = g.pressure ? 3 + Math.floor(rng2() * 2) : 1 + Math.floor(rng2() * 2);
  for (let i = 0; i < n; i++) {
    const [situation, leverage] = SITUATIONS[Math.floor(rng2() * SITUATIONS.length)];
    const isPitchMoment = situation.startsWith("Pitching");
    let athlete_id;
    if (isPitchMoment) athlete_id = pitcher;
    else {
      const w = playing.map((id) => dom(id, "drive"));
      let pick = rng2() * w.reduce((s, x) => s + x, 0);
      let idx = 0;
      while (pick > w[idx]) { pick -= w[idx]; idx++; }
      athlete_id = playing[Math.min(idx, playing.length - 1)];
    }
    let pPos = 0.3 + 0.006 * (dom(athlete_id, "composure") - 60);
    if (athlete_id === "ath_adaeze" && g.date >= "2025-12-01") pPos += 0.1;
    if (athlete_id === "ath_lena" && g.date >= "2025-11-01") pPos -= 0.1;
    const positive = rng2() < Math.max(0.12, Math.min(0.88, pPos));
    const action = isPitchMoment ? (positive ? PITCH_POS : PITCH_NEG)
      : (positive ? POS_ACTIONS : NEG_ACTIONS)[Math.floor(rng2() * (positive ? POS_ACTIONS : NEG_ACTIONS).length)];
    const inning = leverage >= 4 ? 5 + Math.floor(rng2() * 3) : 1 + Math.floor(rng2() * 7);
    moments.push({
      moment_id: `m${String(++mSeq).padStart(3, "0")}`, game_id: g.game_id, date: g.date,
      athlete_id, inning: Math.min(7, inning), leverage, situation, action,
      outcome: positive ? "positive" : "negative",
      reset_pitches: clamp(6.5 - dom(athlete_id, "resilience") / 22 + (rng2() * 2 - 1), 1, 6),
    });
  }
  // walk-off for close home wins
  if (g.result === "W" && g.home_away === "H" && g.margin <= 2) {
    const hero = playing.reduce((m, id) => (dom(id, "drive") > dom(m, "drive") ? id : m));
    moments.push({
      moment_id: `m${String(++mSeq).padStart(3, "0")}`, game_id: g.game_id, date: g.date,
      athlete_id: hero, inning: 7, leverage: 5,
      situation: "Bottom of the seventh, winning run on second",
      action: "Walk-off single through the left side", outcome: "positive", reset_pitches: 1,
    });
  }
}

// ═══ Journals (rng2 stream) ═══
const JOURNAL_DATES = ["2025-08-20", "2025-10-15", "2025-12-10", "2026-02-18", "2026-04-12", "2026-06-05"];
const T_UP = [
  "Best stretch I've had all year. {drill} before practice is paying off — {domain} finally feels automatic in big counts.",
  "Coach didn't say anything today, but she didn't have to. The work is showing up in games.",
  "Score's moving and I know exactly why. Keeping the routine exactly the same.",
];
const T_FLAT = [
  "Same routine this week. Nothing clicking, nothing breaking. Just showing up.",
  "Solid week. Not my best, not my worst. {domain} still needs reps and I know it.",
  "Practice, homework, practice. Some weeks the game just stays quiet.",
];
const T_DOWN = [
  "Rough one against {opp}. Replayed the last at-bat the whole ride home. Trying the 24-hour rule.",
  "I know one game isn't the season, but this month feels heavy. Sticking to the plan anyway.",
  "Couldn't find it today. Wrote down one lesson like the guide says, then closed the notebook.",
];
const T_LENA = [
  "Didn't touch the drills this week. It's fine.",
  "Watched more than I played again. Maybe next season looks different.",
  "Everyone keeps asking if I'm okay. I said yes because that's the easy answer.",
];
const T_ADAEZE = [
  "Five sessions this week. Reps don't lie — the number's moving and I can point to exactly why.",
  "First to the field again. The streak matters more to me than the score does, honestly.",
  "Pressure feels smaller lately. Not because the games got smaller — because the work got bigger.",
];
const scoreAt = (id, date) => {
  const pts = clutchHistory[id];
  let last = pts[0].score;
  for (const p of pts) { if (p.date <= date) last = p.score; else break; }
  return last;
};
const journals = [];
for (const a of ROSTER) {
  const [id, , , , , , , dedication, domBase] = a;
  const ranked = DOMAINS.map(([key, name], di) => [name, domBase[di]]).sort((x, y) => x[1] - y[1]);
  for (const date of JOURNAL_DATES) {
    const prev = isoAddDays(date, -90);
    const delta = scoreAt(id, date) - scoreAt(id, prev);
    let mood = delta > 25 ? "up" : delta < -25 ? "down" : "flat";
    if (date.startsWith("2026-02") && dedication !== "high") mood = "down";
    let pool = { up: T_UP, flat: T_FLAT, down: T_DOWN }[mood];
    if (id === "ath_lena" && date >= "2025-11-01") { mood = "down"; pool = T_LENA; }
    if (id === "ath_adaeze" && date >= "2025-12-01") { mood = "up"; pool = T_ADAEZE; }
    const recent = [...games].reverse().find((g) => g.date <= date);
    const weakestDrill = DRILLS.find((d) => d.axis === DOMAINS.find(([, n]) => n === ranked[0][0])?.[0]) ?? DRILLS[0];
    const text = pool[Math.floor(rng2() * pool.length)]
      .replaceAll("{drill}", weakestDrill.title)
      .replaceAll("{domain}", ranked[0][0].toLowerCase())
      .replaceAll("{opp}", recent ? recent.opponent : "the last team");
    journals.push({ athlete_id: id, date, mood, text });
  }
}

// ── Write intern-facing files ──
mkdirSync(join(root, "data"), { recursive: true });
mkdirSync(join(root, "app/src/data"), { recursive: true });
const wj = (p, obj) => { writeFileSync(join(root, p), JSON.stringify(obj, null, 2) + "\n"); console.log(`wrote ${p}`); };
const q = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const wcsv = (p, header, rows) => {
  writeFileSync(join(root, p), [header.join(","), ...rows.map((r) => r.map(q).join(","))].join("\n") + "\n");
  console.log(`wrote ${p}`);
};

wj("data/team.json", team);
wj("data/athletes.json", athletes);
wj("data/clutch_history.json", clutchHistory);
wj("data/nterpret.json", nterpret);
wj("data/drills.json", DRILLS);
wj("data/drill_log.json", drillLog);
wj("data/games.json", games);
wj("data/guides.json", GUIDES);
wj("data/game_log.json", gameLog);
wj("data/moments.json", moments);
wj("data/journals.json", journals);

wcsv("data/athletes.csv",
  ["id", "name", "position", "jersey", "tier", "clutch_score", "alignment", "org", "hometown", "class_of", "bats", "throws", "quote", "fun_fact", "color"],
  athletes.map((a) => [a.id, a.name, a.position, a.jersey, a.tier, a.clutch_score, a.alignment, a.org, a.hometown, a.class_of, a.bats, a.throws, a.quote, a.fun_fact, a.color]));
wcsv("data/clutch_history.csv", ["athlete_id", "date", "score"],
  Object.entries(clutchHistory).flatMap(([id, pts]) => pts.map((p) => [id, p.date, p.score])));
wcsv("data/nterpret_history.csv", ["athlete_id", "quarter", "domain_key", "domain_name", "score"],
  Object.entries(nterpret).flatMap(([id, n]) => n.quarters.flatMap((qt) =>
    qt.domains.map((d) => [id, qt.quarter, d.key, DOMAINS.find(([k]) => k === d.key)[1], d.score]))));
wcsv("data/drill_log.csv", ["athlete_id", "drill_id", "date", "duration_min"],
  drillLog.map((e) => [e.athlete_id, e.drill_id, e.date, e.duration_min]));
wcsv("data/games.csv", ["game_id", "date", "opponent", "home_away", "result", "team_runs", "opp_runs", "margin", "pressure"],
  games.map((g) => [g.game_id, g.date, g.opponent, g.home_away, g.result, g.team_runs, g.opp_runs, g.margin, g.pressure]));
wcsv("data/game_log.csv", ["athlete_id", "game_id", "date", "ab", "h", "hr", "rbi", "bb", "so", "errors", "ip", "er", "k_pitched"],
  gameLog.map((l) => [l.athlete_id, l.game_id, l.date, l.ab, l.h, l.hr, l.rbi, l.bb, l.so, l.errors, l.ip, l.er, l.k_pitched]));
wcsv("data/moments.csv", ["moment_id", "game_id", "date", "athlete_id", "inning", "leverage", "situation", "action", "outcome", "reset_pitches"],
  moments.map((m) => [m.moment_id, m.game_id, m.date, m.athlete_id, m.inning, m.leverage, m.situation, m.action, m.outcome, m.reset_pitches]));
wcsv("data/journals.csv", ["athlete_id", "date", "mood", "text"],
  journals.map((e) => [e.athlete_id, e.date, e.mood, e.text]));

// ── App bundle ──
wj("app/src/data/dataset.json", {
  generated_at: GENERATED_AT, seed: SEED, team, athletes,
  clutch: clutchApp, nterpret: nterpretApp,
  drills: { rep_count: DRILLS.length, drills: DRILLS },
  guides: GUIDES,
});
console.log(`done: ${athletes.length} athletes, ${drillLog.length} drill events, ${games.length} games, ${gameLog.length} stat lines, ${moments.length} moments, ${journals.length} journal entries`);
