#!/usr/bin/env node
// Validates the generated dataset: shape, ranges, referential integrity,
// CSV/JSON row parity, and the presence of the authored story beats.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const j = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const csvRows = (p) => readFileSync(join(root, p), "utf8").trim().split("\n").length - 1;

const need = [
  "data/team.json", "data/athletes.json", "data/clutch_history.json", "data/nterpret.json",
  "data/drills.json", "data/drill_log.json", "data/games.json", "data/guides.json",
  "data/athletes.csv", "data/clutch_history.csv", "data/nterpret_history.csv",
  "data/drill_log.csv", "data/games.csv", "app/src/data/dataset.json",
];
for (const p of need) if (!existsSync(join(root, p))) fail(`missing ${p}`);
if (process.exitCode) process.exit(1);

const athletes = j("data/athletes.json"), hist = j("data/clutch_history.json"),
  nterp = j("data/nterpret.json"), drills = j("data/drills.json"),
  log = j("data/drill_log.json"), games = j("data/games.json"),
  guides = j("data/guides.json"), bundle = j("app/src/data/dataset.json");

const ids = new Set(athletes.map((a) => a.id));
const drillIds = new Set(drills.map((d) => d.id));
const DOMAINS = ["composure", "focus", "resilience", "confidence", "drive"];

if (athletes.length !== 16) fail(`athletes: ${athletes.length} != 16`);
for (const a of athletes) {
  if (a.clutch_score < 0 || a.clutch_score > 1000) fail(`${a.id} clutch out of range`);
  if (a.alignment < 0 || a.alignment > 100) fail(`${a.id} alignment out of range`);
  if (!a.tier) fail(`${a.id} missing tier`);
}
for (const [aid, pts] of Object.entries(hist)) {
  if (!ids.has(aid)) fail(`clutch_history unknown athlete ${aid}`);
  if (pts.length !== 18) fail(`${aid} history ${pts.length} != 18`);
  const last = pts[pts.length - 1];
  const cur = athletes.find((a) => a.id === aid).clutch_score;
  if (last.score !== cur) fail(`${aid} last history pt ${last.score} != current ${cur}`);
  for (const p of pts) if (p.score < 0 || p.score > 1000) fail(`${aid} pt out of range`);
}
if (Object.keys(hist).length !== 16) fail("clutch_history must cover all 16");
for (const [aid, n] of Object.entries(nterp)) {
  if (!ids.has(aid)) fail(`nterpret unknown ${aid}`);
  if (n.current.domains.length !== 5) fail(`${aid} domains != 5`);
  for (const d of n.current.domains) {
    if (!DOMAINS.includes(d.key)) fail(`${aid} bad domain ${d.key}`);
    if (d.score < 0 || d.score > 100) fail(`${aid} domain score range`);
  }
  if (n.quarters.length !== 6) fail(`${aid} quarters ${n.quarters.length} != 6`);
}
if (drills.length !== 12) fail(`drills ${drills.length} != 12`);
for (const e of log) {
  if (!ids.has(e.athlete_id)) fail(`drill_log unknown athlete ${e.athlete_id}`);
  if (!drillIds.has(e.drill_id)) fail(`drill_log unknown drill ${e.drill_id}`);
}
if (log.length < 1200 || log.length > 3000) fail(`drill_log size ${log.length} outside 1200-3000`);
if (games.length !== 24) fail(`games ${games.length} != 24`);
const wins = games.filter((g) => g.result === "W").length;
if (wins !== 15) fail(`wins ${wins} != 15`);
for (const g of games) {
  if (g.margin !== Math.abs(g.team_runs - g.opp_runs)) fail(`${g.game_id} margin mismatch`);
  if (g.pressure !== (g.margin <= 2)) fail(`${g.game_id} pressure flag mismatch`);
}
if (guides.length !== 6) fail(`guides ${guides.length} != 6`);

// CSV parity
const parity = [["data/athletes.csv", athletes.length], ["data/clutch_history.csv", 16 * 18],
  ["data/nterpret_history.csv", 16 * 6 * 5], ["data/drill_log.csv", log.length], ["data/games.csv", 24]];
for (const [p, n] of parity) { const r = csvRows(p); if (r !== n) fail(`${p} rows ${r} != ${n}`); }

// Story beats
const adaeze = log.filter((e) => e.athlete_id === "ath_adaeze" && e.date >= "2025-11-01").length;
const adaezeBefore = log.filter((e) => e.athlete_id === "ath_adaeze" && e.date < "2025-11-01").length;
if (adaeze / 8 <= adaezeBefore / 4) fail("Adaeze streak ramp missing");
const lenaLate = log.filter((e) => e.athlete_id === "ath_lena" && e.date >= "2025-11-01").length;
if (lenaLate > 6) fail(`Lena should nearly stop drilling after Oct'25 (got ${lenaLate})`);
const feb = games.filter((g) => g.date.startsWith("2026-02") && g.result === "L" && g.margin >= 6);
if (feb.length < 3) fail("Feb'26 blowout-loss stretch missing");
const dani = athletes.find((a) => a.id === "ath_dani");
if (!(dani.clutch_score >= 900 && dani.alignment < 60)) fail("Dani hc_la outlier missing");

// Bundle sanity
if (bundle.athletes.length !== 16) fail("bundle athletes != 16");
if (!bundle.clutch["ath_harper"] || bundle.clutch["ath_harper"].history.length !== 3)
  fail("bundle clutch history must be 3 points (app shape)");
if (bundle.seed !== 20260712) fail("bundle seed mismatch");

console.log(process.exitCode ? "DATA INVALID" : `OK: 16 athletes, ${log.length} drill events, 24 games, all invariants hold`);
