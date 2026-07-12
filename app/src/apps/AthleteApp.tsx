// Athlete app — a faithful port of the recovered athlete controller (the
// DCLogic script embedded at the tail of frontend/src/templates/athlete.html).
// State machine + computed ctx props + verbatim static content tables, rendered
// through the template runtime. Live backend data (Clutch score/tier/zone/date)
// overrides the demo statics; chat runs against the real Howie endpoint.
import { useEffect, useMemo, useRef, useState } from "react";
import athleteHtml from "../templates/athlete.html?raw";
import { HowieTemplate, type Ctx } from "../runtime";
import { NT_DISCLAIMER } from "../disclaimer";
import * as api from "../api";

// ─────────────────────────── static content tables ───────────────────────────
// Ported VERBATIM from the recovered DCLogic script (the ground truth).

// The Player API doesn't expose per-athlete assessment links yet, so the
// retest button opens NTangible's portal until Isaac provides the real URL.
const ASSESS_URL = "https://portal.ntangible.co";

const CLUTCH = {
  score: 788, tier: "GREAT", band: "750 - 799",
  assessed: "December 2025", validity: "Valid through June 2026",
  headline: "You're in the D1 Standard zone.",
  summary: "You have the internal stability and decision-making speed elite college recruiters look for. A few targeted reps separate you from the 800+ Elite bracket.",
};

const CLUTCH_TIERS = [
  { band: "800+", label: "ELITE", here: false, stat: "73% of NCAA athletes in this range earn All-American or All-Conference honors.", meaning: "Elite situational awareness and emotional regulation. Wired to accelerate when pressure peaks." },
  { band: "750 – 799", label: "GREAT", here: true, stat: "Athletes scoring 750+ are 2x more likely to commit to a Division 1 program.", meaning: "The internal stability and decision speed D1 recruiters demand. You're officially in the D1 Standard zone." },
  { band: "725 – 749", label: "ABOVE AVERAGE", here: false, stat: "Where most collegiate starters and top high-school prospects land.", meaning: "You handle pressure well and are on the cusp of top-tier recruit status." },
  { band: "651 – 724", label: "AVERAGE", here: false, stat: "The national high-school average across sports tested is 668.", meaning: "You have the foundation, but consistency under stress is your current ceiling." },
  { band: "650 & under", label: "BELOW AVERAGE", here: false, stat: "Pressure currently disrupts focus or mechanics in game-time situations.", meaning: "Mental resilience is a muscle. It responds fast to deliberate reps." },
];

type DrillDef = { id: string; priority: boolean; title: string; source: string; focus: string; minutes: string; why: string; how: string[]; video?: string };
const DRILLS: DrillDef[] = [
  { id: "focus-interval", priority: true, title: "Focus Interval Training", source: "Clutch Factor", focus: "Focus", minutes: "2–6 min", why: "Hold attention on a single task or cue for a set time, then stretch the duration. Builds the concentration to stay present through high-leverage moments, like stepping in with the game on the line.", how: ["Set a timer for 2 minutes. Fix on one cue (a seam, your breath).", "Every time your mind drifts, name it and return, no judgment.", "Add 30 seconds each session. Work up to 6 minutes."], video: "https://youtu.be/QliFmb9QFbA" },
  { id: "confidence-script", priority: true, title: "Confidence Scripting", source: "Clutch Factor", focus: "Confidence", minutes: "5 min", why: "Write and rehearse short, first-person confidence lines tied to pressure moments. Repeating them rewires self-talk so composure is automatic, not hoped for.", how: ['Write 3 first-person lines ("I\'ve made this play a thousand times").', "Tie each to a specific trigger (runners on, full count).", "Say them out loud before and during practice reps."], video: "https://youtu.be/Qc7q9L_NRlU" },
  { id: "box-breathing", priority: false, title: "Box Breathing Reset", source: "Clutch Factor", focus: "Composure", minutes: "3 min", why: "A four-count breathing pattern that drops your heart rate fast. Your go-to between pitches or before a big at-bat to pull out of fight-or-flight.", how: ["Inhale for 4, hold for 4, exhale for 4, hold for 4.", "Run 3 full cycles with your eyes on one fixed point.", "Pair it with a physical cue (tug your glove) so it triggers on its own in games."], video: "https://youtu.be/tEmt1Znux58" },
  { id: "visualization", priority: false, title: "Visualization Walkthrough", source: "NTerpret", focus: "Visualization", minutes: "5 min", why: "You're a visual learner, so seeing a play before you make it is worth ten verbal reminders. Rehearse success on the screen in your head and the body follows.", how: ["Close your eyes and picture the exact play, first person, full speed.", "Add detail: the dirt, the sound, a clean transfer and throw.", "Run it 3 times the night before and once in warm-ups."] },
  { id: "film-to-field", priority: false, title: "Film-to-Field Review", source: "NTerpret", focus: "Learning", minutes: "10 min", why: "You convert what you see into skill faster than what you hear. Short, focused clips beat long talks, so build the habit of watching one rep, then doing it.", how: ["Pick ONE clip of a rep you want to clean up.", "Watch it 3 times, then name the single thing to change.", "Go do that one thing live before you watch anything else."] },
  { id: "24-hour-rule", priority: false, title: "The 24-Hour Rule", source: "NTerpret", focus: "Recovery", minutes: "After games", why: "You replay mistakes internally for about a day. Give that loop a deadline so it does its job and then lets go, instead of bleeding into the next game.", how: ["Let yourself feel a rough game tonight. No fixing.", "Tomorrow, write the one lesson in a sentence.", "Then close it. The lesson stays, the sting goes."] },
  { id: "side-by-side", priority: false, title: "Side-by-Side Check-In", source: "NTerpret", focus: "Communication", minutes: "5 min", why: "You process before you talk and open up more shoulder-to-shoulder than face-to-face. Use that: hard conversations go better on a walk or a drive than across a table.", how: ["Pick a side-by-side setting (car, walk, warm-up toss).", "Lead with what you noticed, not what you felt, to start.", "Let silence sit. You think before you speak, and that\'s fine."] },
  { id: "process-journal", priority: false, title: "Process Goals Journal", source: "NTerpret", focus: "Motivation", minutes: "3 min", why: "You're driven by getting better, not by the scoreboard. Track process wins (reps, reads, effort) and the growth you care about becomes visible and repeatable.", how: ["After each session, log 1 process win, not a result.", "Compare to who you were last month, never to perfect.", "Reread the list before big games to remember the work is done."] },
];

const NTERPRET = {
  assessed: "December 2025", validity: "Valid through June 2026",
  headline: "How you process the game.",
  summary: "NTerpret maps three independent windows into how you operate as an athlete: how you communicate, how you learn, and what drives you. None is better than another. Together they're your mental scouting report.",
  narrative: "You perform best when you've had time to process and you trust the people around you. You read situations internally before you act, you learn fastest when you can see a rep and then try it, and you measure yourself against your own growth rather than the scoreboard. Pressure you've prepared for sharpens you; surprises and unclear expectations are where you dip.",
  dimensions: [
    { axis: "Communicates", value: "Reserved", scale: "Reserved · Supportive · Expressive · Direct", tagline: "Processes before speaking", body: "You think things through internally before you say them. Silence after a game is you working, not shutting down. You open up more side-by-side (a car, a walk) than face-to-face.", general: "Reserved athletes think before they share. They rarely react in the heat of the moment and do their best processing in low-pressure, one-on-one settings rather than in front of a group.", strength: "Steady under noise. You rarely say something you regret in the heat of a moment.", watch: "Coaches and parents can read your quiet as disinterest. A short \"I'm still thinking\" keeps them with you." },
    { axis: "Learns", value: "Visual", scale: "Visual · Auditory · Kinesthetic", tagline: "Sees it, then does it", body: "You convert what you see into skill. One clear rep on film is worth ten spoken cues. Demonstration and imagery land for you where long explanations slide off.", general: "Visual learners absorb through what they observe. They pick a skill up fastest when it's shown before it's described, and they hold corrections better from a clip than from a conversation.", strength: "Fast at copying mechanics once you can see them clearly.", watch: "Verbal-only instruction fades quickly. Ask to be shown, or pull a clip." },
    { axis: "Driven By", value: "Intrinsic Growth", scale: "Intrinsic Growth · Competitive Edge · Team Commitment · Recognition", tagline: "Runs on getting better", body: 'Your fuel is improvement, not trophies or praise. You measure yourself against your own progress. "What did I learn?" motivates you more than "did we win?"', general: "Athletes anchored by Intrinsic Growth are driven by mastery. Their motivation holds through slumps because it doesn't ride on results, and they respond best to challenges framed as progress.", strength: "Resilient through slumps. Your motivation does not depend on results going your way.", watch: "External hype can feel hollow or even add pressure. Keep your own process goals front and center." },
  ],
  growthAreas: [
    { title: "Unclear roles rattle you", body: "Last-minute changes or fuzzy expectations can start a spiral. A short pre-game routine that re-centers on what's in your control cuts that short before it builds." },
    { title: "Slow to trust new coaching", body: "It takes you time to open up to a new coach. Naming how you process, and stacking a few early wins, shortens that window and speeds your adaptation." },
  ],
  hacks: [
    { when: "Pre-Game", body: 'Lock in with a 3-word role cue before first pitch ("see it, trust it, go"). It settles your responsibilities and speeds your first decision.' },
    { when: "Post-Game", body: "Run a 10-second reset after the final out: one slow breath, one honest note on what went well, one intention for next game. Then let the rest wait a day." },
    { when: "Practice", body: "Keep a short checklist each session: 2 things to reinforce, 1 skill to drill. It aims your reps at what matters and builds confidence through intention." },
  ],
  afterMistakes: "You replay mistakes internally for roughly a day. You don't need a same-night breakdown, you're already running the loop. Give it 24 hours, pull one lesson, then let it go. When you revisit, a clip beats a lecture.",
};

const PLAYBOOK = [
  { icon: "mega", title: "The Recruiting Bio", body: "Treat this like your SAT for sports. Put your verified Clutch Factor on your X and Instagram bios and the opening frame of your Hudl reel." },
  { icon: "mail", title: "The Coach Outreach", body: "Coaches fear the transfer portal. Attach this report to recruiting emails to prove, mathematically, you won't fold under pressure." },
  { icon: "shield", title: "The NIL Advantage", body: "Brands want reliable ambassadors. Use your Elite or Great classification in NIL pitches to show you're built for the spotlight." },
];

type PartnerDef = { id: string; name: string; short: string; sport: string; logo: string | null; idLabel: string };
const PARTNERS: PartnerDef[] = [
  { id: "alliance", name: "Alliance Fastpitch", short: "Alliance", sport: "Softball · 8U–18U", logo: "assets/alliance-fastpitch.png", idLabel: "Alliance #" },
  { id: "fss", name: "Future Stars Series", short: "Future Stars", sport: "Baseball · Scouting", logo: null, idLabel: "FSS Player #" },
  { id: "pg", name: "Perfect Game", short: "Perfect Game", sport: "Baseball / Softball", logo: null, idLabel: "PG Cohort #" },
  { id: "usssa", name: "USSSA", short: "USSSA", sport: "Multi-sport", logo: null, idLabel: "Member #" },
  { id: "other", name: "My organization isn't listed", short: "Other", sport: "Request manually", logo: null, idLabel: "Org #" },
];
const getPartner = (id: string): PartnerDef => PARTNERS.find((p) => p.id === id) || PARTNERS[0];

const statCells = [
  { k: "OPS", v: "8.70" }, { k: "WHIP", v: "2.10" }, { k: "FIP", v: "9.90" }, { k: "WAR", v: "9.70" },
  { k: "ISO", v: "3.60" }, { k: "BABIP", v: "0.29" }, { k: "K%", v: "1.00" }, { k: "EV", v: "7.50" },
  { k: "SLG", v: "5.00" }, { k: "LA", v: "1.30" }, { k: "ERA", v: "6.10" }, { k: "GB%", v: "3.70" },
];

const QUICK = [
  { label: "Pre-game nerves", say: "I get really nervous before big games. How do I settle down?" },
  { label: "Reset after a mistake", say: "I made an error and couldn't shake it the rest of the game. How do I reset faster?" },
  { label: "Big-game pressure", say: "I have a showcase this weekend and the pressure is getting to me. Help." },
  { label: "Confidence dip", say: "My confidence is shot after a slump. Where do I start?" },
];

const STARTERS = [
  "I get nervous on the field with the game on the line. How do I settle down?",
  "How do I reset after an error instead of spiraling?",
  "I have a big showcase this weekend. How do I handle the pressure?",
  "My confidence is shot after a rough stretch. Where do I start?",
];

type GuideSection = { heading: string; body: string; say?: string[]; avoid?: string[] };
type GuideDef = { slug: string; title: string; blurb: string; sections: GuideSection[] };
const GUIDES: GuideDef[] = [
  { slug: "the-mental-game", title: "The Mental Game", blurb: "Why the inner game decides the outer one. Start here.", sections: [
    { heading: "Your body shows up trained. Does your mind?", body: "You've put in years of physical reps. The mental side — focus, composure, confidence, resilience — is just as trainable, and at your level it's usually what separates players of equal skill. Clutch Factor measures exactly that part of your game." },
    { heading: "Control the controllables", body: "You can't control the ref, the weather, the other team, or whether the ball bounces your way. You can control your effort, your attitude, your preparation, and how you respond. Spend your energy there and the noise gets quieter.", say: ["Before you react to a bad call, ask yourself: \"Is this in my control?\" If not, let it go and play the next rep."] },
    { heading: "The next play is the only one that matters", body: "Every athlete makes mistakes. What separates the great ones is how fast they reset. A short memory after a bad play is a skill you can build, and it's worth more than any single highlight.", say: ["\"Next play.\" Say it out loud, reset your feet, and go."] },
  ] },
  { slug: "before-you-compete", title: "Before You Compete", blurb: "Settle the nerves and walk in ready.", sections: [
    { heading: "Nerves mean you care", body: "That jittery feeling before a big game isn't a problem to fix — it's your body getting ready. Reframe it: this is energy, not fear. The goal isn't to feel calm, it's to feel ready." },
    { heading: "Build a routine you trust", body: "A consistent pre-game routine — same warm-up, same music, the same few cues — gives your brain something stable to hold when the stakes go up. Keep it simple and run it every single time.", say: ["Pick three cues: one breath, one body reset, one word. Run them before every game until they're automatic."] },
    { heading: "Picture it before you do it", body: "If seeing a play helps it click, you're a visual learner — use it. Spend two minutes picturing yourself executing in first person, full speed, succeeding. Your brain rehearses the rep without the wear on your body." },
  ] },
  { slug: "after-a-bad-game", title: "After a Bad Game", blurb: "Reset, learn, and let it go.", sections: [
    { heading: "Feel it, then file it", body: "You're allowed to be frustrated. Give yourself a set window — the car ride, the shower — to be mad about it. Then close the file. Carrying a bad game into the next week costs you two games instead of one." },
    { heading: "Separate the mistake from you", body: "You made a bad play. That doesn't make you a bad player. Talk to yourself the way you'd talk to a teammate who messed up — honest, but on your side.", avoid: ["Replaying the worst moment on a loop. Once to learn from it, then stop.", "Comparing yourself to a teammate. Compare yourself to who you were last month."] },
    { heading: "Find the one thing", body: "Don't try to fix everything at once. Pull one lesson from the game, write it down, and bring it to practice. One real adjustment beats ten regrets." },
  ] },
  { slug: "your-profile", title: "Your NTerpret™ Profile", blurb: "What your mental scouting report says, and how to use it.", sections: [
    { heading: "Three windows into how you operate", body: "NTerpret maps how you communicate, how you learn, and what drives you. None is better than another — they're just true about you. Knowing them helps you ask for what you actually need." },
    { heading: "Use it to ask for what helps you", body: "If you learn best by seeing, ask your coach for film or a demo instead of a long explanation. If you're driven by growth, track your own progress instead of waiting on praise. Your profile is a tool for self-advocacy.", say: ["\"Coach, it helps me to see it once before I try it — can you show me?\""] },
    { heading: "It's a starting point, not a label", body: "If something in your profile doesn't sound like you, trust yourself. It's a hypothesis to test on the field, not a box to live in." },
  ] },
  { slug: "talking-to-your-coach", title: "Talking to Your Coach", blurb: "Playing time, feedback, and the hard conversations.", sections: [
    { heading: "Ask about your control, not your minutes", body: "If you're not playing as much as you want, the worst move is to complain about minutes. The best move is to ask what you can control. Coaches respect players who want to get better more than players who want to be told they're good.", say: ["\"What's the one thing I can work on this week to earn more time?\""] },
    { heading: "Take feedback as information, not insult", body: "Hard coaching usually means a coach believes you can handle more. Hear the content, not the tone. The players who improve fastest are the ones who can take a correction without taking it personally." },
    { heading: "Bring solutions, not just feelings", body: "It's fine to be frustrated, but walk in with a question or a plan, not just an emotion. You'll be taken more seriously, and you'll usually walk out with something useful." },
  ] },
  { slug: "pressure-and-confidence", title: "Pressure & Confidence", blurb: "Perform when it counts most.", sections: [
    { heading: "Confidence is built, not summoned", body: "You don't find confidence in the big moment — you arrive with it, built from reps you can point to. Keep a short mental list of times you've come through. That's your evidence when doubt shows up.", say: ["Before a clutch moment: \"I've done this before.\" Then trust your training and let it go."] },
    { heading: "Slow your breath, slow the moment", body: "Under pressure your heart rate spikes and the game speeds up. A few slow breaths — in for four, out for four — pull you back to your pace. It's the fastest reset you have." },
    { heading: "Want the moment", body: "The best competitors don't hope the ball doesn't come to them — they want it. Decide before the game that you want to be the one who takes the shot. That decision is half the battle." },
  ] },
];

const THINKING = ["Taking a beat", "Checking the playbook", "Reading the moment", "Finding the right words", "Re-reading the profile", "Sitting with it", "Choosing the words that land", "Working the problem"];

const GAMEDAY_OPENER = "Game day. Let's get you locked in before you walk on. You're at your best when you slow the moment down and trust your reps, that's your edge under pressure. So tell me, what are one or two things on your mind right now? A matchup you're weighing, nerves you want to shake, or just dialing in your focus.";

// Static trend diff rows (per-dimension deltas between last two assessments).
// These are verbatim from the DCLogic script — the backend doesn't provide
// per-dimension deltas, so these remain seed values.
const TREND_DIFF = [
  { label: "Composure", note: "Holding steady after mistakes", val: 18 },
  { label: "Focus", note: "Locking back in between pitches", val: 9 },
  { label: "Confidence", note: "Trusting your swing under pressure", val: 6 },
  { label: "Resilience", note: "Bouncing back inning to inning", val: -4 },
].map((d) => ({ ...d, abs: Math.abs(d.val), arrow: d.val >= 0 ? "↑" : "↓", color: d.val >= 0 ? "#1F7A4D" : "#B4261F" }));

// ─────────────────────────── helpers (ported logic) ───────────────────────────

function pickAck(content: string): string {
  const c = content.toLowerCase();
  if (/(nervous|anxious|nerves|shaky|jittery|scared)/.test(c)) return "Totally normal. Let's give those nerves a job. One sec.";
  if (/(error|mistake|spiral|messed up|choke|choked|booted)/.test(c)) return "Happens to everyone who competes. Let's build the reset. Hang on.";
  if (/(confidence|slump|doubt|in my head|lost it)/.test(c)) return "Confidence is trainable, not a mood. Let me think.";
  if (/(showcase|big game|tryout|recruit|tournament|pressure)/.test(c)) return "Big stage. Let's get you ready for it. One beat.";
  return "Good question. Let me pull from the playbook.";
}

// Clutch ladder: score range → { label, band, zone copy, summary }. GREAT uses
// the ground-truth CLUTCH copy; the other tiers derive zone copy from the ladder
// meaning strings. Derived client-side from OUR live score (backend tier strings
// are unreliable and ignored per spec).
function ladderFor(score: number) {
  if (score >= 800) return { label: "ELITE", band: "800+", zone: "You're in the 800+ Elite bracket.", summary: CLUTCH_TIERS[0].meaning, index: 0 };
  if (score >= 750) return { label: "GREAT", band: "750 - 799", zone: CLUTCH.headline, summary: CLUTCH.summary, index: 1 };
  if (score >= 725) return { label: "ABOVE AVERAGE", band: "725 - 749", zone: "You're on the cusp of the D1 Standard zone.", summary: CLUTCH_TIERS[2].meaning, index: 2 };
  if (score >= 651) return { label: "AVERAGE", band: "651 - 724", zone: "You have the foundation to build on.", summary: CLUTCH_TIERS[3].meaning, index: 3 };
  return { label: "BELOW AVERAGE", band: "650 & under", zone: "Your mental game is ready to train.", summary: CLUTCH_TIERS[4].meaning, index: 4 };
}

function fmtAssessed(iso?: string): string {
  if (!iso) return "Dec 2025";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Dec 2025";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  return Math.floor(d / 86400) + "d ago";
}

const val = (e: unknown) => ((e as Event).target as HTMLInputElement | null)?.value ?? "";

// The recovered login markup hardcodes read-only demo credentials and wires
// "Enter portal" to a client-only navigation. We have a real backend, so bind
// the email/invite fields and add a notice slot (template file untouched).
function withLoginBindings(html: string): string {
  return html
    .replace(
      'value="maya@example.com" readonly=""',
      'type="email" value="{{ loginEmail }}" oninput="{{ onLoginEmail }}" placeholder="you@example.com"',
    )
    .replace(
      'value="DEMO2026" readonly=""',
      'value="{{ loginCode }}" oninput="{{ onLoginCode }}" placeholder="Invite code"',
    )
    .replace(
      ">First time? Get access</button>",
      ">First time? Get access</button><sc-if value=\"{{ loginNotice }}\"><span style=\"flex-basis:100%; margin-top:10px; font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#6F6C64\">{{ loginNotice }}</span></sc-if>",
    );
}

// ─────────────────────────── types ───────────────────────────

type ChatMsg = { role: "user" | "assistant"; content: string; id?: string; rated?: boolean; saved?: boolean; ack?: string; word?: string; thinking?: boolean };
type ChatThread = { id: string; title: string; at: number; messages: ChatMsg[] };
type Note = { id: string; prompt: string; text: string; at: number; mine?: boolean };
type ParentRow = { id: string; name: string; email: string; relation: string; status: string; since: string };
type Access = { org: string; email: string; athleteId: string; dob: string; lastName: string; attested: boolean; sent: boolean; error: string };
type HistoryRow = { date: string; score: number; label: string };

// Seed history used when the live API has no history data.
// Verbatim from the DCLogic script clutchHistory initial state.
const CLUTCH_HISTORY_SEED: HistoryRow[] = [
  { date: "Jun 2025", score: 742, label: "Above Average" },
  { date: "Dec 2025", score: 788, label: "Great" },
];

// ─────────────────────────── component ───────────────────────────

export function AthleteApp({ session, onSignedIn, signOut }: {
  session: api.Session | null;
  onSignedIn: (s: api.Session) => void;
  signOut: () => void;
}) {
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);

  const name = session?.name?.trim() ?? "";
  const email = session?.email?.trim() ?? "";
  // Real team name (from /me/profile) personalizes the profile screen's
  // hardcoded demo card (Thunder 16U / Softball · Shortstop / AF ids).
  const [org, setOrg] = useState("");
  const html = useMemo(() => {
    let h = withLoginBindings(athleteHtml);
    // The template's demo copy references a fictional assessment domain; the
    // button actually opens the real portal (see ASSESS_URL).
    h = h.replaceAll("assess.ntangible.co", "portal.ntangible.co");
    if (name) h = h.replaceAll("Maya Reyes", name).replaceAll("Maya", name.split(" ")[0]);
    if (email) h = h.replaceAll("maya.reyes@email.com", email);
    if (session) {
      // Demo-only personal details we have no real data for.
      h = h.replaceAll("(804) 555-0147", "—");
    }
    if (org) {
      h = h.replaceAll("Thunder 16U", org)
        .replaceAll("Softball · Shortstop", "Synced account")
        .replaceAll("AF-2291046", "—").replaceAll("AF-THU16U-26", "—")
        .replace("Pulled from Alliance Fastpitch · read only", "Pulled from NTangible · read only");
    }
    // The "What moved" dimension deltas are demo content — only meaningful
    // with 2+ assessments, so make the header conditional (rows already are).
    h = h.replace(
      /(<p[^>]*>What moved since \{\{ trendPrev\.date \}\}<\/p>)/,
      '<sc-if value="{{ hasTrendDiff }}">$1</sc-if>',
    );
    return h;
  }, [name, email, session, org]);

  const ui = useRef({
    screen: "home",
    sheet: null as string | null,
    assessStep: "intro" as "intro" | "web" | "submitting" | "done",
    obStep: 0,
    onboarded: typeof localStorage !== "undefined" && !!localStorage.getItem("howie_ob_done"),
    reportTab: "clutch",
    expanded: {} as Record<string, boolean>,
    guideSlug: null as string | null,
    input: "",
    busy: false,
    loginEmail: "",
    loginCode: "",
    loginNotice: "",
    learnTopic: "tier",
    partner: "alliance",
    access: { org: "alliance", email: "", athleteId: "", dob: "", lastName: "", attested: false, sent: false, error: "" } as Access,
    inviteEmail: "",
    inviteRelation: "Parent",
    inviteError: "",
    supportSubject: "",
    supportMessage: "",
    supportSent: false,
    settings: { reminders: true, reduced: false, saveLocal: true } as Record<string, boolean>,
    parents: [] as ParentRow[],
    notes: [] as Note[],
    addingNote: false,
    noteDraft: "",
    highlightPhoto: null as string | null,
  });
  const data = useRef<{ clutch?: api.ClutchFactor; nterpret?: api.NTerpret; drills?: api.DrillLibrary; guides?: api.Guide[] }>({});
  const chat = useRef<ChatMsg[]>([]);
  // Full chat history, kept on this device only (never sent to the server).
  const hist = useRef<ChatThread[]>([]);
  const chatId = useRef<string | null>(null);

  // On sign-in, land on home and pick up the onboarding flag. Returning users
  // who finished the intro but never accepted the Howie terms get the consent
  // sheet immediately (new users get it when the intro ends — see finishOnboard).
  useEffect(() => {
    if (!session) return;
    ui.current.onboarded = !!localStorage.getItem("howie_ob_done");
    if (ui.current.screen === "login" || ui.current.screen === "access") ui.current.screen = "home";
    if (ui.current.onboarded && !localStorage.getItem("howie_terms_ok")) ui.current.sheet = "disclaimer";
    // Saved notes are device-local, per account.
    try {
      const raw = localStorage.getItem("howie_notes_" + session.email);
      ui.current.notes = raw ? (JSON.parse(raw) as Note[]) : [];
    } catch { ui.current.notes = []; }
    // Chat history too — resume the most recent conversation.
    try {
      const raw = localStorage.getItem("howie_chats_" + session.email);
      hist.current = raw ? (JSON.parse(raw) as ChatThread[]) : [];
    } catch { hist.current = []; }
    if (hist.current.length && chat.current.length === 0) {
      const lastOpen = localStorage.getItem("howie_chat_open_" + session.email);
      const resume = hist.current.find((t) => t.id === lastOpen) ?? hist.current[0];
      chat.current = resume.messages;
      chatId.current = resume.id;
    }
    // Restore the highlight-card photo they uploaded before.
    try { ui.current.highlightPhoto = localStorage.getItem("howie_photo_" + session.email); } catch { /* noop */ }
    bump();
  }, [session]);

  // Live data only when authenticated (the login screen must not fire calls).
  useEffect(() => {
    if (!session) return;
    Promise.all([api.myClutchFactor(), api.myNTerpret(), api.myDrills(), api.guides()])
      .then(([clutch, nterpret, drills, guides]) => {
        data.current = { clutch, nterpret, drills, guides };
        bump();
      })
      .catch(() => bump());
    api.myProfile().then((p) => { if (p.org) setOrg(p.org); }).catch(() => {});
    // Real linked parents replace the demo seed rows when the API answers.
    api.myParents()
      .then((rows) => {
        ui.current.parents = rows.map((p) => (
          { id: p.email, name: p.name, email: p.email, relation: p.relation, status: p.status as ParentRow["status"], since: p.since }
        ));
        bump();
      })
      .catch(() => {});
  }, [session]);

  // ── navigation ──
  const go = (screen: string) => { ui.current.screen = screen; ui.current.sheet = null; bump(); };
  const goReports = (tab: string) => { ui.current.screen = "reports"; ui.current.reportTab = tab; ui.current.sheet = null; bump(); };
  const openSheet = (sheet: string) => { ui.current.sheet = sheet; bump(); };
  const closeSheet = () => { ui.current.sheet = null; bump(); };
  const toggle = (key: string) => { ui.current.expanded[key] = !ui.current.expanded[key]; bump(); };
  const goBack = () => { ui.current.screen = ui.current.screen === "guide" ? "guides" : "home"; ui.current.sheet = null; bump(); };
  const openGuide = (slug: string) => { ui.current.guideSlug = slug; ui.current.screen = "guide"; ui.current.sheet = null; bump(); };

  // ── chat (live Howie backend) ──
  async function ask(text: string) {
    const content = text.trim();
    if (!content || ui.current.busy) return;
    const ack = pickAck(content);
    const word = THINKING[Math.floor(Math.random() * THINKING.length)];
    const history = chat.current.filter((m) => !m.thinking && m.content).map((m) => ({ role: m.role, content: m.content }));
    chat.current = [...chat.current, { role: "user", content }, { role: "assistant", content: "", ack, word, thinking: true }];
    ui.current.screen = "chat";
    ui.current.busy = true;
    syncThread();
    bump();
    try {
      const r = await api.howieChat(content, "athlete", history);
      chat.current = chat.current.map((m, i) => (i === chat.current.length - 1 ? { role: "assistant", content: r.reply, id: r.message_id, ack, word } : m));
    } catch {
      chat.current = chat.current.map((m, i) => (i === chat.current.length - 1 ? { role: "assistant", content: "I hit a snag — try again in a moment.", ack, word } : m));
    }
    ui.current.busy = false;
    syncThread();
    bump();
  }

  async function askFrom(text: string) {
    chat.current = [];
    chatId.current = null;
    ui.current.busy = false;
    await ask(text);
  }

  function startGameDay() {
    chat.current = [{ role: "assistant", content: GAMEDAY_OPENER }];
    chatId.current = null;
    ui.current.screen = "chat";
    ui.current.input = "";
    ui.current.busy = false;
    syncThread();
    bump();
  }

  function submitAsk() { const t = ui.current.input; ui.current.input = ""; askFrom(t); }
  function submitChat() { const t = ui.current.input; ui.current.input = ""; ask(t); }
  function refreshChat() { chat.current = []; chatId.current = null; ui.current.input = ""; ui.current.busy = false; bump(); }

  // ── chat history (device-local, per account) ──
  const histKey = () => "howie_chats_" + (session?.email ?? "");
  const persistHist = () => {
    if (!session) return;
    try { localStorage.setItem(histKey(), JSON.stringify(hist.current.slice(0, 50))); } catch { /* noop */ }
  };
  function syncThread() {
    const msgs = chat.current.filter((m) => !m.thinking);
    if (!msgs.length) return;
    const firstUser = msgs.find((m) => m.role === "user");
    const title = (firstUser?.content || msgs[0].content || "Conversation").slice(0, 60);
    if (!chatId.current) chatId.current = "c" + Date.now();
    const t: ChatThread = { id: chatId.current, title, at: Date.now(), messages: msgs };
    hist.current = [t, ...hist.current.filter((x) => x.id !== t.id)];
    try { if (session) localStorage.setItem("howie_chat_open_" + session.email, t.id); } catch { /* noop */ }
    persistHist();
  }

  function rate(i: number, dir: string) {
    const m = chat.current[i];
    if (!m || m.rated) return;
    chat.current = chat.current.map((x, idx) => (idx === i ? { ...x, rated: true } : x));
    if (m.id) api.howieFeedback(m.id, dir === "up").catch(() => {});
    syncThread();
    bump();
  }
  function keep(i: number) {
    const m = chat.current[i];
    if (!m || m.saved) return;
    const prompt = chat.current[i - 1] ? chat.current[i - 1].content : "";
    chat.current = chat.current.map((x, idx) => (idx === i ? { ...x, saved: true } : x));
    ui.current.notes = [{ id: "k" + i + Date.now(), prompt, text: m.content, at: Date.now() }, ...ui.current.notes];
    persistNotes();
    syncThread();
    bump();
  }

  // ── saved notes ──
  const persistNotes = () => {
    if (!session) return;
    try { localStorage.setItem("howie_notes_" + session.email, JSON.stringify(ui.current.notes)); } catch { /* noop */ }
  };
  const openSaved = () => { ui.current.sheet = "saved"; ui.current.addingNote = false; ui.current.noteDraft = ""; bump(); };
  const startNote = () => { ui.current.addingNote = true; bump(); };
  const cancelNote = () => { ui.current.addingNote = false; ui.current.noteDraft = ""; bump(); };
  const saveOwnNote = () => {
    const text = ui.current.noteDraft.trim();
    if (!text) return;
    ui.current.notes = [{ id: "own" + Date.now(), prompt: "", text, at: Date.now(), mine: true }, ...ui.current.notes];
    ui.current.addingNote = false; ui.current.noteDraft = ""; persistNotes(); bump();
  };
  const removeNote = (id: string) => { ui.current.notes = ui.current.notes.filter((n) => n.id !== id); persistNotes(); bump(); };
  const bringToChat = (note: Note) => { ui.current.sheet = null; askFrom('Earlier I saved this: "' + note.text + '" Help me put it into practice.'); };

  // ── login / access ──
  async function enterPortal() {
    const email = ui.current.loginEmail.trim();
    const code = ui.current.loginCode.trim();
    if (!email) { ui.current.loginNotice = "Enter your email to continue."; bump(); return; }
    try {
      if (code) {
        // Real accounts: the access code from the provisioning/invite email.
        const s = await api.login(email, code);
        api.setToken(s.session_token);
        ui.current.screen = "home";
        onSignedIn(s);
        return;
      }
      // No code: dev/demo path (magic-link flow; auto-verifies in dev).
      const r = await api.requestLink(email);
      if (r.dev_token) {
        const s = await api.verify(r.dev_token);
        api.setToken(s.session_token);
        ui.current.screen = "home";
        onSignedIn(s);
      } else {
        ui.current.loginNotice = "Check your email for a sign-in link.";
        bump();
      }
    } catch (err) {
      const msg = err instanceof Error && /401|wrong/i.test(err.message)
        ? "Wrong email or access code."
        : "That didn't work. Check the details and try again.";
      ui.current.loginNotice = msg;
      bump();
    }
  }
  const goAccess = () => { ui.current.screen = "access"; ui.current.sheet = null; bump(); };
  const goLogin = () => { ui.current.screen = "login"; ui.current.sheet = null; ui.current.access = { ...ui.current.access, sent: false, error: "" }; bump(); };
  const selectPartner = (id: string) => { ui.current.access = { ...ui.current.access, org: id, error: "" }; ui.current.sheet = null; bump(); };
  function submitAccess() {
    const a = ui.current.access;
    let error = "";
    if (!a.email.includes("@")) error = "Enter a valid email address.";
    else if (a.org !== "other" && (!a.athleteId.trim() || !a.dob.trim() || !a.lastName.trim())) error = "All athlete fields are required to match the roster.";
    else if (!a.attested) error = "Please confirm this is your athlete profile.";
    if (error) { ui.current.access = { ...a, error }; bump(); return; }
    ui.current.access = { ...a, sent: true, error: "" }; bump();
  }

  // ── parent invites (real: creates the parent's account, links it to this
  // athlete, and emails their access code — see backend /me/parents) ──
  const toRow = (p: api.ParentEntry): ParentRow => (
    { id: p.email, name: p.name, email: p.email, relation: p.relation, status: p.status as ParentRow["status"], since: p.since }
  );
  const sendInvite = async () => {
    const email = ui.current.inviteEmail.trim();
    if (!email.includes("@")) { ui.current.inviteError = "Enter a valid email address."; bump(); return; }
    try {
      const r = await api.inviteParent(email, ui.current.inviteRelation);
      ui.current.parents = [...ui.current.parents.filter((p) => p.email !== r.parent.email), toRow(r.parent)];
      ui.current.inviteEmail = "";
      if (r.dev_code) {
        // No email delivery yet — surface the code so it can be shared by hand.
        ui.current.inviteError = `Access code: ${r.dev_code} — share it with them (email delivery pending).`;
      } else {
        ui.current.sheet = null; ui.current.inviteError = "";
      }
    } catch (err) {
      ui.current.inviteError = err instanceof Error && /403/.test(err.message)
        ? "Only athletes can invite parents."
        : "Couldn't send the invite. Try again.";
    }
    bump();
  };
  const revokeParent = (id: string) => {
    ui.current.parents = ui.current.parents.filter((p) => p.id !== id); bump();
    api.revokeParent(id).catch(() => {});
  };

  // ── support ──
  const sendSupport = () => {
    const subj = ui.current.supportSubject.trim() || "Player app support";
    const msg = ui.current.supportMessage.trim();
    const body = msg + "\n\n- Sent from the NTangible Player app (" + (name || "Maya Reyes") + ")";
    try { window.location.href = "mailto:support@ntangible.co?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body); } catch { /* noop */ }
    ui.current.supportSent = true; bump();
  };

  // ── onboarding ──
  // Finishing the intro opens the Howie terms sheet once per device (the demo's
  // "I Accept" consent gate); acceptance is also logged against the account.
  const termsAccepted = () => { try { return !!localStorage.getItem("howie_terms_ok"); } catch { return true; } };
  const finishOnboard = () => {
    try { localStorage.setItem("howie_ob_done", "1"); } catch { /* noop */ }
    ui.current.onboarded = true; ui.current.obStep = 0;
    if (!termsAccepted()) ui.current.sheet = "disclaimer";
    bump();
  };
  const obNext = () => { const s = ui.current.obStep; if (s >= 2) finishOnboard(); else { ui.current.obStep = s + 1; bump(); } };

  // ── highlight card (share) ──
  const onHighlightPhoto = (e: unknown) => {
    const input = (e as Event).target as HTMLInputElement | null;
    const f = input?.files && input.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale before storing so the remembered photo fits localStorage.
        const max = 1080;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        const g = c.getContext("2d");
        const url = g ? (g.drawImage(img, 0, 0, c.width, c.height), c.toDataURL("image/jpeg", 0.85)) : String(reader.result);
        ui.current.highlightPhoto = url;
        if (session) { try { localStorage.setItem("howie_photo_" + session.email, url); } catch { /* too large to remember — still usable this session */ } }
        bump();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  // ── derived clutch (live score → tier/zone/date via the ported ladder) ──
  const s = ui.current;
  const loggedIn = !!session;
  const screen = loggedIn && (s.screen === "login" || s.screen === "access") ? "home" : s.screen;
  const cf = data.current.clutch;
  const liveScore = cf?.score ?? CLUTCH.score;
  const lad = ladderFor(liveScore);
  const assessed = fmtAssessed(cf?.updated_at);
  const validity = cf?.updated_at
    ? (() => {
        const d = new Date(cf.updated_at);
        d.setMonth(d.getMonth() + 6);
        return "Valid through " + d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      })()
    : CLUTCH.validity;
  const clutch = { score: liveScore, tier: lad.label, band: lad.band, headline: lad.zone, summary: lad.summary, validity, assessed };
  const clutchPct = Math.round(liveScore / 10);

  // Build history for the trend screen: live if available, else the seed rows.
  // ClutchPoint has { date: string, score: number } (ISO date strings from the API).
  const rawHistory: HistoryRow[] = cf?.history?.length
    ? cf.history.map((p) => {
        const l = ladderFor(p.score);
        return { score: p.score, date: fmtAssessed(p.date), label: l.label.charAt(0) + l.label.slice(1).toLowerCase() };
      })
    : CLUTCH_HISTORY_SEED;
  const histLatest = rawHistory[rawHistory.length - 1];
  const histPrev = rawHistory.length > 1 ? rawHistory[rawHistory.length - 2] : null;
  const histFirst = rawHistory[0];
  const trendDelta = histPrev ? histLatest.score - histPrev.score : 0;
  const trendScores = rawHistory.map((p) => p.score);
  const trendMin = Math.min(...trendScores) - 20;
  const trendMax = Math.max(...trendScores) + 20;
  const TW = 280, TH = 120, TN = rawHistory.length;
  const trendPoints = rawHistory.map((p, i) => ({
    x: TN === 1 ? TW / 2 : (i / (TN - 1)) * TW,
    y: TH - ((p.score - trendMin) / (trendMax - trendMin)) * TH,
    score: p.score, date: p.date, label: p.label,
  }));
  const trendPoly = trendPoints.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const trendLatest = histLatest;
  const trendFirst = histFirst;

  const guideObj = s.guideSlug ? GUIDES.find((g) => g.slug === s.guideSlug) : null;
  const step = s.obStep;
  const priorityClutch = DRILLS.filter((d) => d.source === "Clutch Factor" && d.priority);
  const highlightPhoto = s.highlightPhoto;

  const ctx: Ctx = {
    // ── auth / top-level screens ──
    isLogin: !loggedIn && s.screen !== "access",
    isAccess: !loggedIn && s.screen === "access",
    appView: loggedIn,
    isHome: loggedIn && screen === "home",
    isReports: screen === "reports",
    isChat: screen === "chat",
    isProfile: screen === "profile",
    isGuides: screen === "guides",
    isGuide: screen === "guide",
    isReveal: screen === "reveal",

    // ── onboarding ──
    showOnboard: loggedIn && !s.onboarded,
    ob0: step === 0, ob1: step === 1, ob2: step === 2,
    obDots: [0, 1, 2].map((i) => ({ bg: i === step ? "#0E0E0E" : "#D8D4CC", w: i === step ? "22px" : "7px" })),
    obCta: step === 2 ? "Let's get started" : "Next",
    obNext, obSkip: finishOnboard,

    // ── login ──
    loginEmail: s.loginEmail, loginCode: s.loginCode, loginNotice: s.loginNotice,
    onLoginEmail: (e: unknown) => { s.loginEmail = val(e); },
    onLoginCode: (e: unknown) => { s.loginCode = val(e); },
    enterPortal, goAccess, goLogin,

    // ── access / registration ──
    access: s.access,
    accessSent: s.access.sent,
    accessForm: !s.access.sent,
    accessError: s.access.error,
    accessAttested: s.access.attested,
    accessIsOther: s.access.org === "other",
    accessRostered: s.access.org !== "other",
    accessOrg: (() => { const p = getPartner(s.access.org); return { ...p, hasLogo: !!p.logo, noLogo: !p.logo, isAlliance: p.id === "alliance" }; })(),
    partnerOptions: PARTNERS.map((p) => ({ ...p, hasLogo: !!p.logo, noLogo: !p.logo, isAlliance: p.id === "alliance", selected: p.id === s.access.org, onSelect: () => selectPartner(p.id) })),
    attestBg: s.access.attested ? "#0E0E0E" : "#fff",
    onAccessEmail: (e: unknown) => { s.access.email = val(e); },
    onAccessId: (e: unknown) => { s.access.athleteId = val(e); },
    onAccessDob: (e: unknown) => { s.access.dob = val(e); },
    onAccessLast: (e: unknown) => { s.access.lastName = val(e); },
    toggleAttest: () => { s.access.attested = !s.access.attested; bump(); },
    submitAccess,
    enterPortalFromAccess: goLogin,

    // ── partner theming (in-app chrome) ──
    activePartner: (() => { const p = getPartner(s.partner); return { ...p, hasLogo: !!p.logo, noLogo: !p.logo, isAlliance: p.id === "alliance" }; })(),
    openPartnerPicker: () => openSheet("partner"),

    // ── nav / back ──
    showBack: screen === "guides" || screen === "guide",
    goHome: () => go("home"), goChat: () => go("chat"), goProfile: () => go("profile"),
    goGuides: () => go("guides"), goBack,
    goClutch: () => goReports("clutch"), goReports: () => goReports("clutch"),
    goDrills: () => goReports("drills"), goNterpret: () => goReports("nterpret"),
    openSettings: () => openSheet("settings"), openSupport: () => { ui.current.supportSent = false; openSheet("support"); },
    homeColor: screen === "home" ? "#0E0E0E" : "#6F6C64",
    homeStroke: screen === "home" ? 2.2 : 1.8,
    profColor: screen === "profile" ? "#0E0E0E" : "#6F6C64",
    profStroke: screen === "profile" ? 2.2 : 1.8,
    chatColor: screen === "chat" ? "#0E0E0E" : "#6F6C64",
    chatOpacity: screen === "chat" ? 1 : 0.55,
    clutchColor: screen === "reports" ? "#0E0E0E" : "#6F6C64",
    clutchStroke: screen === "reports" ? 2.2 : 1.8,

    // ── login stat-grid texture + home quick chips + chat starters ──
    statCells,
    quick: QUICK.map((q) => ({ label: q.label, onTap: () => askFrom(q.say) })),
    starters: STARTERS.map((t, i) => ({ text: t, n: String(i + 1).padStart(2, "0"), onSend: () => askFrom(t) })),
    askGameDay: startGameDay,

    // ── ask bar / chat ──
    input: s.input,
    onInput: (e: unknown) => {
      s.input = val(e);
      const el = (e as Event).target as HTMLTextAreaElement | null;
      if (el && el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 96) + "px"; }
    },
    // Enter sends, Shift+Enter makes a new line (composer is a textarea).
    onChatKey: (e: unknown) => {
      const ev = e as KeyboardEvent;
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submitChat(); }
    },
    submitAsk, submitChat, refreshChat,
    chatEmpty: chat.current.length === 0,
    chatStarted: chat.current.length > 0,
    chatHeaderOn: chat.current.length > 0 || hist.current.length > 0,
    openHistory: () => { s.sheet = "history"; bump(); },
    newChat: () => { chat.current = []; chatId.current = null; s.input = ""; s.busy = false; s.sheet = null; s.screen = "chat"; bump(); },
    chatHistory: hist.current.map((h) => ({
      title: h.title,
      when: timeAgo(h.at),
      count: String(h.messages.length),
      active: h.id === chatId.current,
      onOpen: () => {
        chat.current = h.messages; chatId.current = h.id;
        try { localStorage.setItem("howie_chat_open_" + (session?.email ?? ""), h.id); } catch { /* noop */ }
        s.screen = "chat"; s.sheet = null; s.busy = false; bump();
      },
      onRemove: () => {
        hist.current = hist.current.filter((x) => x.id !== h.id);
        if (chatId.current === h.id) { chat.current = []; chatId.current = null; }
        persistHist(); bump();
      },
    })),
    hasHistory: hist.current.length > 0,
    noHistory: hist.current.length === 0,
    mlist: chat.current.map((m, i) => ({
      idx: i, isUser: m.role === "user", isHowie: m.role !== "user", content: m.content,
      ack: m.ack ?? "", word: m.word ?? "Thinking it through",
      thinking: !!m.thinking,
      showActions: m.role !== "user" && !!m.content && !m.thinking,
      rated: !!m.rated, notRated: !m.rated,
      saved: !!m.saved, saveLabel: m.saved ? "Saved" : "Save",
      saveColor: m.saved ? "#0E0E0E" : "#6F6C64", saveFill: m.saved ? "#0E0E0E" : "none",
      onUp: () => rate(i, "up"), onDown: () => rate(i, "down"), onSave: () => keep(i),
    })),

    // ── clutch (live-backed) ──
    clutch, clutchPct,
    retestFee: cf?.retest?.fee ?? "$29",
    nextTestDate: "June 2026",
    trendLatest, trendFirst,
    trendPrev: histPrev ?? histFirst,
    trendAbs: Math.abs(trendDelta),
    trendArrow: trendDelta >= 0 ? "↑" : "↓",
    trendColor: trendDelta >= 0 ? "#1F7A4D" : "#B4261F",
    trendPoly,
    trendPts: trendPoints.map((p) => ({ ...p, yShift: p.y + 14 })),
    clutchHistoryRows: rawHistory.map((p, i) => {
      const d = i > 0 ? p.score - rawHistory[i - 1].score : null;
      return { ...p, n: String(i + 1).padStart(2, "0"), hasDelta: d != null, deltaAbs: d == null ? "" : Math.abs(d), deltaArrow: d == null ? "" : (d >= 0 ? "↑" : "↓"), deltaColor: d == null ? "#6F6C64" : (d >= 0 ? "#1F7A4D" : "#B4261F") };
    }),
    askTrend: () => askFrom("My Clutch Factor went from " + histFirst.score + " to " + histLatest.score + ". How do I keep it climbing?"),
    isTrend: screen === "trend",
    goTrend: () => go("trend"),
    // Dimension deltas are demo-authored; only shown when there are 2+ tests.
    hasTrendDiff: rawHistory.length >= 2,
    trendDiff: rawHistory.length >= 2 ? TREND_DIFF : [],
    clutchTiers: CLUTCH_TIERS.map((t, idx) => {
      const here = idx === lad.index;
      return { ...t, here, notHere: !here, rowBg: here ? "#0E0E0E" : "#fff", fg: here ? "#fff" : "#0E0E0E", labelFg: here ? "rgba(255,255,255,0.65)" : "#6F6C64", statFg: here ? "#fff" : "#42403B", meaningFg: here ? "rgba(255,255,255,0.82)" : "#42403B" };
    }),

    // ── reports hub (Clutch · NTerpret · Drills) ──
    reportTab: s.reportTab,
    tabClutch: s.reportTab === "clutch", tabNterpret: s.reportTab === "nterpret", tabDrills: s.reportTab === "drills",
    setTabClutch: () => { s.reportTab = "clutch"; bump(); },
    setTabNterpret: () => { s.reportTab = "nterpret"; bump(); },
    setTabDrills: () => { s.reportTab = "drills"; bump(); },
    segClutchBg: s.reportTab === "clutch" ? "#0E0E0E" : "transparent",
    segClutchFg: s.reportTab === "clutch" ? "#fff" : "#6F6C64",
    segNterpretBg: s.reportTab === "nterpret" ? "#0E0E0E" : "transparent",
    segNterpretFg: s.reportTab === "nterpret" ? "#fff" : "#6F6C64",
    segDrillsBg: s.reportTab === "drills" ? "#0E0E0E" : "transparent",
    segDrillsFg: s.reportTab === "drills" ? "#fff" : "#6F6C64",

    // ── NTerpret report (static verbatim; live shape can't fill the rich fields) ──
    nterpret2: NTERPRET,
    nterpretDims: NTERPRET.dimensions.map((d, i) => ({ ...d, n: String(i + 1).padStart(2, "0"), open: !!s.expanded["dim" + i], onToggle: () => toggle("dim" + i), caret: s.expanded["dim" + i] ? "−" : "+" })),
    nterpretGrowth: NTERPRET.growthAreas.map((g, i) => ({ ...g, n: String(i + 1).padStart(2, "0") })),
    nterpretHacksLib: NTERPRET.hacks.map((h, i) => ({ ...h, id: "hack" + i, open: !!s.expanded["hack_" + i], onToggle: () => toggle("hack_" + i), caret: s.expanded["hack_" + i] ? "−" : "+" })),
    nterpretHackCount: NTERPRET.hacks.length,
    noNterpretHacks: NTERPRET.hacks.length === 0,
    growthOpen: !!s.expanded.growth, toggleGrowth: () => toggle("growth"), growthCaret: s.expanded.growth ? "−" : "+",

    // ── Drills report (static verbatim) ──
    drillCount: DRILLS.length,
    clutchDrillCount: priorityClutch.length,
    noClutchDrills: priorityClutch.length === 0,
    clutchDrillsLib: priorityClutch.map((d) => ({ ...d, open: !!s.expanded["drill_" + d.id], onToggle: () => toggle("drill_" + d.id), caret: s.expanded["drill_" + d.id] ? "−" : "+" })),

    // ── ask-Howie shortcuts ──
    askClutch: () => askFrom("My Clutch Factor is " + liveScore + ". What does that mean for me and how do I raise it?"),
    askNterpret: () => askFrom("Walk me through my NTerpret profile, what should I actually do with it?"),
    askDrills: () => askFrom("Which of my drills should I prioritize this week, and how do I fit them in?"),
    askPlaybook: () => { ui.current.sheet = null; askFrom("How do I use my Clutch Factor score in recruiting?"); },

    // ── guides ──
    guides: GUIDES.map((g, i) => ({ title: g.title, blurb: g.blurb, n: String(i + 1).padStart(2, "0"), onOpen: () => openGuide(g.slug) })),
    guide: guideObj ? { title: guideObj.title } : { title: "" },
    sections: guideObj ? guideObj.sections.map((sec) => ({ ...sec, hasSay: !!(sec.say && sec.say.length), hasAvoid: !!(sec.avoid && sec.avoid.length) })) : [],

    // ── recruiting playbook ──
    playbook: PLAYBOOK.map((p, i) => ({ ...p, n: String(i + 1).padStart(2, "0"), isMega: p.icon === "mega", isMail: p.icon === "mail", isShield: p.icon === "shield" })),
    openPlaybook: () => openSheet("playbook"),
    openShareFromPlaybook: () => openSheet("share"),

    // ── saved notes ──
    notes: s.notes.map((n) => ({ ...n, ago: timeAgo(n.at), tag: n.mine ? "My idea" : "From Howie", tagBg: n.mine ? "#2A6FDB" : "#0E0E0E", onRemove: () => removeNote(n.id), onBring: () => bringToChat(n) })),
    hasNotes: s.notes.length > 0, noNotes: s.notes.length === 0,
    notesCount: s.notes.length,
    notesCountLabel: s.notes.length === 0 ? "Nothing saved yet" : s.notes.length === 1 ? "1 saved" : s.notes.length + " saved",
    addingNote: !!s.addingNote, notAddingNote: !s.addingNote,
    noteDraft: s.noteDraft,
    onNoteDraft: (e: unknown) => { s.noteDraft = val(e); },
    openSaved, startNote, cancelNote, saveOwnNote,

    // ── share / highlight card ──
    openShare: () => openSheet("share"),
    onHighlightPhoto,
    downloadHighlight: () => {},
    highlightPhotoSrc: highlightPhoto,
    highlightPhotoBg: highlightPhoto
      ? 'position:absolute; inset:0; background-image:url("' + highlightPhoto + '"); background-size:cover; background-position:center center;'
      : "position:absolute; inset:0;",
    hasHighlightPhoto: !!highlightPhoto,
    noHighlightPhoto: !highlightPhoto,
    uploadPhotoLabel: highlightPhoto ? "Change photo" : "Upload photo",
    highlightBadgeStyle: liveScore >= 800
      ? "font-family:'Roboto Mono',monospace; font-size:14px; font-weight:700; letter-spacing:.26em; text-transform:uppercase; color:#0E0E0E; background:#FFFFFF; border-radius:40px; padding:10px 24px;"
      : "font-family:'Roboto Mono',monospace; font-size:14px; font-weight:700; letter-spacing:.26em; text-transform:uppercase; color:#FFFFFF; background:transparent; border:1.5px solid rgba(255,255,255,0.6); border-radius:40px; padding:8.5px 22px;",
    cardBusy: false, cardNotBusy: true, cardBusyOpacity: 1, cardError: "", cardHasError: false,

    // ── learn sheets ──
    openLearnTier: () => { s.learnTopic = "tier"; openSheet("learn"); },
    openLearnMeasures: () => { s.learnTopic = "measures"; openSheet("learn"); },
    openLearnUse: () => { s.learnTopic = "use"; openSheet("learn"); },
    openLearnRecruit: () => { s.learnTopic = "recruit"; openSheet("learn"); },
    learnTitle: ({ tier: "Your tier explained", measures: "What Clutch Factor measures", use: "How to use your score", recruit: "Recruiting & NIL playbook" } as Record<string, string>)[s.learnTopic],
    learnIsTier: s.learnTopic === "tier",
    learnIsMeasures: s.learnTopic === "measures",
    learnIsUse: s.learnTopic === "use",
    learnIsRecruit: s.learnTopic === "recruit",

    // ── parent access ──
    parents: s.parents.map((p) => ({ ...p, isActive: p.status === "active", isPending: p.status === "pending", initials: (p.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join(""), onRevoke: () => revokeParent(p.id) })),
    parentCount: s.parents.length,
    openInvite: () => { s.inviteEmail = ""; s.inviteError = ""; openSheet("invite"); },
    sendInvite,
    inviteEmail: s.inviteEmail, inviteRelation: s.inviteRelation, inviteError: s.inviteError,
    onInviteEmail: (e: unknown) => { s.inviteEmail = val(e); },
    setRelParent: () => { s.inviteRelation = "Parent"; bump(); },
    setRelGuardian: () => { s.inviteRelation = "Guardian"; bump(); },
    relParentBg: s.inviteRelation === "Parent" ? "#0E0E0E" : "#fff",
    relParentFg: s.inviteRelation === "Parent" ? "#fff" : "#6F6C64",
    relGuardianBg: s.inviteRelation === "Guardian" ? "#0E0E0E" : "#fff",
    relGuardianFg: s.inviteRelation === "Guardian" ? "#fff" : "#6F6C64",

    // ── support sheet ──
    supportSubject: s.supportSubject, supportMessage: s.supportMessage,
    supportSent: s.supportSent, supportNotSent: !s.supportSent,
    supportCanSend: !!s.supportMessage.trim(),
    onSupportSubject: (e: unknown) => { s.supportSubject = val(e); },
    onSupportMessage: (e: unknown) => { s.supportMessage = val(e); },
    sendSupport,

    // ── settings toggles ──
    toggles: [
      { key: "reminders", label: "Game-day reminders", sub: "A nudge to check Drive Home Mode after games" },
      { key: "reduced", label: "Reduce motion", sub: "Calm the animations across the app" },
      { key: "saveLocal", label: "Keep notes on this device", sub: "Saved lines stay private to this phone" },
    ].map((t) => {
      const on = s.settings[t.key];
      return { ...t, on, trackBg: on ? "#0E0E0E" : "#D8D4CC", knobX: on ? "20px" : "0px", justify: on ? "flex-end" : "flex-start", onToggle: () => { s.settings[t.key] = !s.settings[t.key]; bump(); } };
    }),

    // ── sheets ──
    sheetOpen: !!s.sheet,
    sheetDisclaimer: s.sheet === "disclaimer",
    sheetShare: s.sheet === "share",
    sheetSettings: s.sheet === "settings",
    sheetPartner: s.sheet === "partner",
    sheetInvite: s.sheet === "invite",
    sheetSaved: s.sheet === "saved",
    sheetHistory: s.sheet === "history",
    sheetPlaybook: s.sheet === "playbook",
    sheetSupport: s.sheet === "support",
    sheetAssessment: s.sheet === "assessment",
    sheetLearn: s.sheet === "learn",
    closeSheet,
    acceptTerms: () => {
      try { localStorage.setItem("howie_terms_ok", "1"); } catch { /* noop */ }
      api.acceptTerms().catch(() => {});
      ui.current.sheet = null; bump();
    },
    discTitle: NT_DISCLAIMER.title,
    discSubtitle: NT_DISCLAIMER.subtitle,
    discIntro: NT_DISCLAIMER.intro,
    discAcceptance: NT_DISCLAIMER.acceptance,
    discSections: NT_DISCLAIMER.sections.map((sec) => ({ h: sec.h, b: sec.b })),

    // ── assessment / re-test window (defaults to an open window) ──
    openAssessment: () => { s.sheet = "assessment"; s.assessStep = "intro"; bump(); },
    assessIntro: s.assessStep === "intro",
    assessWeb: s.assessStep === "web",
    assessSubmitting: s.assessStep === "submitting",
    assessDone: s.assessStep === "done",
    assessLocked: false, assessPayment: false, assessCheckout: false,
    assessNative: s.assessStep !== "web",
    assessShowBrowser: s.assessStep === "web",
    assessUrl: "portal.ntangible.co",
    assessBegin: () => {
      s.assessStep = "web"; bump();
      try { window.open(ASSESS_URL, "_blank", "noopener"); } catch { /* noop */ }
    },
    assessReopen: () => { try { window.open(ASSESS_URL, "_blank", "noopener"); } catch { /* noop */ } },
    assessSubmit: () => {
      s.assessStep = "submitting"; bump();
      window.setTimeout(() => {
        if (s.sheet === "assessment" && s.assessStep === "submitting") { s.assessStep = "done"; bump(); }
      }, 1600);
    },
    payStart: () => {}, payComplete: () => {},
    // testing-window gating flags (always "open" in this integration)
    testLocked: false,
    testNotLocked: true,
    testBtnTitle: "Take the Clutch Factor test",
    testBtnSub: "Window open · included with membership",
    countdown: { open: true, date: "Open now", pct: 100, daysLeft: 0, elapsed: "Window open" },

    // ── reveal (deferred — see notes) ──
    revealNum: liveScore, revealPct: clutchPct, revealDone: true,
    revealTier: lad.label.charAt(0) + lad.label.slice(1).toLowerCase(),
    revealBand: lad.band, revealDelta: "+0",
    revealHeadline: lad.zone,
    seeReport: () => goReports("clutch"), revealHome: () => go("home"),

    // ── sign out ──
    signOut: () => { ui.current.screen = "login"; ui.current.sheet = null; chat.current = []; signOut(); },
  };

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#F7F6F3", position: "relative" }}>
      <HowieTemplate html={html} ctx={ctx} rev={rev} />
    </div>
  );
}
