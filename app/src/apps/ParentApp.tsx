// Parent app — renders the recovered exact markup (frontend/src/templates/parent.html)
// via the template runtime, driven by a small state machine + our live API data.
// For a parent session the /me/* endpoints return the LINKED athlete's data, so the
// clutch gauge, NTerpret report and guides all read straight off those calls, and
// chat runs through Howie with persona "parent".
import { useEffect, useMemo, useRef, useState } from "react";
import parentHtml from "../templates/parent.html?raw";
import { HowieTemplate, type Ctx } from "../runtime";
import { NT_DISCLAIMER } from "../disclaimer";
import * as api from "../api";

type Screen = "home" | "drive" | "chat" | "guides" | "guide" | "nterpret" | "clutch" | "profile";
type Sheet = "" | "disclaimer" | "script" | "saved" | "history" | "share" | "support" | "settings" | "partner";
type Note = { id: string; prompt: string; text: string; tag: string; tagBg: string; at: number };

// ── Recovered static content (parent-specific; no API equivalent) ──
const AXES = ["Communicates", "Learns", "Driven By"];

const STAT_CELLS = [
  { k: "OPS", v: "8.70" }, { k: "WHIP", v: "2.10" }, { k: "FIP", v: "9.90" }, { k: "WAR", v: "9.70" },
  { k: "ISO", v: "3.60" }, { k: "BABIP", v: "0.29" }, { k: "K%", v: "1.00" }, { k: "EV", v: "7.50" },
  { k: "SLG", v: "5.00" }, { k: "LA", v: "1.30" }, { k: "ERA", v: "6.10" }, { k: "GB%", v: "3.70" },
];

const QUICK = [
  { label: "Bad game tonight", say: "She had a rough game tonight. What do I say in the car?" },
  { label: "Tryout coming up", say: "There's a tryout this weekend. How do I help without adding pressure?" },
  { label: "Got benched", say: "She got benched and she's crushed. Help me with this one." },
  { label: "I'm the nervous one", say: "Honestly, I am the nervous one on game days. Help me first." },
];

const STARTERS = [
  "She had a bad game tonight. What do I say in the car?",
  "How do I talk about a tryout coming up this weekend?",
  "She got benched and she's crushed. Help.",
  "Honestly? I am the nervous one on game days. Help me first.",
];

const OUTCOMES = [
  { n: "01", key: "great", label: "Great game", sub: "She played well and she knows it" },
  { n: "02", key: "rough", label: "Rough night", sub: "Mistakes, frustration, quiet kid" },
  { n: "03", key: "tough", label: "Tough loss", sub: "Big game, hard ending" },
  { n: "04", key: "benched", label: "Barely played", sub: "Benched, pulled, or stuck watching" },
  { n: "05", key: "error", label: "The costly mistake", sub: "Her error decided it" },
  { n: "06", key: "teammate", label: "Team drama", sub: "Conflict with a teammate or the group" },
];

const MOMENT_LABELS: Record<string, string> = {
  great: "a great game", rough: "a rough night", tough: "a tough loss",
  benched: "barely playing", error: "a costly mistake", teammate: "team drama",
};

type Script = { opener: string; driver: string; mistake?: string; revisit: string; avoid: string[]; closer: string };
const SCRIPTS: Record<string, Script> = {
  great: {
    opener: "Whatever else happened out there, I loved watching you play tonight.",
    driver: "Maya runs on getting better, not the scoreboard, so name the growth, not the win. Ask what she figured out tonight that she couldn't do last month.",
    revisit: "She's a visual learner. If she wants to break down a good play later, pull up a clip instead of talking it through.",
    avoid: ["\"You were the best one out there.\" Ranking her against teammates isn't the fuel she runs on.", "Over-celebrating the result. It quietly raises the stakes for next time.", "A long play-by-play in the car. Let the good night just be a good night."],
    closer: "I love watching you play.",
  },
  rough: {
    opener: "Rough one. I'm just glad I was there. We don't have to talk about it unless you want to.",
    driver: "Maya processes internally before she talks, so silence in the car is her working, not shutting you out. Keep your eyes forward and let the quiet sit.",
    mistake: "If she brings up a specific mistake, don't pile on or rescue her from it. A simple \"that happens to everyone who plays this game\" is enough tonight.",
    revisit: "She replays mistakes for about a day. Skip the same-night debrief. If she wants to look at it tomorrow, watch a clip together instead of talking it through.",
    avoid: ["\"You'll get 'em next time.\" It rushes her past a feeling she needs to sit with.", "\"You should have...\" It turns the car into a film room.", "Coaching the game on the ride home. You're the parent, not the second coach."],
    closer: "I love watching you play.",
  },
  tough: {
    opener: "That's a hard way for it to end. I'm proud of how you competed.",
    driver: "Name the effort and the growth, not the result. With Maya, \"what did you learn out there\" lands better than anything about the score.",
    revisit: "Give it the night. She's a visual processor, so if she wants to revisit the turning point tomorrow, a clip beats a conversation.",
    avoid: ["\"It's just one game.\" True, but it dismisses how much it mattered to her right now.", "Replaying the final play. She's already running it on a loop.", "Comparing this team or game to another."],
    closer: "I love watching you play.",
  },
  benched: {
    opener: "I know tonight wasn't the night you wanted. I still loved watching you be part of it.",
    driver: "Playing time is loaded territory. Don't promise to fix it and don't trash the coach. Ask what she thinks the coach is seeing and what's in her control this week.",
    revisit: "Maya's driven by her own growth, so point her at the next rep, not the depth chart. Tomorrow, watch film of what earns minutes at her spot.",
    avoid: ["\"Your coach doesn't know what he has.\" Even if true, it teaches her to look for someone to blame.", "Promising you'll talk to the coach. Let her lead that with your support behind her.", "\"At least you got an inning.\" It minimizes a real disappointment."],
    closer: "I love watching you play.",
  },
  error: {
    opener: "I saw a kid who kept competing after a tough break. That's the part I'll remember.",
    driver: "Maya replays mistakes internally for about a day, so she doesn't need you to replay it too. Let her own it without you narrating it.",
    mistake: "If she names the error, keep it to one honest, kind sentence: \"that happens to everyone who plays this game.\" Then let it go.",
    revisit: "Skip the same-night breakdown. If she wants to fix something tomorrow, give her one visual: a clip or a drill she can watch, not a lecture.",
    avoid: ["\"It wasn't that bad.\" If it felt bad to her, it was bad to her.", "A detailed replay of the play tonight.", "\"Shake it off.\" She processes by sitting with it, not skipping past it."],
    closer: "I love watching you play.",
  },
  teammate: {
    opener: "Sounds like tonight had more going on than the game. I'm here if you want to talk it through.",
    driver: "Let her lead. Maya needs to feel the relationship is steady before she'll open up. Ask questions, and resist the urge to solve it for her.",
    revisit: "If it's still heavy tomorrow, help her separate the sport from the people around it. That's usually where the real knot is.",
    avoid: ["Taking sides or calling the other kid out. It teaches her to outsource the problem.", "\"Just ignore them.\" It skips the part where she figures out what she wants to do.", "Making it bigger than she's making it."],
    closer: "I love watching you play.",
  },
};

const NTERPRET_HACKS = [
  { when: "Pre-Game", body: "Help her lock in with a 3-word role cue before first pitch (\"see it, trust it, go\"). It settles responsibilities and speeds her first decision." },
  { when: "Post-Game", body: "Keep the ride home a 10-second reset, not a debrief: one breath, one thing that went well, one intention for next game. Save the rest for tomorrow." },
  { when: "Practice", body: "Encourage a short checklist each session: 2 things to reinforce, 1 skill to drill. It aims her reps and builds confidence through intention." },
];

const CLUTCH_TIERS = [
  { band: "800+", label: "Elite", lo: 800, hi: 9999, meaning: "Wired to accelerate when pressure peaks." },
  { band: "750 – 799", label: "Great", lo: 750, hi: 799, meaning: "The composure and decision speed D1 recruiters look for." },
  { band: "725 – 749", label: "Above Average", lo: 725, hi: 749, meaning: "Handles pressure well, on the cusp of top-tier." },
  { band: "651 – 724", label: "Average", lo: 651, hi: 724, meaning: "A solid foundation; consistency under stress is the next step." },
  { band: "650 & under", label: "Below Average", lo: 0, hi: 650, meaning: "Pressure can disrupt focus, and that responds fast to reps." },
];

const SHARE_TARGETS = [
  { label: "Messages", glyph: "iM", bg: "#34C759", fg: "#fff" },
  { label: "Copy", glyph: "⧉", bg: "#EDEBE5", fg: "#0E0E0E" },
  { label: "WhatsApp", glyph: "W", bg: "#25D366", fg: "#fff" },
  { label: "Mail", glyph: "@", bg: "#0E0E0E", fg: "#fff" },
  { label: "More", glyph: "•••", bg: "#EDEBE5", fg: "#0E0E0E" },
];

const TOGGLE_DEFS = [
  { key: "reminders", label: "Game-day reminders", sub: "A nudge to check Drive Home Mode after games" },
  { key: "reduced", label: "Reduce motion", sub: "Calm the animations across the app" },
  { key: "saveLocal", label: "Keep notes on this device", sub: "Saved lines stay private to this phone" },
];

const PARTNERS = [
  { id: "alliance", name: "Alliance Fastpitch", short: "Alliance", sport: "Softball · 8U–18U", idLabel: "Alliance #" },
  { id: "fss", name: "Future Stars Series", short: "Future Stars", sport: "Baseball · Scouting", idLabel: "FSS Player #" },
  { id: "pg", name: "Perfect Game", short: "Perfect Game", sport: "Baseball / Softball", idLabel: "PG Cohort #" },
  { id: "usssa", name: "USSSA", short: "USSSA", sport: "Multi-sport", idLabel: "Member #" },
  { id: "other", name: "My organization isn't listed", short: "Other", sport: "Request manually", idLabel: "Org #" },
];

// Narrative fallbacks the API doesn't carry (kept concise; real numbers come from the API).
const CLUTCH_FOR_PARENTS = "You don't need to coach this number. Keep the stakes low and let her competitive side do the work — Howie can suggest the exact words for big-game weeks.";
const CLUTCH_WHAT_IT_MEANS = "Clutch Factor isn't a measure of talent. It's how an athlete processes information and handles emotion in high-pressure moments — whether they elevate, hold, or dip when it matters most. It's scored out of 1000, and it's highly trainable.";
const NTERPRET_AFTER_MISTAKES = "She processes mistakes internally — give it a day, help her pull one lesson, then let it go. When you revisit, a clip beats a lecture.";

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function fmtMonth(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ParentApp({ signOut }: { signOut: () => void }) {
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);
  // The recovered markup speaks about the demo athlete "Maya" — personalize it
  // to the parent's LINKED athlete (their /me/* data is that player's).
  const [athleteName, setAthleteName] = useState("");
  const html = useMemo(() => {
    const first = athleteName.trim().split(" ")[0];
    if (!first || first === "Maya") return parentHtml;
    return parentHtml.replaceAll("Maya's", first + "'s").replaceAll("Maya", first);
  }, [athleteName]);

  const ui = useRef({
    screen: "home" as Screen,
    sheet: "" as Sheet,
    driveOutcome: "",
    guideSlug: "",
    scriptLoading: false,
    expanded: {} as Record<string, boolean>,
    settings: { reminders: true, reduced: false, saveLocal: true } as Record<string, boolean>,
    supportSubject: "",
    supportMessage: "",
    supportSent: false,
  });
  const data = useRef<{ clutch?: api.ClutchFactor; nterpret?: api.NTerpret; guides?: api.Guide[]; name?: string }>({});
  const chat = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const draft = useRef("");
  const rated = useRef<Record<number, string>>({});
  const saved = useRef<Record<number, boolean>>({});
  // Full chat history, kept on this device only (never sent to the server).
  const threads = useRef<{ id: string; title: string; at: number; messages: { role: "user" | "assistant"; content: string }[] }[]>([]);
  const chatId = useRef<string | null>(null);
  // Saved notes are device-local; parents only ever see notes they saved here.
  const notes = useRef<Note[]>([]);
  const persistNotes = () => {
    try { localStorage.setItem("howie_notes_parent", JSON.stringify(notes.current)); } catch { /* noop */ }
  };

  useEffect(() => {
    // The shared Howie terms sheet is accepted once per device (any persona).
    try { if (!localStorage.getItem("howie_terms_ok")) ui.current.sheet = "disclaimer"; } catch { /* noop */ }
    try {
      const raw = localStorage.getItem("howie_notes_parent");
      if (raw) { notes.current = JSON.parse(raw) as Note[]; }
    } catch { /* noop */ }
    try {
      const hraw = localStorage.getItem("howie_chats_parent");
      threads.current = hraw ? (JSON.parse(hraw) as typeof threads.current) : [];
    } catch { /* noop */ }
    if (threads.current.length && chat.current.length === 0) {
      const lastOpen = localStorage.getItem("howie_chat_open_parent");
      const resume = threads.current.find((t) => t.id === lastOpen) ?? threads.current[0];
      chat.current = resume.messages;
      chatId.current = resume.id;
    }
    Promise.all([api.myClutchFactor(), api.myNTerpret(), api.guides(), api.me().catch(() => undefined), api.myProfile().catch(() => undefined)])
      .then(([clutch, nterpret, guidesList, session, athlete]) => {
        data.current = { clutch, nterpret, guides: guidesList, name: session?.name };
        setAthleteName(athlete?.name ?? "");
        bump();
      })
      .catch(() => bump());
  }, []);

  const go = (screen: Screen) => { ui.current.screen = screen; ui.current.sheet = ""; bump(); };
  const openSheet = (sheet: Sheet) => { ui.current.sheet = sheet; bump(); };
  const closeSheet = () => { ui.current.sheet = ""; ui.current.scriptLoading = false; bump(); };
  const toggle = (key: string) => { ui.current.expanded[key] = !ui.current.expanded[key]; bump(); };

  function goBack() {
    const s = ui.current.screen;
    if (s === "guide") return go("guides");
    if (s === "nterpret" || s === "clutch") return go("profile");
    go("home");
  }

  function pickOutcome(key: string) {
    ui.current.driveOutcome = key;
    ui.current.sheet = "script";
    ui.current.scriptLoading = true;
    bump();
    window.setTimeout(() => {
      if (ui.current.sheet === "script") { ui.current.scriptLoading = false; bump(); }
    }, 1200);
  }

  function openGuide(id: string) { ui.current.guideSlug = id; go("guide"); }

  const persistHist = () => { try { localStorage.setItem("howie_chats_parent", JSON.stringify(threads.current.slice(0, 50))); } catch { /* noop */ } };
  function syncThread() {
    const msgs = chat.current.filter((m) => m.content);
    if (!msgs.length) return;
    const firstUser = msgs.find((m) => m.role === "user");
    const title = (firstUser?.content || msgs[0].content || "Conversation").slice(0, 60);
    if (!chatId.current) chatId.current = "c" + Date.now();
    threads.current = [{ id: chatId.current, title, at: Date.now(), messages: msgs }, ...threads.current.filter((x) => x.id !== chatId.current)];
    try { localStorage.setItem("howie_chat_open_parent", chatId.current); } catch { /* noop */ }
    persistHist();
  }

  async function sendText(text: string) {
    const t = text.trim();
    if (!t) return;
    const history = chat.current.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));
    chat.current = [...chat.current, { role: "user", content: t }, { role: "assistant", content: "" }];
    draft.current = ""; ui.current.screen = "chat"; ui.current.sheet = ""; syncThread(); bump();
    try {
      const r = await api.howieChat(t, "parent", history);
      chat.current = [...chat.current.slice(0, -1), { role: "assistant", content: r.reply }];
    } catch {
      chat.current = [...chat.current.slice(0, -1), { role: "assistant", content: "I hit a snag — try again in a moment." }];
    }
    syncThread();
    bump();
  }

  const submitChat = () => sendText(draft.current);

  function refreshChat() {
    chatId.current = null;
    chat.current = []; draft.current = ""; rated.current = {}; saved.current = {}; bump();
  }
  function rate(i: number, val: string) {
    if (rated.current[i]) return;
    rated.current[i] = val; bump();
  }
  function keep(i: number) {
    if (saved.current[i]) return;
    const msg = chat.current[i];
    if (!msg) return;
    const prompt = chat.current[i - 1]?.content ?? "";
    saved.current[i] = true;
    notes.current = [{ id: `k${i}${Date.now()}`, prompt, text: msg.content, tag: "From Howie", tagBg: "#0E0E0E", at: Date.now() }, ...notes.current];
    persistNotes();
    bump();
  }
  function removeNote(id: string) { notes.current = notes.current.filter((n) => n.id !== id); persistNotes(); bump(); }
  function bringToChat(text: string) { sendText(`Earlier I saved this: "${text}" Help me put it into practice.`); }
  function toggleSetting(key: string) { ui.current.settings[key] = !ui.current.settings[key]; bump(); }

  function sendSupport() {
    const subj = (ui.current.supportSubject || "").trim() || "Parent app support";
    const msg = (ui.current.supportMessage || "").trim();
    const url = `mailto:support@ntangible.co?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(`${msg}\n\n- Sent from the NTangible Parent app`)}`;
    try { window.location.href = url; } catch { /* ignore */ }
    ui.current.supportSent = true; bump();
  }

  const s = ui.current;
  const cf = data.current.clutch;
  const nt = data.current.nterpret;
  const score = cf?.score ?? 0;

  // ── clutch trend (computed from the linked athlete's live history) ──
  const hist = cf?.history ?? [];
  const scores = hist.map((p) => p.score);
  const min = hist.length ? Math.min(...scores) - 20 : 0;
  const max = hist.length ? Math.max(...scores) + 20 : 1;
  const W = 280, H = 110;
  const pts = hist.map((p, i) => ({
    x: hist.length > 1 ? (i / (hist.length - 1)) * W : 0,
    y: H - ((p.score - min) / (max - min || 1)) * H + 14,
  }));
  const latest = hist[hist.length - 1];
  const prev = hist.length > 1 ? hist[hist.length - 2] : undefined;
  const delta = prev && latest ? latest.score - prev.score : 0;

  const script = s.driveOutcome ? SCRIPTS[s.driveOutcome] : undefined;
  const guide = data.current.guides?.find((g) => g.id === s.guideSlug);
  const sections = guide ? [{ heading: "Overview", body: guide.summary, hasSay: false, hasAvoid: false, say: [] as string[], avoid: [] as string[] }] : [];
  const isThinkingMsg = (m: { role: string; content: string }) => m.role !== "user" && !m.content;

  const ctx: Ctx = {
    // ── auth / shell (handled by App shell → app is always in appView) ──
    isLogin: false, isAccess: false, appView: true,
    showOnboard: false, ob0: false, ob1: false, ob2: false, obCta: "", obDots: [],
    // ── screen gating ──
    isHome: s.screen === "home",
    isDrive: s.screen === "drive",
    isChat: s.screen === "chat",
    isGuides: s.screen === "guides",
    isGuide: s.screen === "guide",
    isNterpret: s.screen === "nterpret",
    isClutch: s.screen === "clutch",
    isProfile: s.screen === "profile",
    showBack: ["drive", "guides", "guide", "nterpret", "clutch"].includes(s.screen),
    // ── sheets ──
    sheetOpen: !!s.sheet,
    sheetDisclaimer: s.sheet === "disclaimer",
    sheetScript: s.sheet === "script",
    sheetSaved: s.sheet === "saved",
    sheetHistory: s.sheet === "history",
    sheetShare: s.sheet === "share",
    sheetSupport: s.sheet === "support",
    sheetSettings: s.sheet === "settings",
    sheetPartner: s.sheet === "partner",
    scriptLoading: s.scriptLoading,
    scriptReady: s.sheet === "script" && !s.scriptLoading,
    // ── chat ──
    chatEmpty: chat.current.length === 0,
    chatStarted: chat.current.length > 0,
    chatHeaderOn: chat.current.length > 0 || threads.current.length > 0,
    openHistory: () => { ui.current.sheet = "history"; bump(); },
    newChat: () => { chat.current = []; chatId.current = null; rated.current = {}; saved.current = {}; draft.current = ""; ui.current.sheet = ""; ui.current.screen = "chat"; bump(); },
    chatHistory: threads.current.map((h) => ({
      title: h.title, when: timeAgo(h.at), count: String(h.messages.length),
      active: h.id === chatId.current,
      onOpen: () => {
        chat.current = h.messages; chatId.current = h.id; rated.current = {}; saved.current = {};
        try { localStorage.setItem("howie_chat_open_parent", h.id); } catch { /* noop */ }
        ui.current.screen = "chat"; ui.current.sheet = ""; bump();
      },
      onRemove: () => {
        threads.current = threads.current.filter((x) => x.id !== h.id);
        if (chatId.current === h.id) { chat.current = []; chatId.current = null; }
        persistHist(); bump();
      },
    })),
    hasHistory: threads.current.length > 0,
    noHistory: threads.current.length === 0,
    chatRef: "",
    input: draft.current,
    mlist: chat.current.map((m, i) => {
      const isUser = m.role === "user";
      const isSaved = !!saved.current[i];
      const isRated = !!rated.current[i];
      return {
        isUser, isHowie: !isUser, content: m.content,
        thinking: isThinkingMsg(m), ack: "Give me a second.", word: "Finding the right words",
        showActions: !isUser && !!m.content,
        rated: isRated, notRated: !isRated,
        saveLabel: isSaved ? "Saved" : "Save",
        saveColor: isSaved ? "#0E0E0E" : "#6F6C64",
        saveFill: isSaved ? "#0E0E0E" : "none",
        onUp: () => rate(i, "up"), onDown: () => rate(i, "down"), onSave: () => keep(i),
      };
    }),
    // ── greeting / tab chrome ──
    pname: data.current.name || "there",
    homeColor: s.screen === "home" ? "#0E0E0E" : "#6F6C64",
    chatColor: s.screen === "chat" ? "#0E0E0E" : "#6F6C64",
    profColor: s.screen === "profile" ? "#0E0E0E" : "#6F6C64",
    homeStroke: s.screen === "home" ? 2.2 : 1.8,
    profStroke: s.screen === "profile" ? 2.2 : 1.8,
    chatOpacity: s.screen === "chat" ? 1 : 0.55,
    activePartner: { short: "NT", noLogo: true, isAlliance: false },
    // ── home lists ──
    statCells: STAT_CELLS,
    quick: QUICK.map((q) => ({ label: q.label, onTap: () => sendText(q.say) })),
    starters: STARTERS.map((text, i) => ({ text, n: pad2(i), onSend: () => sendText(text) })),
    outcomes: OUTCOMES.map((o) => ({ n: o.n, label: o.label, sub: o.sub, onPick: () => pickOutcome(o.key) })),
    // ── guides ──
    guides: (data.current.guides ?? []).map((g, i) => ({ title: g.title, blurb: g.summary, n: pad2(i), onOpen: () => openGuide(g.id) })),
    guide: { title: guide?.title ?? "" },
    sections,
    // ── NTerpret (linked athlete) ──
    nterpret2: { narrative: nt?.summary ?? "", afterMistakes: NTERPRET_AFTER_MISTAKES, assessed: "", validity: "" },
    nterpretFull: (nt?.domains ?? []).map((d, i) => ({
      n: pad2(i), axis: AXES[i] ?? d.name, value: d.name, tagline: "",
      body: d.summary, general: d.summary, scale: "",
      open: !!s.expanded[`dim${i}`], caret: s.expanded[`dim${i}`] ? "−" : "+",
      onToggle: () => toggle(`dim${i}`),
    })),
    nterpretGrowth: (nt?.growth_areas ?? []).map((g, i) => ({ n: pad2(i), title: g, body: "" })),
    nterpretHacks: NTERPRET_HACKS,
    nterpret: (nt?.domains ?? []).map((d, i) => ({ label: AXES[i] ?? d.name, value: d.name, note: d.summary })),
    growthOpen: !!s.expanded.growth, growthCaret: s.expanded.growth ? "−" : "+", toggleGrowth: () => toggle("growth"),
    hacksOpen: !!s.expanded.hacks, hacksCaret: s.expanded.hacks ? "−" : "+", toggleHacks: () => toggle("hacks"),
    askNterpret: () => sendText("Howie, walk me through Maya's NTerpret profile — what should I actually do with it?"),
    // ── Clutch Factor (linked athlete) ──
    clutch: {
      score: cf?.score ?? "",
      tier: cf?.tier ?? "",
      band: cf?.tier_label ?? "",
      parentSummary: cf?.tier_meaning ?? "",
      forParents: CLUTCH_FOR_PARENTS,
      whatItMeans: CLUTCH_WHAT_IT_MEANS,
      assessed: fmtMonth(cf?.updated_at),
    },
    clutchPct: cf ? Math.round(cf.score / 10) : 0,
    clutchTiers: CLUTCH_TIERS.map((t) => {
      const here = score >= t.lo && score <= t.hi;
      return {
        band: t.band, label: t.label, meaning: t.meaning, here,
        rowBg: here ? "#0E0E0E" : "#fff", fg: here ? "#fff" : "#0E0E0E",
        metaFg: here ? "rgba(255,255,255,0.82)" : "#42403B",
        labelFg: here ? "rgba(255,255,255,0.6)" : "#6F6C64",
      };
    }),
    clutchMeansOpen: !!s.expanded.clutchMeans, clutchMeansCaret: s.expanded.clutchMeans ? "−" : "+", toggleClutchMeans: () => toggle("clutchMeans"),
    askClutch: () => sendText("What does Maya's Clutch Factor mean, and how should I support her with it?"),
    // ── trend ──
    trendPoly: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    trendPts: pts.map((p) => ({ x: p.x.toFixed(1), y: p.y.toFixed(1) })),
    trendFirst: { date: hist[0]?.date ?? "" },
    trendLatest: { score: latest?.score ?? "", date: latest?.date ?? "" },
    trendColor: delta >= 0 ? "#1F7A4D" : "#B4261F",
    trendArrow: delta >= 0 ? "↑" : "↓",
    trendAbs: Math.abs(delta),
    clutchHistoryRows: hist.map((p, i) => {
      const d = i > 0 ? p.score - hist[i - 1].score : null;
      return {
        date: p.date, score: p.score, hasDelta: d != null,
        deltaAbs: d == null ? "" : Math.abs(d),
        deltaArrow: d == null ? "" : d >= 0 ? "↑" : "↓",
        deltaColor: d == null ? "#6F6C64" : d >= 0 ? "#1F7A4D" : "#B4261F",
      };
    }),
    // ── profile activity + saved notes ──
    rides: notes.current.length,
    lastMoment: s.driveOutcome ? `${MOMENT_LABELS[s.driveOutcome]} · just now` : "A rough night · 5h ago",
    notes: notes.current.map((n) => ({
      prompt: n.prompt, text: n.text, tag: n.tag, tagBg: n.tagBg, ago: timeAgo(n.at),
      onRemove: () => removeNote(n.id), onBring: () => bringToChat(n.text),
    })),
    hasNotes: notes.current.length > 0, noNotes: notes.current.length === 0,
    notesCount: notes.current.length,
    // ── drive-home script ──
    script: script ?? { opener: "", driver: "", mistake: "", revisit: "", closer: "" },
    scriptAvoid: script?.avoid ?? [],
    shareText: script ? `START HERE: ${script.opener}\n\nLATER: ${script.revisit}\n\nAnd end with: I love watching you play.` : "",
    shareTargets: SHARE_TARGETS,
    // ── settings sheet ──
    toggles: TOGGLE_DEFS.map((t) => {
      const on = s.settings[t.key];
      return { label: t.label, sub: t.sub, trackBg: on ? "#0E0E0E" : "#D8D4CC", knobX: on ? "20px" : "0px", onToggle: () => toggleSetting(t.key) };
    }),
    // ── support sheet ──
    supportSubject: s.supportSubject,
    supportMessage: s.supportMessage,
    supportSent: s.supportSent,
    supportNotSent: !s.supportSent,
    onSupportSubject: (e: unknown) => { s.supportSubject = ((e as Event).target as HTMLInputElement)?.value ?? ""; },
    onSupportMessage: (e: unknown) => { s.supportMessage = ((e as Event).target as HTMLTextAreaElement)?.value ?? ""; },
    sendSupport,
    // ── disclaimer sheet (never surfaced once logged in) ──
    discTitle: NT_DISCLAIMER.title, discSubtitle: NT_DISCLAIMER.subtitle,
    discIntro: NT_DISCLAIMER.intro, discAcceptance: NT_DISCLAIMER.acceptance,
    discSections: NT_DISCLAIMER.sections.map((sec) => ({ h: sec.h, b: sec.b })),
    // ── access / registration flow (login handled by shell → inert here) ──
    access: { email: "", athleteId: "", dob: "", lastName: "" },
    accessSent: false, accessForm: true, accessError: "", accessAttested: false,
    accessIsOther: false, accessRostered: true, attestBg: "#fff",
    accessOrg: { name: PARTNERS[0].name, short: PARTNERS[0].short, sport: PARTNERS[0].sport, idLabel: PARTNERS[0].idLabel, noLogo: true, isAlliance: false },
    partnerOptions: PARTNERS.map((p) => ({ name: p.name, short: p.short, sport: p.sport, noLogo: true, isAlliance: false, selected: p.id === "alliance", onSelect: () => {} })),
    // ── navigation handlers ──
    goHome: () => go("home"),
    goChat: () => go("chat"),
    goProfile: () => go("profile"),
    goDrive: () => go("drive"),
    goGuides: () => go("guides"),
    goNterpret: () => go("nterpret"),
    goClutchView: () => go("clutch"),
    goBack,
    // ── chat handlers ──
    submitChat,
    submitAsk: submitChat,
    onInput: (e: unknown) => {
      const el = (e as Event).target as HTMLTextAreaElement | null;
      draft.current = el?.value ?? "";
      if (el && el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 96) + "px"; }
    },
    // Enter sends, Shift+Enter makes a new line (composer is a textarea).
    onChatKey: (e: unknown) => {
      const ev = e as KeyboardEvent;
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submitChat(); }
    },
    refreshChat,
    // ── sheet handlers ──
    openSaved: () => openSheet("saved"),
    openShare: () => openSheet("share"),
    openSettings: () => openSheet("settings"),
    openSupport: () => { ui.current.supportSent = false; openSheet("support"); },
    openPartnerPicker: () => openSheet("partner"),
    closeSheet,
    acceptTerms: () => {
      try { localStorage.setItem("howie_terms_ok", "1"); } catch { /* noop */ }
      api.acceptTerms().catch(() => {});
      closeSheet();
    },
    // ── auth / access handlers (inert or delegated to shell sign-out) ──
    signOut,
    goLogin: signOut,
    goAccess: () => {},
    enterPortal: () => go("home"),
    enterPortalFromAccess: () => go("home"),
    submitAccess: () => {},
    toggleAttest: () => {},
    onAccessEmail: () => {}, onAccessId: () => {}, onAccessDob: () => {}, onAccessLast: () => {},
    // ── onboarding handlers (never surfaced once logged in) ──
    obNext: () => {}, obSkip: () => {},
  };

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#F7F6F3", position: "relative" }}>
      <HowieTemplate html={html} ctx={ctx} rev={rev} />
    </div>
  );
}
