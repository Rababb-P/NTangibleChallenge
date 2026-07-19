// Coach mode — the original Trust Your Gut game.
// Five real high-leverage moments from the season's pressure games. You pick
// who you'd want at the plate using only the box score; then the cards flip
// and the mental data (Clutch Factor, pressure splits, reset speed) shows what
// it saw — and you learn what actually happened. Score: your gut vs. the data.
import { useState, type CSSProperties } from "react";
import { ROUNDS, type Candidate, type Round } from "./rounds";
import { calibration, fmtAvg, fmtDelta } from "./stats";

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function CandidateCard({ c, round, picked, locked, onPick }: {
  c: Candidate; round: Round; picked: boolean; locked: boolean; onPick: () => void;
}) {
  const { athlete: a, stats: s } = c;
  const split = s.pressureAvg - s.regularAvg;
  return (
    <button
      type="button"
      className={"tyg-card" + (locked ? " flipped" : "") + (picked ? " picked" : "")}
      onClick={onPick}
      disabled={locked}
      style={{ "--accent": a.color } as CSSProperties}
    >
      <div className="tyg-card-inner">
        {/* FRONT — the box score, the only thing the gut gets */}
        <div className="tyg-face front">
          {picked && !locked && <span className="tyg-badge bet">YOUR PICK</span>}
          <span className="tyg-jersey">#{a.jersey} · {a.position}</span>
          <span className="tyg-name">{a.name}</span>
          <span className="tyg-big"><span className="lbl">SEASON AVG</span>{fmtAvg(s.avg)}</span>
          <span className="tyg-statline">HR {s.hr} · RBI {s.rbi} · AB {s.ab}</span>
          <span className="tyg-small" style={{ marginTop: "auto" }}>“{a.quote}”</span>
        </div>
        {/* BACK — the mental data */}
        <div className="tyg-face back">
          {round.dataPickId === a.id && <span className="tyg-badge data">DATA'S PICK</span>}
          {round.actualId === a.id && <span className="tyg-badge hit">DELIVERED!</span>}
          <span className="tyg-name">{a.name}</span>
          <span className="tyg-cf">{a.clutch_score}<span className="tyg-tier">{a.tier}</span></span>
          <span className="tyg-small">CLUTCH FACTOR™ (0–1000)</span>
          <div className="tyg-mrow"><span className="k">TIGHT GAMES</span><span className={"v " + (split >= 0 ? "up" : "down")}>{fmtAvg(s.pressureAvg)}</span></div>
          <div className="tyg-mrow"><span className="k">BLOWOUTS</span><span className="v">{fmtAvg(s.regularAvg)}</span></div>
          <div className="tyg-mrow"><span className="k">RESET SPEED</span><span className="v">{s.resetAvg ? s.resetAvg.toFixed(1) + " pitches" : "—"}</span></div>
          <div className="tyg-mrow"><span className="k">18-MO TREND</span><span className={"v " + (s.clutchDelta >= 0 ? "up" : "down")}>{fmtDelta(s.clutchDelta)}</span></div>
        </div>
      </div>
    </button>
  );
}

export function CoachMode({ onHome }: { onHome: () => void }) {
  const [phase, setPhase] = useState<"play" | "done">("play");
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [gut, setGut] = useState(0);
  const [data, setData] = useState(0);

  const round = ROUNDS[idx];
  const exit = () => { window.location.hash = ""; };

  const start = () => {
    setPhase("play"); setIdx(0); setPick(null); setLocked(false); setGut(0); setData(0);
  };
  const lockIn = () => {
    if (!pick) return;
    setLocked(true);
    if (pick === round.actualId) setGut((n) => n + 1);
    if (round.dataPickId === round.actualId) setData((n) => n + 1);
  };
  const next = () => {
    if (idx + 1 >= ROUNDS.length) { setPhase("done"); return; }
    setIdx(idx + 1); setPick(null); setLocked(false);
  };

  // ── final screen ──
  if (phase === "done") {
    const cal = calibration();
    const verdict =
      gut > data ? "YOUR GUT BEAT THE DATA. RESPECT. (RUN IT BACK — THE ODDS SAY OTHERWISE.)"
      : gut === data ? "DEAD HEAT. BUT ONLY ONE OF YOU SCALES TO A WHOLE ROSTER."
      : "THE DATA WINS. IT SAW WHAT THE BOX SCORE HIDES.";
    return (
      <div className="tyg">
        <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
        <div className="tyg-wrap" style={{ textAlign: "center", marginTop: "5vh" }}>
          <h1 className="tyg-h1" style={{ fontSize: 28 }}>FINAL SCORE</h1>
          <p style={{ fontSize: 22 }} className="tyg-p">
            <span style={{ color: "var(--amber)" }}>GUT {gut}</span>
            {"  —  "}
            <span style={{ color: "var(--green)" }}>DATA {data}</span>
          </p>
          <p className="tyg-p" style={{ color: "var(--cyan)" }}>{verdict}</p>
          <div className="tyg-panel" style={{ textAlign: "left" }}>
            <h2 className="tyg-h2">THE RECEIPTS — ALL {cal.total} DELIVERED HIGH-LEVERAGE MOMENTS</h2>
            <p className="tyg-small">How often each rule named the player who actually came through (3 candidates each, ~33% by chance):</p>
            <div style={{ marginTop: 10 }}>
              <div className="tyg-receipt"><span>BEST SEASON BATTING AVG (“the gut”)</span><span className="n">{cal.gut}/{cal.total}</span></div>
              <div className="tyg-receipt"><span>BEST PRESSURE-GAME AVG (“the split”)</span><span className="n">{cal.data}/{cal.total}</span></div>
              <div className="tyg-receipt"><span>HIGHEST CLUTCH FACTOR™</span><span className="n">{cal.clutch}/{cal.total}</span></div>
            </div>
            <p className="tyg-small" style={{ marginTop: 12 }}>
              The mental measures beat the box score — and Clutch Factor gets there from an assessment,
              without needing 24 games of stat lines to find out the hard way.
            </p>
          </div>
          <div className="tyg-footrow" style={{ justifyContent: "center" }}>
            <button type="button" className="tyg-btn" onClick={start}>▶ PLAY AGAIN</button>
            <button type="button" className="tyg-btn tyg-btn--ghost" onClick={onHome}>ARCADE MENU</button>
          </div>
        </div>
      </div>
    );
  }

  // ── round screen ──
  const g = round.game;
  return (
    <div className="tyg">
      <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
      <div className="tyg-wrap">
        <div className="tyg-panel tyg-score">
          <b>ROUND {idx + 1}/{ROUNDS.length}</b>
          <b><span className="gut">GUT {gut}</span> · <span className="data">DATA {data}</span></b>
          <b className="tyg-small">{fmtDate(g.date)} · VS {g.opponent.toUpperCase()} · {g.home_away === "H" ? "HOME" : "AWAY"}</b>
        </div>

        <div className="tyg-panel">
          <h2 className="tyg-h2">INNING {round.moment.inning} · LEVERAGE {"▮".repeat(round.moment.leverage)}{"▯".repeat(5 - round.moment.leverage)}</h2>
          <p className="tyg-p">{round.intro}</p>
        </div>

        <div className="tyg-cards">
          {round.candidates.map((c) => (
            <CandidateCard
              key={c.athlete.id}
              c={c}
              round={round}
              picked={pick === c.athlete.id}
              locked={locked}
              onPick={() => setPick(c.athlete.id)}
            />
          ))}
        </div>

        {!locked ? (
          <div className="tyg-footrow">
            <button type="button" className={"tyg-btn" + (pick ? " tyg-glow" : "")} onClick={lockIn} disabled={!pick}>
              {pick ? "LOCK IT IN ▶" : "SELECT A PLAYER"}
            </button>
            <span className="tyg-small">1. TAP A CARD · 2. LOCK IT IN — box scores only, no peeking at the mental side.</span>
          </div>
        ) : (
          <>
            <div className="tyg-panel tyg-reveal">
              <h2 className="tyg-h2">WHAT ACTUALLY HAPPENED</h2>
              <p className="who tyg-p">
                {ROUNDS[idx].candidates.find((c) => c.athlete.id === round.actualId)?.athlete.name.toUpperCase()} — {round.moment.action.toUpperCase()}
              </p>
              <p className="tyg-points">
                {pick === round.actualId && <span className="gut">GUT +1</span>}
                {round.dataPickId === round.actualId && <span className="data">DATA +1</span>}
                {pick !== round.actualId && round.dataPickId !== round.actualId && <span className="none">NO POINTS — THE GAME HUMBLES EVERYONE</span>}
              </p>
              <p className="tyg-p tyg-small">{round.story}</p>
            </div>
            <div className="tyg-footrow">
              <button type="button" className="tyg-btn" onClick={next}>
                {idx + 1 >= ROUNDS.length ? "FINAL SCORE ▶" : "NEXT MOMENT ▶"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
