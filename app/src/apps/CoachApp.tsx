// Coach app — renders the recovered exact markup (frontend/src/templates/coach.html)
// via the template runtime, driven by a small state machine + our live API data.
import { useEffect, useRef, useState } from "react";
import coachHtml from "../templates/coach.html?raw";
import { HowieTemplate, type Ctx } from "../runtime";
import { NT_DISCLAIMER } from "../disclaimer";
import * as api from "../api";

// ── derived per-athlete model (RosterEntry lacks jersey #, position, first name) ──
type Ath = {
  id: string; name: string; first: string; initials: string;
  num: number; pos: string; score: number; tier: string;
  align: number | null; assessed: boolean;
};

const NUM_POOL = [7, 12, 3, 21, 9, 15, 6, 4, 18, 11, 24, 8];
const POS_POOL = ["SS", "P", "C", "CF", "2B", "3B", "LF", "1B", "RF", "P", "UTL", "OF"];

function deriveAth(e: api.RosterEntry, i: number): Ath {
  const parts = e.name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  const assessed = e.clutch_score > 0;
  return {
    id: e.id, name: e.name, first: parts[0] ?? e.name, initials,
    num: NUM_POOL[i] ?? i + 1, pos: POS_POOL[i] ?? "ATH",
    score: e.clutch_score, tier: e.tier || "PENDING",
    align: assessed ? e.alignment : null, assessed,
  };
}

const EMPTY_ATH: Ath = { id: "", name: "—", first: "—", initials: "—", num: 0, pos: "—", score: 0, tier: "—", align: null, assessed: false };

const TONE_COLOR: Record<string, string> = { good: "#1F7A4D", strong: "#2A6FB0", warn: "#9A7B1F", dev: "#A85A2A", poor: "#B4261F" };
const TONE_BG: Record<string, string> = { good: "#E8F3EC", strong: "#E9F1FA", warn: "#FBF4E2", dev: "#F8EDE4", poor: "#F8E7E5" };

const pad = (n: number) => String(n).padStart(2, "0");

const ALIGN_RUBRIC = [
  { min: 75, label: "Exceptional", range: "75 – 100%", tone: "good", short: "Processes the game exactly like you. In high-pressure moments they'll instinctively make the call you would have. Minimal instruction needed." },
  { min: 62.5, label: "Strong", range: "62.5 – 74%", tone: "strong", short: "Agrees with your goals but may see a different path. They'll execute the system and ask good questions. Healthy friction that keeps you sharp." },
  { min: 50, label: "Conditional", range: "50 – 62%", tone: "warn", short: "A transactional alignment. The relationship needs maintenance: clear rules and explicit rewards. When the team loses, the value gap can surface as conflict." },
  { min: 37.5, label: "Developmental", range: "37.5 – 49%", tone: "dev", short: "Fundamentally sees the game differently than you. Making it work means compromising your standard approach — a management challenge, not just a roster add." },
  { min: 0, label: "Poor", range: "0 – 37%", tone: "poor", short: "Their instincts are the inverse of your demands. Every instruction feels like a constraint. A roster spot lost to internal conflict." },
];

const ALIGN_DOMAINS = ["Role Definition", "Adaptability Support", "Communication Style", "Feedback Cadence", "Pressure Motivation", "Accountability Style", "Trust Formation", "Teaching Approach", "Decision-Making", "Team Culture"];

const COACH_NTERPRET = [
  { domain: "Role Definition", q: "My players perform best when their roles are clearly defined.", low: "Disagree", high: "Agree" },
  { domain: "Adaptability Support", q: "When a role changes mid-season, I expect players to adapt largely on their own.", low: "Disagree", high: "Agree" },
  { domain: "Communication Style", q: "The best communication is a two-way dialogue, not top-down direction.", low: "Disagree", high: "Agree" },
  { domain: "Feedback Cadence", q: "I give feedback frequently, in the flow of training and competition.", low: "Rarely", high: "Constantly" },
  { domain: "Pressure Motivation", q: "Under pressure, players are driven more by accountability than by reassurance.", low: "Reassurance", high: "Accountability" },
  { domain: "Accountability Style", q: "I address mistakes directly, even when it is uncomfortable.", low: "Gently", high: "Directly" },
  { domain: "Trust Formation", q: "I extend trust to a new player quickly, before it is fully earned.", low: "Slowly", high: "Quickly" },
  { domain: "Teaching Approach", q: "Players learn best by doing reps, more than by being told what to do.", low: "Telling", high: "Doing" },
  { domain: "Decision-Making", q: "In clutch moments, I want players to act on their own read, not wait for me.", low: "Wait for me", high: "Act on their own" },
  { domain: "Team Culture", q: "I build culture by giving players ownership of team standards.", low: "Coach-led", high: "Player-led" },
];

const COHORTS = [
  { id: "anchors", name: "Trust / Anchors", tone: "good", detail: "Clutch ≥ 750 · Alignment ≥ 62.5%", note: "Your foundation. Build the system around them.",
    summary: "These players perform under pressure and process the game the way you do. They're your most reliable assets, so trust them with the moment and the message.",
    actions: [
      { title: "Delegate leadership", body: "Assign captain roles and peer accountability. They carry your culture without you having to manage every moment." },
      { title: "Use in high-leverage situations", body: "Your go-to players when the game is on the line. Their cognitive profile is built for the pressure moment." },
      { title: "Invest in their development", body: "High-alignment, high-clutch athletes have the highest ROI on development. They're your program's long-term foundation." },
    ], quote: "These are the players your program is built around. Protect them, challenge them, and give them room to lead." },
  { id: "highreward", name: "High Reward / High Maintenance", tone: "strong", detail: "Clutch ≥ 750 · Alignment < 62.5%", note: "Talented but transactional. Worth the effort, needs structure.",
    summary: "Talented performers whose instincts diverge from your philosophy. They'll compete when it counts, but won't always execute the way you'd call it. The relationship requires deliberate management.",
    actions: [
      { title: "Define the non-negotiables", body: "Set explicit behavioral expectations early. They respond to clear rules and defined roles more than philosophy talks." },
      { title: "Use direct communication", body: "Indirect signals get misread. Be specific about what you want and why. Direct feedback loops produce the best results." },
      { title: "Channel their performance instincts", body: "Don't reshape who they are. Give them structured roles where their clutch instincts produce results inside your system." },
    ], quote: "High upside requires deliberate management. You're not fixing them, you're directing them." },
  { id: "culture", name: "Culture Carriers", tone: "warn", detail: "Clutch < 750 · Alignment ≥ 62.5%", note: "They get it. Raise their Clutch and they're anchors.",
    summary: "Aligned with your values, but their processing under maximum pressure hasn't yet reached the threshold for high-stakes reliability. They believe in your system — now help them execute it when it matters.",
    actions: [
      { title: "Pair with your anchors", body: "Position them alongside top-quadrant players in practice and games. Proximity to high-clutch performers accelerates development." },
      { title: "Invest in mental-skills training", body: "Their alignment means they'll engage with the work. Add pressure training and pre-performance routines, and track the score change." },
      { title: "Leverage their influence", body: "High-alignment players naturally reinforce team culture. Use them in mentorship and locker-room roles." },
    ], quote: "They believe in your system. Help them build the resilience to execute it when the game is on the line." },
  { id: "risk", name: "At Risk", tone: "poor", detail: "Clutch < 750 · Alignment < 62.5%", note: "Mismatch on both axes. Intervene or reconsider the alignment.",
    summary: "Both cognitive performance and alignment are below threshold. These players present the highest friction risk and the greatest management demand. Address both dimensions at once.",
    actions: [
      { title: "Increase communication cadence", body: "Schedule regular check-ins, define role expectations clearly, and set accountability checkpoints before issues escalate." },
      { title: "Build an individual development plan", body: "Create a structured plan with measurable milestones on both alignment and clutch re-test targets. Big development stories live here." },
      { title: "Evaluate long-term roster fit", body: "After deliberate investment, use re-test data to make an informed decision. Every roster spot is a resource-allocation choice." },
    ], quote: "Don't write them off, but be intentional. Every roster spot is a resource-allocation decision." },
];

const CLUTCH_TIERS = [
  { band: "800+", label: "ELITE", here: false, stat: "73% of NCAA athletes in this range earn All-American or All-Conference honors.", meaning: "Elite situational awareness and emotional regulation. Wired to accelerate when pressure peaks." },
  { band: "750 – 799", label: "GREAT", here: true, stat: "Athletes scoring 750+ are 2x more likely to commit to a Division 1 program.", meaning: "The internal stability and decision speed D1 recruiters demand. You're officially in the D1 Standard zone." },
  { band: "725 – 749", label: "ABOVE AVERAGE", here: false, stat: "Where most collegiate starters and top high-school prospects land.", meaning: "You handle pressure well and are on the cusp of top-tier recruit status." },
  { band: "651 – 724", label: "AVERAGE", here: false, stat: "The national high-school average across sports tested is 668.", meaning: "You have the foundation, but consistency under stress is your current ceiling." },
  { band: "650 & under", label: "BELOW AVERAGE", here: false, stat: "Pressure currently disrupts focus or mechanics in game-time situations.", meaning: "Mental resilience is a muscle. It responds fast to deliberate reps." },
];

const CLUTCH = { score: 788, tier: "GREAT", band: "750 - 799", assessed: "December 2025", validity: "Valid through June 2026" };

const NTERPRET = {
  assessed: "December 2025", validity: "Valid through June 2026",
  summary: "NTerpret maps three windows into how an athlete operates: how they communicate, how they learn, and what drives them. Together they're the mental scouting report.",
  afterMistakes: "Replays mistakes internally for roughly a day. Give it 24 hours, pull one lesson, then let it go. When revisiting, a clip beats a lecture.",
  dimensions: [
    { axis: "Communicates", value: "Reserved", scale: "Reserved · Supportive · Expressive · Direct", tagline: "Processes before speaking", body: "Thinks things through internally before speaking. Silence after a game is processing, not shutting down. Opens up more side-by-side than face-to-face.", strength: "Steady under noise — rarely says something they regret in the heat of a moment.", watch: "Quiet can read as disinterest. A short \"still thinking\" keeps people with them." },
    { axis: "Learns", value: "Visual", scale: "Visual · Auditory · Kinesthetic", tagline: "Sees it, then does it", body: "Converts what they see into skill. One clear rep on film is worth ten spoken cues. Demonstration and imagery land where long explanations slide off.", strength: "Fast at copying mechanics once they can see them clearly.", watch: "Verbal-only instruction fades quickly. Ask to be shown, or pull a clip." },
    { axis: "Driven By", value: "Intrinsic Growth", scale: "Intrinsic Growth · Competitive Edge · Team Commitment · Recognition", tagline: "Runs on getting better", body: "Fuel is improvement, not trophies. Measures themselves against their own progress. \"What did I learn?\" motivates more than \"did we win?\"", strength: "Resilient through slumps — motivation doesn't depend on results.", watch: "External hype can feel hollow. Keep process goals front and center." },
  ],
};

const DRILL_TIES: Record<string, string> = { Visualization: "Visual learner", Learning: "Visual learner", Recovery: "Reserved", Communication: "Reserved", Motivation: "Intrinsic Growth" };

const DRILLS = [
  { source: "Clutch Factor", priority: true, title: "Focus Interval Training", focus: "Focus", minutes: "2–6 min", why: "Hold attention on a single cue for a set time, then stretch the duration. Builds the concentration to stay present through high-leverage moments.", video: "https://youtu.be/QliFmb9QFbA", how: ["Set a timer for 2 minutes. Fix on one cue.", "Every time your mind drifts, name it and return.", "Add 30 seconds each session. Work up to 6 minutes."] },
  { source: "Clutch Factor", priority: true, title: "Confidence Scripting", focus: "Confidence", minutes: "5 min", why: "Write and rehearse short, first-person confidence lines tied to pressure moments so composure becomes automatic.", video: "https://youtu.be/Qc7q9L_NRlU", how: ["Write 3 first-person lines.", "Tie each to a specific trigger.", "Say them out loud before and during reps."] },
  { source: "Clutch Factor", priority: false, title: "Box Breathing Reset", focus: "Composure", minutes: "3 min", why: "A four-count breathing pattern that drops heart rate fast — the go-to between pitches or before a big at-bat.", video: "https://youtu.be/tEmt1Znux58", how: ["Inhale 4, hold 4, exhale 4, hold 4.", "Run 3 full cycles, eyes on one point.", "Pair it with a physical cue so it triggers on its own."] },
  { source: "NTerpret", priority: false, title: "Visualization Walkthrough", focus: "Visualization", minutes: "5 min", why: "For visual learners, seeing a play before making it is worth ten verbal reminders. Rehearse success and the body follows.", video: "", how: ["Picture the exact play, first person, full speed.", "Add detail: the dirt, the sound, a clean throw.", "Run it 3 times the night before and once in warm-ups."] },
  { source: "NTerpret", priority: false, title: "The 24-Hour Rule", focus: "Recovery", minutes: "After games", why: "Give the mistake-replay loop a deadline so it does its job and then lets go, instead of bleeding into the next game.", video: "", how: ["Let yourself feel a rough game tonight. No fixing.", "Tomorrow, write the one lesson in a sentence.", "Then close it. The lesson stays, the sting goes."] },
  { source: "NTerpret", priority: false, title: "Side-by-Side Check-In", focus: "Communication", minutes: "5 min", why: "Reserved athletes open up more shoulder-to-shoulder than face-to-face. Hard conversations go better on a walk or a drive.", video: "", how: ["Pick a side-by-side setting.", "Lead with what you noticed, not what you felt.", "Let silence sit."] },
];

const PLAYER_HACKS = [
  { when: "Pre-Game", body: "A short role cue before first pitch settles responsibilities and speeds the first decision." },
  { when: "Post-Game", body: "A 10-second reset after the final out: one slow breath, one honest note, one intention for next game." },
  { when: "Practice", body: "A per-session checklist: two things to reinforce, one skill to drill." },
];

const PLAYBOOK = [
  { title: "Read the room first", body: "Before you script a talk, check the athlete's NTerpret. The same words land differently on a Reserved kid than an Expressive one." },
  { title: "Coach the process", body: "Growth-driven athletes tune out scoreboard pressure. Frame goals around mastery and the reps that get them there." },
  { title: "Protect the anchors", body: "Your high-clutch, high-alignment players carry culture. Give them ownership and room to lead." },
];

const MOMENTS = [
  { kicker: "Game day", title: "Get the team ready before first pitch", say: "We've got a big game today and I want the whole team in the right headspace. What should I say before first pitch?" },
  { kicker: "Postgame", title: "Talk to the team after a tough loss", say: "We just lost a rough one and the group is deflated. How do I talk to the team so they bounce back instead of spiraling?" },
  { kicker: "Practice", title: "Build this week around how they learn", say: "Based on our team's profile, what should we focus on as a group in practice this week?" },
  { kicker: "One athlete", title: "A player you can't reach", say: "I've got one player I can't seem to get through to right now. Can you help me figure out the right approach?" },
  { kicker: "Off the field", title: "Handle a frustrated parent", say: "A parent is frustrated about playing time and wants to talk after practice. How do I handle that conversation?" },
];

const STARTERS = [
  "Which players on my roster need the most attention right now?",
  "We have a showcase this weekend. How do I prep the team mentally?",
  "Half my roster is Reserved. How do I reach them without shutting them down?",
  "Based on our team's assessment data, what should we drill this week?",
];

const SHARE_TARGETS = [
  { glyph: "IG", label: "Instagram", bg: "#0E0E0E", fg: "#fff" },
  { glyph: "X", label: "X", bg: "#0E0E0E", fg: "#fff" },
  { glyph: "TT", label: "TikTok", bg: "#0E0E0E", fg: "#fff" },
  { glyph: "⤓", label: "Save image", bg: "#EDEBE5", fg: "#0E0E0E" },
];

const PARTNERS = [
  { id: "alliance", name: "Alliance Fastpitch", short: "ALLIANCE", sport: "Softball · 8U–18U" },
  { id: "fss", name: "Future Stars Series", short: "FUTURE", sport: "Baseball · Scouting" },
  { id: "pg", name: "Perfect Game", short: "PG", sport: "Baseball / Softball" },
  { id: "usssa", name: "USSSA", short: "USSSA", sport: "Multi-sport" },
  { id: "other", name: "My organization isn't listed", short: "OTHER", sport: "Request manually" },
];

const STAT_CELLS = [
  { k: "OPS", v: "8.70" }, { k: "WHIP", v: "2.10" }, { k: "FIP", v: "9.90" }, { k: "WAR", v: "9.70" },
  { k: "ISO", v: "3.60" }, { k: "BABIP", v: "0.29" }, { k: "K%", v: "1.00" }, { k: "EV", v: "7.50" },
];

const GROUP_CFG = [
  { name: "Composure Crew", focus: "Steady the nerves", tone: "poor", drillTitle: "Box Breathing Reset", drillMin: "3 min", drillWhy: "A shared pre-pitch reset raises the team floor fastest for players who dip under pressure.", activity: "Pair up. One athlete narrates a pressure situation while the other runs a 4-count breath, then swap.", test: (a: Ath) => a.assessed && a.score < 700 },
  { name: "Sharpen the Edge", focus: "Turn good into clutch", tone: "warn", drillTitle: "Confidence Scripting", drillMin: "5 min", drillWhy: "Solid athletes who score lower on self-talk than decision speed close the gap with rehearsed confidence lines.", activity: "Each athlete writes one confidence line tied to a game trigger and says it before every rep this block.", test: (a: Ath) => a.assessed && a.score >= 700 && a.score < 760 },
  { name: "Lead & Extend", focus: "Set the standard", tone: "good", drillTitle: "Focus Interval Training", drillMin: "2–6 min", drillWhy: "Your top performers extend their edge and model the standard for the group.", activity: "Run focus intervals as a demo station; anchors coach the drill for a teammate.", test: (a: Ath) => a.assessed && a.score >= 760 },
];


function alignMeta(pct: number | null): { pct: number; label: string; range: string; short: string; color: string; bg: string } | null {
  if (pct == null) return null;
  const tier = ALIGN_RUBRIC.find((r) => pct >= r.min) ?? ALIGN_RUBRIC[ALIGN_RUBRIC.length - 1];
  return { pct: Math.round(pct), label: tier.label, range: tier.range, short: tier.short, color: TONE_COLOR[tier.tone], bg: TONE_BG[tier.tone] };
}

function alignDomains(a: Ath): { n: string; domain: string; rating: string; color: string }[] {
  if (a.align == null) return [];
  let seed = 0;
  for (const ch of a.id) seed += ch.charCodeAt(0);
  return ALIGN_DOMAINS.map((d, i) => {
    const wobble = ((seed + i * 37) % 30) - 12;
    const v = a.align! + wobble;
    let rating = "Low", color = "#B4261F";
    if (v >= 72) { rating = "High"; color = "#1F7A4D"; }
    else if (v >= 52) { rating = "Moderate"; color = "#9A7B1F"; }
    return { n: pad(i + 1), domain: d, rating, color };
  });
}

function cohortOf(a: Ath): string | null {
  if (a.align == null || !a.assessed) return null;
  const hiC = a.score >= 750, hiA = a.align >= 62.5;
  if (hiC && hiA) return "anchors";
  if (hiC && !hiA) return "highreward";
  if (!hiC && hiA) return "culture";
  return "risk";
}

function tierFor(score: number): string {
  if (score >= 800) return "ELITE";
  if (score >= 750) return "GREAT";
  if (score >= 725) return "ABOVE AVERAGE";
  if (score >= 651) return "AVERAGE";
  return "BELOW AVERAGE";
}

const DIST_SUB: Record<string, string> = {
  Elite: "800+", Great: "750–799", "Above Avg": "725–749", "Above Average": "725–749",
  Average: "651–724", Below: "≤650", "Below Average": "≤650",
};

type Msg = { role: "user" | "assistant"; content: string; pending?: boolean; id?: string };
type Note = { id: string; tag: string; tagBg: string; prompt: string; text: string; ago: string };

const ACTIVE = "#0E0E0E";
const MUTED = "#9A968E";

// tracks which player NTerpret cards are expanded (keyed by `${athleteId}:${index}`)
const expanded = new Set<string>();

export function CoachApp({ signOut }: { signOut: () => void }) {
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);

  const ui = useRef({
    screen: "home", rt: "roster", tab: "clutch", pTab: "clutch", sheet: "",
    selectedId: "", guideId: "", quadrantId: "anchors",
    sort: "score", comparePos: "all", compareA: "", compareB: "", comparePickSlot: "",
    coachNtStep: 0, coachNtSubmitted: false, coachNtAnswers: {} as Record<number, number>,
    relation: "Assistant", inviteEmail: "", inviteError: "", partner: "alliance",
    addingNote: false, noteDraft: "", supportSent: false, supportSubject: "", supportMessage: "",
    reminded: {} as Record<string, boolean>,
  });
  const data = useRef<{ roster?: api.RosterSummary; guides?: api.Guide[]; detail?: api.AthleteDetail }>({});
  const chat = useRef<Msg[]>([]);
  const draft = useRef("");
  const notes = useRef<Note[]>([
    { id: "n1", tag: "Note", tagBg: "#6F6C64", prompt: "Zoe — benched Saturday", text: "When she's ready, ask instead of reassure: \"What do you think the coach is seeing? What's in your control this week?\"", ago: "5h ago" },
  ]);
  const ratedIdx = useRef<Set<number>>(new Set());
  const savedIdx = useRef<Set<number>>(new Set());
  // Full chat history, kept on this device only (never sent to the server).
  const hist = useRef<{ id: string; title: string; at: number; messages: Msg[] }[]>([]);
  const chatId = useRef<string | null>(null);
  const settings = useRef<Record<string, boolean>>({ reminders: true, reduced: false, saveLocal: true });

  useEffect(() => {
    try { if (!localStorage.getItem("howie_terms_ok")) ui.current.sheet = "disclaimer"; } catch { /* noop */ }
    try {
      const hraw = localStorage.getItem("howie_chats_coach");
      hist.current = hraw ? (JSON.parse(hraw) as typeof hist.current) : [];
    } catch { /* noop */ }
    if (hist.current.length && chat.current.length === 0) {
      const lastOpen = localStorage.getItem("howie_chat_open_coach");
      const resume = hist.current.find((t) => t.id === lastOpen) ?? hist.current[0];
      chat.current = resume.messages;
      chatId.current = resume.id;
    }
    Promise.all([api.roster(), api.guides()])
      .then(([roster, guides]) => { data.current.roster = roster; data.current.guides = guides; bump(); })
      .catch(() => bump());
  }, []);

  const s = ui.current;
  const val = (e: unknown) => ((e as Event).target as HTMLInputElement)?.value ?? "";

  function openPlayer(id: string) {
    s.screen = "player"; s.selectedId = id; s.pTab = "clutch"; s.sheet = ""; bump();
    if (data.current.detail?.profile.id !== id) {
      api.athleteDetail(id).then((d) => { data.current.detail = d; bump(); }).catch(() => {});
    }
  }

  const persistHist = () => { try { localStorage.setItem("howie_chats_coach", JSON.stringify(hist.current.slice(0, 50))); } catch { /* noop */ } };
  function histAgo(ts: number): string {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "just now";
    if (d < 3600) return Math.floor(d / 60) + "m ago";
    if (d < 86400) return Math.floor(d / 3600) + "h ago";
    return Math.floor(d / 86400) + "d ago";
  }
  function syncThread() {
    const msgs = chat.current.filter((m) => !m.pending && m.content);
    if (!msgs.length) return;
    const firstUser = msgs.find((m) => m.role === "user");
    const title = (firstUser?.content || msgs[0].content || "Conversation").slice(0, 60);
    if (!chatId.current) chatId.current = "c" + Date.now();
    hist.current = [{ id: chatId.current, title, at: Date.now(), messages: msgs }, ...hist.current.filter((x) => x.id !== chatId.current)];
    try { localStorage.setItem("howie_chat_open_coach", chatId.current); } catch { /* noop */ }
    persistHist();
  }

  async function runChat(text: string) {
    const t = text.trim();
    if (!t) return;
    const prior = chat.current.filter((m) => !m.pending).map((m) => ({ role: m.role, content: m.content }));
    chat.current = [...chat.current, { role: "user", content: t }, { role: "assistant", content: "", pending: true }];
    draft.current = ""; s.screen = "chat"; s.sheet = ""; syncThread(); bump();
    try {
      const r = await api.howieChat(t, "coach", prior, s.selectedId || undefined);
      chat.current = chat.current.map((m) => (m.pending ? { role: "assistant", content: r.reply, id: r.message_id } : m));
    } catch {
      chat.current = chat.current.map((m) => (m.pending ? { role: "assistant", content: "I hit a snag — try again in a moment." } : m));
    }
    syncThread();
    bump();
  }
  const submitChat = () => runChat(draft.current);
  const sendPrompt = (text: string) => runChat(text);

  // ── roster-derived collections ──
  const rs = data.current.roster;
  const aths: Ath[] = (rs?.athletes ?? []).map(deriveAth);
  const assessedAths = aths.filter((a) => a.assessed);
  const detail = data.current.detail && data.current.detail.profile.id === s.selectedId ? data.current.detail : undefined;

  const playerRow = (a: Ath) => ({ onOpen: () => openPlayer(a.id), name: a.name, num: a.num, pos: a.pos, score: a.score, alignPct: a.align != null ? Math.round(a.align) : 0 });

  // sorted roster list
  const sortedList = [...aths].sort((a, b) => {
    if (s.sort === "align") return (b.align ?? -1) - (a.align ?? -1);
    if (s.sort === "name") return a.name.localeCompare(b.name);
    return b.score - a.score;
  });
  const rosterList = sortedList.map((a) => ({
    onOpen: () => openPlayer(a.id),
    dotBg: a.assessed ? "#0E0E0E" : "#EDEBE5", dotFg: a.assessed ? "#fff" : "#9A968E",
    scoreLabel: a.assessed ? String(a.score) : a.initials,
    name: a.name, isPending: !a.assessed, num: a.num, pos: a.pos, tierLabel: a.tier,
    hasAlign: a.assessed && a.align != null, noAlign: !(a.assessed && a.align != null),
    alignColor: alignMeta(a.align)?.color ?? "#9A968E", alignPct: a.align != null ? Math.round(a.align) : 0,
  }));

  // alignment matrix cohorts (derived from roster thresholds)
  const alignCohorts = COHORTS.map((c) => {
    const mem = aths.filter((a) => cohortOf(a) === c.id);
    return { accent: TONE_COLOR[c.tone], name: c.name, count: mem.length, detail: c.detail, note: c.note,
      onGuide: () => { s.quadrantId = c.id; s.sheet = "quadrant"; bump(); },
      hasMembers: mem.length > 0, noMembers: mem.length === 0, members: mem.map(playerRow) };
  });

  // team insights distribution
  const dist = rs?.distribution ?? [];
  const maxCount = Math.max(1, ...dist.map((d) => d.count));
  const teamDistribution = dist.map((d) => ({ label: d.label, sub: DIST_SUB[d.label] ?? "", barPct: Math.round((d.count / maxCount) * 100), count: d.count }));
  const teamAlign = assessedAths.length ? Math.round(assessedAths.reduce((t, a) => t + (a.align ?? 0), 0) / assessedAths.length) : 0;
  const avgClutch = rs ? Math.round(rs.team_average) : 0;
  const partnerMeta = PARTNERS.find((p) => p.id === s.partner) ?? PARTNERS[0];
  const team = {
    name: "Thunder 16U Gold", org: partnerMeta.name, season: "2026 Spring", coach: "Coach Dana Whitfield",
    teamId: rs?.team_id ?? "—", sport: "Softball", roster: aths.length, assessed: assessedAths.length,
    avgClutch, avgTier: tierFor(avgClutch),
  };
  const flaggedCount = aths.filter((a) => a.assessed && a.score < 700).length;

  // active quadrant sheet
  const qc = COHORTS.find((c) => c.id === s.quadrantId) ?? COHORTS[0];
  const qMembers = aths.filter((a) => cohortOf(a) === qc.id);
  const quadrant = {
    accent: TONE_COLOR[qc.tone], name: qc.name, detail: qc.detail, summary: qc.summary, actions: qc.actions,
    bg: TONE_BG[qc.tone], quote: qc.quote, hasMembers: qMembers.length > 0, count: qMembers.length, members: qMembers.map(playerRow),
  };

  // selected player detail
  const selected = aths.find((a) => a.id === s.selectedId) ?? EMPTY_ATH;
  const cf = detail?.clutch_factor;
  const history = cf?.history ?? [];
  const playerHistory = history.length > 1 ? history.slice(0, -1).slice(-2).map((h) => ({ score: h.score, date: h.date })) : [];
  const playerDims = (detail?.nterpret.domains ?? []).map((d, i) => ({
    axis: "NTerpret", value: d.name, coachNote: d.summary, general: d.summary,
    caret: expanded.has(`${s.selectedId}:${i}`) ? "−" : "+", open: expanded.has(`${s.selectedId}:${i}`),
    onToggle: () => { const k = `${s.selectedId}:${i}`; expanded.has(k) ? expanded.delete(k) : expanded.add(k); bump(); },
  }));
  const videoDrills = (detail?.drills.drills ?? []).map((d) => ({
    focus: d.axis, minutes: `${d.duration_min} min`, title: d.title, why: d.description, video: "",
    how: d.steps.map((text, i) => ({ n: pad(i + 1), text })),
  }));
  const playerAlign = alignMeta(selected.align);

  // compare
  const cmpA = aths.find((a) => a.id === (s.compareA || assessedAths[0]?.id)) ?? assessedAths[0] ?? EMPTY_ATH;
  const cmpB = aths.find((a) => a.id === (s.compareB || assessedAths[1]?.id)) ?? assessedAths[1] ?? EMPTY_ATH;
  const numRow = (label: string, a: number, b: number, ad: string, bd: string, ap: number, bp: number) => {
    const aWins = a >= b;
    return { label, isNum: true, isCat: false, a: ad, b: bd,
      aPct: Math.max(0, Math.min(100, ap)), bPct: Math.max(0, Math.min(100, bp)),
      aBar: aWins ? "#0E0E0E" : "#C9C5BC", bBar: aWins ? "#C9C5BC" : "#0E0E0E",
      aFg: aWins ? "#0E0E0E" : "#9A968E", bFg: aWins ? "#9A968E" : "#0E0E0E" };
  };
  const catRow = (label: string, a: string, b: string) => ({ label, isNum: false, isCat: true, a, b, aPct: 0, bPct: 0, aBar: "", bBar: "", aFg: "", bFg: "" });
  const compareRows = [
    numRow("Clutch Factor", cmpA.score, cmpB.score, String(cmpA.score), String(cmpB.score), cmpA.score / 10, cmpB.score / 10),
    numRow("Coach Alignment", cmpA.align ?? 0, cmpB.align ?? 0, cmpA.align != null ? Math.round(cmpA.align) + "%" : "—", cmpB.align != null ? Math.round(cmpB.align) + "%" : "—", cmpA.align ?? 0, cmpB.align ?? 0),
    catRow("Tier", cmpA.tier, cmpB.tier),
    catRow("Position", cmpA.pos, cmpB.pos),
  ];
  const comparePosList = ["all", ...Array.from(new Set(assessedAths.map((a) => a.pos)))];
  const comparePositions = comparePosList.map((p) => ({
    label: p === "all" ? "All" : p, onTap: () => { s.comparePos = p; bump(); },
    bg: s.comparePos === p ? "#0E0E0E" : "#fff", fg: s.comparePos === p ? "#fff" : "#6F6C64",
  }));
  const comparePickList = assessedAths.filter((a) => s.comparePos === "all" || a.pos === s.comparePos).map((a) => ({
    onPick: () => { if (s.comparePickSlot === "a") s.compareA = a.id; else s.compareB = a.id; s.sheet = ""; bump(); },
    initials: a.initials, name: a.name, sub: `#${a.num} · ${a.pos}`, score: a.score,
  }));

  // guides
  const guidesData = data.current.guides ?? [];
  const guidesList = guidesData.map((g, i) => ({ n: pad(i + 1), title: g.title, blurb: g.summary, onOpen: () => { s.screen = "guide"; s.guideId = g.id; bump(); } }));
  const activeGuide = guidesData.find((g) => g.id === s.guideId);
  const sections = activeGuide ? [{ heading: "Overview", body: activeGuide.summary, hasSay: false, say: [] as string[], hasAvoid: false, avoid: [] as string[] }] : [];

  // practice groups
  const practiceGroups = GROUP_CFG.map((g) => {
    const mem = aths.filter(g.test);
    return { accent: TONE_COLOR[g.tone], name: g.name, count: mem.length, focus: g.focus, bg: TONE_BG[g.tone],
      drillTitle: g.drillTitle, drillMin: g.drillMin, drillWhy: g.drillWhy, activity: g.activity,
      members: mem.map((a) => ({ onOpen: () => openPlayer(a.id), initials: a.initials, name: a.name, sub: `#${a.num} · ${a.pos}`, score: a.score })) };
  });
  const pendingAths = aths.filter((a) => !a.assessed);
  const pendingGroup = pendingAths.map((a) => ({ onOpen: () => openPlayer(a.id), name: a.name, sub: `#${a.num} · ${a.pos}` }));

  // chat message list
  const mlist = chat.current.map((m, i) => {
    if (m.role === "user") return { isUser: true, isHowie: false, content: m.content, thinking: false, ack: "", word: "", showActions: false, rated: false, notRated: false, onUp: () => {}, onDown: () => {}, onSave: () => {}, saveColor: MUTED, saveFill: "none", saveLabel: "Save" };
    const saved = savedIdx.current.has(i);
    const rated = ratedIdx.current.has(i);
    return {
      isUser: false, isHowie: true, content: m.pending ? "" : m.content, thinking: !!m.pending,
      ack: "On it.", word: "Reading the roster", showActions: !m.pending,
      rated, notRated: !rated,
      onUp: () => { ratedIdx.current.add(i); if (m.id) api.howieFeedback(m.id, true).catch(() => {}); bump(); },
      onDown: () => { ratedIdx.current.add(i); if (m.id) api.howieFeedback(m.id, false).catch(() => {}); bump(); },
      onSave: () => { savedIdx.current.add(i); notes.current = [{ id: `m${i}-${Date.now()}`, tag: "Howie", tagBg: "#0E0E0E", prompt: "", text: m.content, ago: "just now" }, ...notes.current]; bump(); },
      saveColor: saved ? "#0E0E0E" : MUTED, saveFill: saved ? "#0E0E0E" : "none", saveLabel: saved ? "Saved" : "Save",
    };
  });

  // coach nterpret survey
  const total = COACH_NTERPRET.length;
  const cq = COACH_NTERPRET[Math.min(s.coachNtStep, total - 1)];
  const pickCoachNt = (v: number) => { s.coachNtAnswers[s.coachNtStep] = v; s.coachNtStep = s.coachNtStep < total - 1 ? s.coachNtStep + 1 : total; bump(); };
  const coachNtCurrent = {
    domain: cq.domain, q: cq.q, low: cq.low, high: cq.high,
    scale: [1, 2, 3, 4, 5, 6, 7].map((v) => {
      const sel = s.coachNtAnswers[s.coachNtStep] === v;
      return { v, onPick: () => pickCoachNt(v), bg: sel ? "#0E0E0E" : "#fff", fg: sel ? "#fff" : "#0E0E0E", bd: sel ? "#0E0E0E" : "#D8D4CC" };
    }),
  };
  const coachNtReviewRows = COACH_NTERPRET.map((q, i) => ({ domain: q.domain, q: q.q, answer: s.coachNtAnswers[i] != null ? String(s.coachNtAnswers[i]) : "–", onEdit: () => { s.coachNtStep = i; bump(); } }));
  const submittedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // settings toggles
  const toggleCfg = [
    { key: "reminders", label: "Testing reminders", sub: "Nudge unassessed athletes and their parents" },
    { key: "reduced", label: "Reduced motion", sub: "Minimize animations across the app" },
    { key: "saveLocal", label: "Save notes on this device", sub: "Keep saved notes and chat locally" },
  ];
  const toggles = toggleCfg.map((c) => {
    const on = settings.current[c.key];
    return { label: c.label, sub: c.sub, onToggle: () => { settings.current[c.key] = !on; bump(); }, trackBg: on ? "#0E0E0E" : "#D8D4CC", knobX: on ? "20px" : "0px" };
  });

  // partner picker
  const partnerOptions = PARTNERS.map((p) => ({ onSelect: () => { s.partner = p.id; s.sheet = ""; bump(); }, isAlliance: false, noLogo: true, short: p.short, name: p.name, sport: p.sport, selected: s.partner === p.id }));

  // nav flags
  const homeActive = s.screen === "home";
  const rosterActive = s.screen === "roster" || s.screen === "player" || s.screen === "compare" || s.screen === "groups";
  const chatActive = s.screen === "chat";
  const profActive = s.screen === "profile" || s.screen === "coachNt";
  const goBack = () => {
    if (s.screen === "player" || s.screen === "compare") s.screen = "roster";
    else if (s.screen === "guide") s.screen = "guides";
    else if (s.screen === "coachNt") s.screen = "profile";
    else s.screen = "home";
    s.sheet = ""; bump();
  };

  const ctx: Ctx = {
    // ── top-level screen gating (login/access handled by shell) ──
    isLogin: false, isAccess: false, appView: true, showOnboard: false,
    ob0: true, ob1: false, ob2: false, obCta: "Continue",
    obDots: [{ w: "22px", bg: "#0E0E0E" }, { w: "7px", bg: "#D8D4CC" }, { w: "7px", bg: "#D8D4CC" }],
    obNext: () => {}, obSkip: () => {},
    isHome: s.screen === "home", isRoster: s.screen === "roster", isPlayer: s.screen === "player",
    isCoachNt: s.screen === "coachNt", isReports: s.screen === "reports", isChat: s.screen === "chat",
    isProfile: s.screen === "profile", isGuides: s.screen === "guides", isGuide: s.screen === "guide",
    isGroups: s.screen === "groups", isCompare: s.screen === "compare",
    showBack: s.screen !== "home",

    // ── header / partner ──
    activePartner: { isAlliance: false, noLogo: true, short: partnerMeta.short },
    goBack, goHome: () => { s.screen = "home"; s.sheet = ""; bump(); },

    // ── home ──
    input: draft.current,
    onInput: (e: unknown) => {
      draft.current = val(e);
      const el = (e as Event).target as HTMLTextAreaElement | null;
      if (el && el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 96) + "px"; }
    },
    // Enter sends, Shift+Enter makes a new line (composer is a textarea).
    onChatKey: (e: unknown) => {
      const ev = e as KeyboardEvent;
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submitChat(); }
    },
    submitAsk: submitChat, submitChat,
    moments: MOMENTS.map((m) => ({ kicker: m.kicker, title: m.title, onTap: () => sendPrompt(m.say) })),
    team,
    goTeam: () => { s.screen = "roster"; s.rt = "team"; s.sheet = ""; bump(); },
    goRoster: () => { s.screen = "roster"; s.rt = "roster"; s.sheet = ""; bump(); },
    goGroups: () => { s.screen = "groups"; s.sheet = ""; bump(); },
    goGuides: () => { s.screen = "guides"; s.sheet = ""; bump(); },
    openClutchGuide: () => { s.sheet = "clutchGuide"; bump(); },

    // ── roster / team segmented ──
    rtRoster: s.rt === "roster", rtMatrix: s.rt === "matrix", rtTeam: s.rt === "team",
    setRtRoster: () => { s.rt = "roster"; bump(); }, setRtMatrix: () => { s.rt = "matrix"; bump(); }, setRtTeam: () => { s.rt = "team"; bump(); },
    segRosterBg: s.rt === "roster" ? "#0E0E0E" : "transparent", segRosterFg: s.rt === "roster" ? "#fff" : "#6F6C64",
    segMatrixBg: s.rt === "matrix" ? "#0E0E0E" : "transparent", segMatrixFg: s.rt === "matrix" ? "#fff" : "#6F6C64",
    segTeamBg: s.rt === "team" ? "#0E0E0E" : "transparent", segTeamFg: s.rt === "team" ? "#fff" : "#6F6C64",
    // roster list + sort
    openCompare: () => { s.screen = "compare"; s.sheet = ""; bump(); },
    sortByScore: () => { s.sort = "score"; bump(); }, sortByAlign: () => { s.sort = "align"; bump(); }, sortByName: () => { s.sort = "name"; bump(); },
    sortScoreBg: s.sort === "score" ? "#0E0E0E" : "#fff", sortScoreFg: s.sort === "score" ? "#fff" : "#0E0E0E",
    sortAlignBg: s.sort === "align" ? "#0E0E0E" : "#fff", sortAlignFg: s.sort === "align" ? "#fff" : "#0E0E0E",
    sortNameBg: s.sort === "name" ? "#0E0E0E" : "#fff", sortNameFg: s.sort === "name" ? "#fff" : "#0E0E0E",
    rosterSort: s.sort, rosterList,
    // matrix
    openRubric: () => { s.sheet = "rubric"; bump(); },
    alignCohorts,
    // team insights
    teamDistribution, teamAlign,
    askTeamProfile: () => sendPrompt("Give me a read on my team's overall profile and what it means for how I coach them."),

    // ── player detail ──
    player: { dotBg: "#0E0E0E", dotFg: "#fff", initials: selected.initials, name: selected.name, num: selected.num, pos: selected.pos, id: selected.id, first: selected.first, score: selected.score, tier: selected.tier },
    playerNotAssessed: !selected.assessed, playerAssessed: selected.assessed,
    notPlayerReminded: !s.reminded[s.selectedId], playerReminded: !!s.reminded[s.selectedId],
    sendTestingReminder: () => { s.reminded[s.selectedId] = true; bump(); },
    setPTabClutch: () => { s.pTab = "clutch"; bump(); }, setPTabNterpret: () => { s.pTab = "nterpret"; bump(); },
    setPTabDrills: () => { s.pTab = "drills"; bump(); }, setPTabAlign: () => { s.pTab = "align"; bump(); },
    pTabClutch: s.pTab === "clutch", pTabNterpret: s.pTab === "nterpret", pTabDrills: s.pTab === "drills", pTabAlign: s.pTab === "align",
    pSegClutchBg: s.pTab === "clutch" ? "#0E0E0E" : "transparent", pSegClutchFg: s.pTab === "clutch" ? "#fff" : "#6F6C64",
    pSegNterpretBg: s.pTab === "nterpret" ? "#0E0E0E" : "transparent", pSegNterpretFg: s.pTab === "nterpret" ? "#fff" : "#6F6C64",
    pSegDrillsBg: s.pTab === "drills" ? "#0E0E0E" : "transparent", pSegDrillsFg: s.pTab === "drills" ? "#fff" : "#6F6C64",
    pSegAlignBg: s.pTab === "align" ? "#0E0E0E" : "transparent", pSegAlignFg: s.pTab === "align" ? "#fff" : "#6F6C64",
    playerPct: Math.round(selected.score / 10),
    playerHasHistory: playerHistory.length > 0, playerHistory,
    playerTierCopy: cf?.tier_meaning ?? "Their tier reflects how they process and regulate under pressure — a trainable baseline, not a ceiling.",
    playerDims,
    clutchVideoCount: `${videoDrills.length} drills`, clutchVideoDrills: videoDrills,
    playerHackCount: `${PLAYER_HACKS.length} routines`, playerHacks: PLAYER_HACKS,
    playerAlign: { pct: playerAlign?.pct ?? "", label: playerAlign?.label ?? "", range: playerAlign?.range ?? "", short: playerAlign?.short ?? "" },
    playerAlignDomains: alignDomains(selected),
    askAboutPlayer: () => sendPrompt(`Tell me about ${selected.name || "this athlete"} — what do their Clutch Factor and NTerpret say, and how should I coach them?`),

    // ── coach nterpret survey ──
    coachNtInQuestion: !s.coachNtSubmitted && s.coachNtStep < total,
    coachNtInReview: !s.coachNtSubmitted && s.coachNtStep >= total,
    coachNtSubmitted: s.coachNtSubmitted,
    coachNtProgressPct: Math.round((Math.min(s.coachNtStep, total) / total) * 100),
    coachNtStepNum: Math.min(s.coachNtStep + 1, total), coachNtTotal: total,
    coachNtCurrent, coachNtCanBack: s.coachNtStep > 0,
    coachNtBackBtn: () => { s.coachNtStep = s.coachNtStep >= total ? total - 1 : Math.max(0, s.coachNtStep - 1); bump(); },
    coachNtReviewRows, submitCoachNt: () => { s.coachNtSubmitted = true; bump(); }, submittedDate,

    // ── reports (coach's own scaffold; not reachable via nav, kept for parity) ──
    setTabClutch: () => { s.tab = "clutch"; bump(); }, setTabNterpret: () => { s.tab = "nterpret"; bump(); }, setTabDrills: () => { s.tab = "drills"; bump(); },
    tabClutch: s.tab === "clutch", tabNterpret: s.tab === "nterpret", tabDrills: s.tab === "drills",
    segClutchBg: s.tab === "clutch" ? "#0E0E0E" : "transparent", segClutchFg: s.tab === "clutch" ? "#fff" : "#6F6C64",
    segNterpretBg: s.tab === "nterpret" ? "#0E0E0E" : "transparent", segNterpretFg: s.tab === "nterpret" ? "#fff" : "#6F6C64",
    segDrillsBg: s.tab === "drills" ? "#0E0E0E" : "transparent", segDrillsFg: s.tab === "drills" ? "#fff" : "#6F6C64",
    clutchPct: Math.round(CLUTCH.score / 10),
    clutch: { score: CLUTCH.score, tier: CLUTCH.tier, band: CLUTCH.band, assessed: CLUTCH.assessed, validity: CLUTCH.validity },
    clutchTiers: CLUTCH_TIERS.map((t) => ({ rowBg: t.here ? "#0E0E0E" : "#fff", fg: t.here ? "#fff" : "#0E0E0E", band: t.band, labelFg: t.here ? "rgba(255,255,255,0.6)" : "#6F6C64", label: t.label, here: t.here, statFg: t.here ? "rgba(255,255,255,0.8)" : "#42403B", stat: t.stat, meaningFg: t.here ? "rgba(255,255,255,0.9)" : "#42403B", meaning: t.meaning })),
    clutchDrills: DRILLS.filter((d) => d.source === "Clutch Factor").slice(0, 2).map((d) => ({ title: d.title, priority: d.priority, focus: d.focus, minutes: d.minutes })),
    playbook: PLAYBOOK,
    openShare: () => { s.sheet = "share"; bump(); },
    nterpret2: { summary: NTERPRET.summary, assessed: NTERPRET.assessed, validity: NTERPRET.validity, afterMistakes: NTERPRET.afterMistakes },
    nterpretDims: NTERPRET.dimensions.map((d, i) => ({ value: d.value, n: pad(i + 1), axis: d.axis, tagline: d.tagline, body: d.body, strength: d.strength, watch: d.watch, scale: d.scale })),
    clutchDrillCount: `${DRILLS.filter((d) => d.source === "Clutch Factor").length} drills`,
    clutchDrillsLib: DRILLS.filter((d) => d.source === "Clutch Factor").map((d) => ({ focus: d.focus, minutes: d.minutes, priority: d.priority, title: d.title, why: d.why, video: d.video, how: d.how })),
    nterpretDrillCount: `${DRILLS.filter((d) => d.source === "NTerpret").length} routines`,
    nterpretDrillsLib: DRILLS.filter((d) => d.source === "NTerpret").map((d) => ({ focus: d.focus, minutes: d.minutes, tiedTo: DRILL_TIES[d.focus] ?? d.focus, title: d.title, why: d.why, how: d.how })),

    // ── chat ──
    chatStarted: chat.current.length > 0, chatEmpty: chat.current.length === 0,
    refreshChat: () => { chat.current = []; chatId.current = null; ratedIdx.current = new Set(); savedIdx.current = new Set(); bump(); },
    chatHeaderOn: chat.current.length > 0 || hist.current.length > 0,
    sheetHistory: s.sheet === "history",
    openHistory: () => { s.sheet = "history"; bump(); },
    newChat: () => { chat.current = []; chatId.current = null; ratedIdx.current = new Set(); savedIdx.current = new Set(); draft.current = ""; s.sheet = ""; s.screen = "chat"; bump(); },
    chatHistory: hist.current.map((h) => ({
      title: h.title, when: histAgo(h.at), count: String(h.messages.length),
      active: h.id === chatId.current,
      onOpen: () => {
        chat.current = h.messages; chatId.current = h.id; ratedIdx.current = new Set(); savedIdx.current = new Set();
        try { localStorage.setItem("howie_chat_open_coach", h.id); } catch { /* noop */ }
        s.screen = "chat"; s.sheet = ""; bump();
      },
      onRemove: () => {
        hist.current = hist.current.filter((x) => x.id !== h.id);
        if (chatId.current === h.id) { chat.current = []; chatId.current = null; }
        persistHist(); bump();
      },
    })),
    hasHistory: hist.current.length > 0,
    noHistory: hist.current.length === 0,
    chatRef: "",
    starters: STARTERS.map((t, i) => ({ n: pad(i + 1), text: t, onSend: () => sendPrompt(t) })),
    mlist,
    openSaved: () => { s.sheet = "saved"; bump(); },
    hasNotes: notes.current.length > 0, notesCount: notes.current.length,

    // ── profile ──
    goCoachNterpret: () => { s.screen = "coachNt"; s.sheet = ""; bump(); },
    openInvite: () => { s.sheet = "invite"; bump(); },
    openSupport: () => { s.sheet = "support"; bump(); },
    openSettings: () => { s.sheet = "settings"; bump(); },
    flaggedCount,
    goProfile: () => { s.screen = "profile"; s.sheet = ""; bump(); },
    signOut,

    // ── guides ──
    guides: guidesList, guide: { title: activeGuide?.title ?? "Guide" }, sections,
    goChat: () => { s.screen = "chat"; s.sheet = ""; bump(); },

    // ── practice groups ──
    practiceGroups, hasPending: pendingGroup.length > 0, pendingGroup,
    askGroupAdjust: () => sendPrompt("Can you suggest a different way to split my squad into practice groups?"),

    // ── compare ──
    pickAFor: () => { s.comparePickSlot = "a"; s.sheet = "comparePick"; bump(); },
    pickBFor: () => { s.comparePickSlot = "b"; s.sheet = "comparePick"; bump(); },
    swapCompare: () => { const t = cmpA.id; s.compareA = cmpB.id; s.compareB = t; bump(); },
    compareA: { initials: cmpA.initials, first: cmpA.first, sub: `#${cmpA.num} · ${cmpA.pos}` },
    compareB: { initials: cmpB.initials, first: cmpB.first, sub: `#${cmpB.num} · ${cmpB.pos}` },
    compareRows, comparePositions, comparePickList,

    // ── sheets ──
    sheetOpen: !!s.sheet, closeSheet: () => { s.sheet = ""; bump(); },
    sheetDisclaimer: s.sheet === "disclaimer", sheetCoachNtPrompt: s.sheet === "coachNtPrompt",
    sheetShare: s.sheet === "share", sheetClutchGuide: s.sheet === "clutchGuide", sheetRubric: s.sheet === "rubric",
    sheetQuadrant: s.sheet === "quadrant", sheetComparePick: s.sheet === "comparePick", sheetSaved: s.sheet === "saved",
    sheetSupport: s.sheet === "support", sheetSettings: s.sheet === "settings", sheetInvite: s.sheet === "invite", sheetPartner: s.sheet === "partner",
    // disclaimer — the shared Howie terms (recovered verbatim); accepted once per device
    discTitle: NT_DISCLAIMER.title, discSubtitle: NT_DISCLAIMER.subtitle,
    discIntro: NT_DISCLAIMER.intro, discAcceptance: NT_DISCLAIMER.acceptance,
    discSections: NT_DISCLAIMER.sections.map((sec) => ({ h: sec.h, b: sec.b })),
    closeDisclaimer: () => {
      try { localStorage.setItem("howie_terms_ok", "1"); } catch { /* noop */ }
      api.acceptTerms().catch(() => {});
      s.sheet = ""; bump();
    },
    // coach nterpret prompt sheet
    startCoachNt: () => { s.screen = "coachNt"; s.coachNtSubmitted = false; s.coachNtStep = 0; s.coachNtAnswers = {}; s.sheet = ""; bump(); },
    // share
    shareTargets: SHARE_TARGETS,
    // clutch guide / rubric
    scoreRanges: CLUTCH_TIERS.map((t) => ({ band: t.band, label: t.label, meaning: t.meaning })),
    rubric: ALIGN_RUBRIC.map((r) => ({ label: r.label, range: r.range, short: r.short, color: TONE_COLOR[r.tone], bg: TONE_BG[r.tone] })),
    // quadrant
    quadrant,
    // saved / notes
    addingNote: s.addingNote, notAddingNote: !s.addingNote, noteDraft: s.noteDraft,
    onNoteDraft: (e: unknown) => { s.noteDraft = val(e); },
    startNote: () => { s.addingNote = true; bump(); }, cancelNote: () => { s.addingNote = false; s.noteDraft = ""; bump(); },
    saveOwnNote: () => { const t = s.noteDraft.trim(); if (t) notes.current = [{ id: `own-${Date.now()}`, tag: "Note", tagBg: "#6F6C64", prompt: "", text: t, ago: "just now" }, ...notes.current]; s.addingNote = false; s.noteDraft = ""; bump(); },
    noNotes: notes.current.length === 0,
    notes: notes.current.map((n) => ({ tag: n.tag, tagBg: n.tagBg, prompt: n.prompt, text: n.text, ago: n.ago,
      onBring: () => { draft.current = n.text; s.screen = "chat"; s.sheet = ""; bump(); },
      onRemove: () => { notes.current = notes.current.filter((x) => x.id !== n.id); bump(); } })),
    // support
    supportSent: s.supportSent, supportNotSent: !s.supportSent,
    supportSubject: s.supportSubject, supportMessage: s.supportMessage,
    onSupportSubject: (e: unknown) => { s.supportSubject = val(e); }, onSupportMessage: (e: unknown) => { s.supportMessage = val(e); },
    sendSupport: () => { s.supportSent = true; bump(); },
    // settings
    toggles,
    // invite
    inviteEmail: s.inviteEmail, onInviteEmail: (e: unknown) => { s.inviteEmail = val(e); },
    setRelParent: () => { s.relation = "Assistant"; bump(); }, setRelGuardian: () => { s.relation = "Head Coach"; bump(); },
    relParentBg: s.relation === "Assistant" ? "#0E0E0E" : "#fff", relParentFg: s.relation === "Assistant" ? "#fff" : "#6F6C64",
    relGuardianBg: s.relation === "Head Coach" ? "#0E0E0E" : "#fff", relGuardianFg: s.relation === "Head Coach" ? "#fff" : "#6F6C64",
    inviteError: s.inviteError,
    sendInvite: () => { if (!s.inviteEmail.includes("@")) { s.inviteError = "Enter a valid email address."; } else { s.inviteError = ""; s.inviteEmail = ""; s.sheet = ""; } bump(); },
    // partner picker
    partnerOptions,

    // ── tab bar ──
    homeColor: homeActive ? ACTIVE : MUTED, homeStroke: homeActive ? 2.4 : 1.8,
    rosterColor: rosterActive ? ACTIVE : MUTED, rosterStroke: rosterActive ? 2.4 : 1.8,
    chatColor: chatActive ? ACTIVE : MUTED, chatOpacity: chatActive ? 1 : 0.55,
    profColor: profActive ? ACTIVE : MUTED, profStroke: profActive ? 2.4 : 1.8,

    // ── login / access (screens hidden; handlers present for parity) ──
    statCells: STAT_CELLS,
    enterPortal: () => {}, goAccess: () => {}, goLogin: signOut, enterPortalFromAccess: () => {}, submitAccess: () => {},
    accessForm: true, accessSent: false, accessRostered: true, accessIsOther: false, accessAttested: false, accessError: "", attestBg: "#fff",
    accessOrg: { isAlliance: false, noLogo: true, short: partnerMeta.short, name: partnerMeta.name, sport: partnerMeta.sport },
    access: { email: "", athleteId: "", dob: "", lastName: "" },
    onAccessEmail: () => {}, onAccessId: () => {}, onAccessDob: () => {}, onAccessLast: () => {}, toggleAttest: () => {},
    openPartnerPicker: () => { s.sheet = "partner"; bump(); },
  };

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#F7F6F3", position: "relative" }}>
      <HowieTemplate html={coachHtml} ctx={ctx} rev={rev} />
    </div>
  );
}
