// HOWie API client — challenge-kit edition. Same contract as the real client
// (which talks to the live FastAPI BFF), but every call resolves locally from
// the bundled season in ./data/dataset.json. No network, no accounts.
//
// The full-depth dataset (18-month histories, drill log, games) lives in the
// repo's data/ directory — this module only serves what the app screens need.

import DATASET from "./data/dataset.json";
import { localHowieReply } from "./kit/howie-local";

export type Persona = "athlete" | "parent" | "coach";

// ── Kit persona (drives which app the demo session boots into) ──
const PERSONA_KEY = "howie_kit_persona";
export const getKitPersona = (): Persona => {
  const p = localStorage.getItem(PERSONA_KEY);
  return p === "parent" || p === "coach" ? p : "athlete";
};
export const setKitPersona = (p: Persona) => localStorage.setItem(PERSONA_KEY, p);

const TOKEN_KEY = "howie_session_token";
// Auto-seeded demo token: the app always boots signed in. Sign out only lasts
// until the next reload — the portal screen accepts anything in kit mode.
export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "demo-session";
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

// ── Types (mirror the backend contract) ──
export interface Session {
  session_token: string;
  user_id: string;
  persona: Persona;
  name: string;
  email: string;
  terms_accepted: boolean;
}
export interface ClutchPoint { date: string; score: number; }
export interface RetestStatus { eligible: boolean; on_cooldown: boolean; cycle_label: string; fee: string; assessment_url: string; }
export interface ClutchFactor {
  score: number; tier: string; tier_label: string; tier_meaning: string;
  threshold: number; updated_at: string; history: ClutchPoint[]; retest: RetestStatus;
}
export interface NTerpretDomain { key: string; name: string; score: number; summary: string; }
export interface NTerpret { headline: string; summary: string; domains: NTerpretDomain[]; strengths: string[]; growth_areas: string[]; }
export interface Drill { id: string; title: string; axis: string; duration_min: number; description: string; steps: string[]; }
export interface DrillLibrary { rep_count: number; drills: Drill[]; }
export interface Guide { id: string; title: string; summary: string; video_url: string | null; }
export interface AthleteProfile { id: string; name: string; org: string | null; tier: string | null; photo_url: string | null; email: string | null; phone: string | null; }
export interface RosterEntry { id: string; name: string; clutch_score: number; alignment: number; tier: string; }
export interface RosterSummary { team_id: string; team_average: number; distribution: { label: string; count: number }[]; athletes: RosterEntry[]; }
export interface MatrixQuadrant { key: string; label: string; athlete_ids: string[]; }
export interface AlignmentMatrix { threshold: number; quadrants: MatrixQuadrant[]; }
export interface HowieMessage { role: "user" | "assistant"; content: string; }
export interface HowieReply { message_id: string; reply: string; persona: Persona; }

// ── The bundled season, typed ──
interface KitAthlete {
  id: string; name: string; position: string; jersey: number; org: string;
  team_id: string; tier: string; clutch_score: number; alignment: number; photo_url: null;
}
interface KitDataset {
  generated_at: string; seed: number;
  team: { team_id: string; name: string; org: string; season: string; record: string };
  athletes: KitAthlete[];
  clutch: Record<string, ClutchFactor>;
  nterpret: Record<string, NTerpret>;
  drills: DrillLibrary;
  guides: Guide[];
}
const DS = DATASET as unknown as KitDataset;

const FEATURED = "ath_harper"; // the demo athlete (and the parent's athlete)

const delay = <T,>(v: T): Promise<T> => Promise.resolve(v);

function demoSession(persona: Persona): Session {
  const who = {
    athlete: { user_id: "demo_athlete", name: "Harper Vance", email: "demo.athlete@howie-kit.local" },
    parent: { user_id: "demo_parent", name: "Alex Vance", email: "demo.parent@howie-kit.local" },
    coach: { user_id: "demo_coach", name: "Coach Taylor Jensen", email: "demo.coach@howie-kit.local" },
  }[persona];
  return { session_token: "demo-session", persona, terms_accepted: true, ...who };
}

function profileOf(id: string): AthleteProfile {
  const a = DS.athletes.find((x) => x.id === id) ?? DS.athletes[0];
  return {
    id: a.id, name: a.name, org: a.org, tier: a.tier, photo_url: null,
    email: a.id === FEATURED ? "demo.athlete@howie-kit.local" : null,
    phone: a.id === FEATURED ? "(555) 014-7821" : null,
  };
}

// ── Auth (kit mode: everything signs you in as the current persona) ──
export const requestLink = (email: string) => {
  void email;
  return delay({ sent: true, detail: "Kit mode — you're already signed in.", dev_token: "demo-session" as string | null });
};
export const verify = (_token: string) => delay(demoSession(getKitPersona()));
export const login = (_email: string, _password: string) => delay(demoSession(getKitPersona()));
export const me = () => delay(demoSession(getKitPersona()));
export const acceptTerms = () => delay({ ok: true });

// ── Parents (in-memory; resets on reload) ──
export interface ParentEntry { email: string; name: string; relation: string; status: string; since: string; }
const parents: ParentEntry[] = [
  { email: "alex.vance@howie-kit.local", name: "Alex Vance", relation: "Parent", status: "active", since: "Mar 2026" },
];
export const myParents = () => delay([...parents]);
export const inviteParent = (email: string, relation: string) => {
  const parent: ParentEntry = { email, name: email.split("@")[0] || "Invited parent", relation, status: "pending", since: "Jul 2026" };
  parents.push(parent);
  return delay({ parent, emailed: false, dev_code: "000000" as string | null });
};
export const revokeParent = (email: string) => {
  const i = parents.findIndex((p) => p.email === email);
  if (i >= 0) parents.splice(i, 1);
  return delay({ ok: true });
};

// ── Athlete (athlete and parent personas both see the featured athlete) ──
export const myProfile = () => delay(profileOf(FEATURED));
export const myClutchFactor = () => delay(DS.clutch[FEATURED]);
export const myNTerpret = () => delay(DS.nterpret[FEATURED]);
export const myDrills = () => delay(DS.drills);
export const guides = () => delay(DS.guides);

// ── Coach (computed from the roster, mirroring the backend's logic) ──
export interface AthleteDetail { profile: AthleteProfile; clutch_factor: ClutchFactor; nterpret: NTerpret; drills: DrillLibrary; }
export interface ComparePair { profile: AthleteProfile; clutch_factor: ClutchFactor; nterpret: NTerpret; }
export const roster = () => {
  const entries: RosterEntry[] = DS.athletes
    .map((a) => ({ id: a.id, name: a.name, clutch_score: a.clutch_score, alignment: a.alignment, tier: a.tier }))
    .sort((a, b) => b.clutch_score - a.clutch_score);
  const team_average = Math.round(entries.reduce((s, e) => s + e.clutch_score, 0) / entries.length);
  const buckets: [string, (s: number) => boolean][] = [
    ["Developing (<500)", (s) => s < 500],
    ["Rising (500-749)", (s) => s >= 500 && s < 750],
    ["Clutch (750-899)", (s) => s >= 750 && s < 900],
    ["Elite (900+)", (s) => s >= 900],
  ];
  const distribution = buckets.map(([label, test]) => ({ label, count: entries.filter((e) => test(e.clutch_score)).length }));
  return delay<RosterSummary>({ team_id: DS.team.team_id, team_average, distribution, athletes: entries });
};
export const matrix = () => {
  const thr = 750, alignThr = 60;
  const labels: Record<string, string> = {
    hc_ha: "High clutch · aligned", hc_la: "High clutch · low alignment",
    lc_ha: "Building · aligned", lc_la: "Building · low alignment",
  };
  const quads: Record<string, string[]> = { hc_ha: [], hc_la: [], lc_ha: [], lc_la: [] };
  for (const a of DS.athletes) {
    const key = `${a.clutch_score >= thr ? "hc" : "lc"}_${a.alignment >= alignThr ? "ha" : "la"}`;
    quads[key].push(a.id);
  }
  return delay<AlignmentMatrix>({
    threshold: thr,
    quadrants: Object.entries(quads).map(([key, athlete_ids]) => ({ key, label: labels[key], athlete_ids })),
  });
};
export const athleteDetail = (id: string) =>
  delay<AthleteDetail>({ profile: profileOf(id), clutch_factor: DS.clutch[id], nterpret: DS.nterpret[id], drills: DS.drills });
export const compareAthletes = (a: string, b: string) =>
  delay<{ a: ComparePair; b: ComparePair }>({
    a: { profile: profileOf(a), clutch_factor: DS.clutch[a], nterpret: DS.nterpret[a] },
    b: { profile: profileOf(b), clutch_factor: DS.clutch[b], nterpret: DS.nterpret[b] },
  });

// ── Howie (local, canned — the real product uses a live model) ──
let howieCounter = 0;
export const howieChat = (message: string, persona: Persona, history: HowieMessage[] = [], athlete_id?: string) => {
  void athlete_id;
  howieCounter += 1;
  return delay<HowieReply>({
    message_id: `msg_local_${howieCounter}`,
    reply: localHowieReply(message, persona, history),
    persona,
  });
};
export const howieFeedback = (message_id: string, helpful: boolean) => {
  void message_id; void helpful;
  return delay({ ok: true });
};
