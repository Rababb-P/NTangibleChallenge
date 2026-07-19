// Player mode — Build Your Game.
// 1. CHARACTER SELECT: pick which athlete YOU are.
// 2. Five trio rounds: three teammates faced the same kind of pressure in
//    their own games. You see signals (trajectory, reps, reset, her words) —
//    never the raw score — and bet on who delivered. Reveal teaches the lesson.
// 3. YOUR TRAINING PLAN: your weakest mental domain, the drills that train it,
//    and the weekly pace of the athletes whose scores actually climbed.
import { useState, type CSSProperties } from "react";
import { TRIOS, takeawaysFor, type TrioCard } from "./playerRounds";
import { PlayScene } from "./PlayScene";
import {
  ATHLETES, athleteById, fmtAvg, fmtDelta, STATS,
  domainsOf, weakestDomain, drillsForAxis,
  growersPace, growersDelta, myPace, GROWERS,
} from "./stats";

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// 0–100 domain score as a 10-block pixel meter.
const blocks = (score: number) => "▮".repeat(Math.round(score / 10)) + "▯".repeat(10 - Math.round(score / 10));

function SignalCard({ c, picked, locked, onPick }: {
  c: TrioCard; picked: boolean; locked: boolean; onPick: () => void;
}) {
  const a = c.athlete;
  return (
    <button
      type="button"
      className={"tyg-card" + (locked ? " flipped" : "") + (picked ? " picked" : "")}
      onClick={onPick}
      disabled={locked}
      style={{ "--accent": a.color } as CSSProperties}
    >
      <div className="tyg-card-inner">
        {/* FRONT — signals only. The raw Clutch Factor stays hidden. */}
        <div className="tyg-face front">
          {picked && !locked && <span className="tyg-badge bet">YOUR BET</span>}
          <span className="tyg-jersey">#{a.jersey} · {a.position} · HER MOMENT: {fmtDate(c.moment.date)}</span>
          <span className="tyg-name">{a.name}</span>
          <div className="tyg-mrow"><span className="k">3-MO TRAJECTORY</span><span className={"v " + (c.trend >= 0 ? "up" : "down")}>{fmtDelta(c.trend)}</span></div>
          <div className="tyg-mrow"><span className="k">REPS, LAST 30D</span><span className="v">{c.reps30}</span></div>
          <div className="tyg-mrow"><span className="k">RESET SPEED</span><span className="v">{c.stats.resetAvg ? c.stats.resetAvg.toFixed(1) + " pitches" : "—"}</span></div>
          <div className="tyg-mrow"><span className="k">SEASON AVG</span><span className="v">{fmtAvg(c.stats.avg)}</span></div>
          <span className="tyg-small" style={{ marginTop: "auto" }}>“{a.quote}”</span>
        </div>
        {/* BACK — her outcome, and the score she carried into it */}
        <div className={"tyg-face back " + (c.delivered ? "won" : "lost")}>
          {c.delivered && <span className="tyg-badge hit">DELIVERED!</span>}
          <span className="tyg-name">{a.name}</span>
          <span className={"tyg-out " + (c.delivered ? "pos" : "neg")}>{c.delivered ? "CAME THROUGH" : "DIDN'T"}</span>
          <span className="tyg-small">{c.moment.action.toUpperCase()}</span>
          <div className="tyg-mrow" style={{ marginTop: "auto" }}><span className="k">CLUTCH FACTOR AT THE TIME</span><span className="v">{c.cfAt}</span></div>
          <div className="tyg-mrow"><span className="k">VS {c.game.opponent.toUpperCase()}</span><span className="v">{c.game.result === "W" ? "WIN" : "LOSS"} {c.game.team_runs}–{c.game.opp_runs}</span></div>
        </div>
      </div>
    </button>
  );
}

export function PlayerMode({ onHome }: { onHome: () => void }) {
  const [me, setMe] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  // Which athlete's outcome the scene is showing (defaults to your pick), and
  // a counter that remounts the scene so the same animation can run again.
  const [replay, setReplay] = useState<string | null>(null);
  const [take, setTake] = useState(0);

  const exit = () => { window.location.hash = ""; };
  const restart = () => { setMe(null); setIdx(0); setPick(null); setLocked(false); setScore(0); setDone(false); setReplay(null); };

  // ── character select ──
  if (!me)
    return (
      <div className="tyg">
        <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
        <div className="tyg-wrap" style={{ textAlign: "center" }}>
          <p className="tyg-small">PLAYER MODE</p>
          <h1 className="tyg-h1" style={{ fontSize: 26 }}>SELECT YOUR PLAYER</h1>
          <p className="tyg-p">The rounds are the team's story. The ending is yours: the training plan at the end is built for whoever you pick.</p>
          <div className="tyg-roster">
            {ATHLETES.map((a) => (
              <button
                key={a.id}
                type="button"
                className="tyg-chip"
                style={{ "--accent": a.color } as CSSProperties}
                onClick={() => setMe(a.id)}
              >
                <span className="tyg-jersey">#{a.jersey}</span>
                <span className="tyg-chip-name">{a.name}</span>
                <span className="tyg-small">{a.position} · {a.tier.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <button type="button" className="tyg-btn tyg-btn--ghost" onClick={onHome}>ARCADE MENU</button>
        </div>
      </div>
    );

  const my = athleteById[me];

  // ── training plan (the ending) ──
  if (done) {
    const weak = weakestDomain(me);
    const drills = drillsForAxis(weak.key);
    const pace = myPace(me);
    const target = growersPace();
    return (
      <div className="tyg">
        <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
        <div className="tyg-wrap">
          <div style={{ textAlign: "center" }}>
            <p className="tyg-small">YOU READ {score}/{TRIOS.length} MOMENTS RIGHT</p>
            <h1 className="tyg-h1" style={{ fontSize: 26 }}>BUILD YOUR GAME, {my.name.split(" ")[0].toUpperCase()}</h1>
          </div>

          <div className="tyg-panel">
            <h2 className="tyg-h2">YOUR MENTAL SCOUTING REPORT</h2>
            {domainsOf(me).map((d) => (
              <div className="tyg-mrow" key={d.key} style={{ padding: "4px 0" }}>
                <span className="k">{d.name.toUpperCase()}{d.key === weak.key ? " — TRAIN THIS" : ""}</span>
                <span className={"v " + (d.key === weak.key ? "down" : "")}>{blocks(d.score)} {d.score}</span>
              </div>
            ))}
            <p className="tyg-small" style={{ marginTop: 10 }}>{weak.summary}</p>
          </div>

          <div className="tyg-panel">
            <h2 className="tyg-h2">YOUR DRILLS — {weak.name.toUpperCase()} REPS</h2>
            {drills.map((d) => (
              <div key={d.id} className="tyg-receipt">
                <span>{d.title.toUpperCase()} <span className="tyg-small">({d.duration_min} MIN)</span><br />
                  <span className="tyg-small">{d.description}</span></span>
              </div>
            ))}
          </div>

          <div className="tyg-panel">
            <h2 className="tyg-h2">THE PACE THAT WORKS</h2>
            <p className="tyg-p tyg-small">
              The {GROWERS.length} athletes whose Clutch Factor climbed 150+ points this cycle averaged{" "}
              <span style={{ color: "var(--green)" }}>{target.toFixed(1)} sessions a week</span>. Your current pace:{" "}
              <span style={{ color: pace >= target ? "var(--green)" : "var(--amber)" }}>{pace.toFixed(1)}/week</span>.
              Their average climb: <span style={{ color: "var(--green)" }}>+{Math.round(growersDelta())}</span>.
              Yours so far: <span style={{ color: STATS[me].clutchDelta >= 150 ? "var(--green)" : "var(--amber)" }}>{fmtDelta(STATS[me].clutchDelta)}</span>.
            </p>
            <p className="tyg-p tyg-small">
              Reps don't buy you any single moment. They buy you the trajectory —
              and the trajectory is what keeps showing up when the game gets tight.
            </p>
          </div>

          <div className="tyg-footrow" style={{ justifyContent: "center" }}>
            <button type="button" className="tyg-btn" onClick={restart}>▶ PLAY AS SOMEONE ELSE</button>
            <button type="button" className="tyg-btn tyg-btn--ghost" onClick={onHome}>ARCADE MENU</button>
          </div>
        </div>
      </div>
    );
  }

  // ── trio rounds ──
  const round = TRIOS[idx];
  const pickedCard = round.cards.find((c) => c.athlete.id === pick);
  const sceneCard = round.cards.find((c) => c.athlete.id === replay) ?? pickedCard;
  const lockIn = () => {
    if (!pick) return;
    setLocked(true);
    setReplay(pick);
    if (pick === round.winnerId) setScore((n) => n + 1);
  };
  const next = () => {
    if (idx + 1 >= TRIOS.length) { setDone(true); return; }
    setIdx(idx + 1); setPick(null); setLocked(false); setReplay(null);
  };

  return (
    <div className="tyg">
      <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
      <div className="tyg-wrap">
        <div className="tyg-panel tyg-score">
          <b>ROUND {idx + 1}/{TRIOS.length} · {round.theme}</b>
          <b><span className="data">READS {score}</span></b>
          <b className="tyg-small">PLAYING AS {my.name.toUpperCase()}</b>
        </div>

        <div className="tyg-panel">
          <p className="tyg-p">{round.prompt}</p>
          <p className="tyg-small" style={{ marginTop: 8 }}>
            1. TAP A CARD TO PLACE YOUR BET &nbsp;·&nbsp; 2. LOCK IT IN — signals only, no scores.
          </p>
        </div>

        <PlayScene
          key={idx + (locked ? "-live-" + replay + "-" + take : "-idle")}
          playing={locked}
          kind={sceneCard?.kind ?? "hit"}
          flash={sceneCard?.flash ?? ""}
          good={!!sceneCard?.delivered}
          bases={round.bases}
          accent={sceneCard?.athlete.color ?? "#e8e8ff"}
        />

        {/* instant replay booth: run any of the three outcomes, as often as you like */}
        {locked && (
          <div className="tyg-footrow" style={{ justifyContent: "center" }}>
            {round.cards.map((c) => (
              <button
                key={c.athlete.id}
                type="button"
                className={"tyg-replay" + (replay === c.athlete.id ? " on" : "")}
                style={{ "--accent": c.athlete.color } as CSSProperties}
                onClick={() => { setReplay(c.athlete.id); setTake((n) => n + 1); }}
              >
                ▶ {c.athlete.name.split(" ")[0].toUpperCase()} · {c.flash}
              </button>
            ))}
            <button type="button" className="tyg-replay" onClick={() => setTake((n) => n + 1)}>
              REPLAY ▶▶
            </button>
          </div>
        )}

        <div className="tyg-cards">
          {round.cards.map((c) => (
            <SignalCard
              key={c.athlete.id}
              c={c}
              picked={pick === c.athlete.id}
              locked={locked}
              onPick={() => setPick(c.athlete.id)}
            />
          ))}
        </div>

        {!locked ? (
          <div className="tyg-footrow">
            <button type="button" className={"tyg-btn" + (pick ? " tyg-glow" : "")} onClick={lockIn} disabled={!pick}>
              {pick ? "LOCK IT IN ▶" : "WHO DELIVERED?"}
            </button>
            {pickedCard && <span className="tyg-small">BETTING ON {pickedCard.athlete.name.toUpperCase()}</span>}
          </div>
        ) : (
          <>
            <div className="tyg-panel tyg-reveal">
              <h2 className="tyg-h2">{pick === round.winnerId ? "GOOD READ! +1" : "NOT THIS TIME"}</h2>
              <p className="tyg-p tyg-small">{round.lesson}</p>
            </div>
            {(() => {
              const t = takeawaysFor(me, round);
              return (
                <div className="tyg-panel">
                  <h2 className="tyg-h2">YOUR TAKEAWAY, {my.name.split(" ")[0].toUpperCase()}</h2>
                  {t.rows.map((r) => (
                    <div key={r.label} className="tyg-mrow" style={{ padding: "5px 0" }}>
                      <span className="k">{r.label}</span>
                      <span className="v">
                        HER {r.hers} · YOU {r.mine}
                        <span className={"tyg-verdict " + (r.good ? "ok" : "warn")}>{r.good ? "MAINTAIN" : "TRAIN THIS"}</span>
                      </span>
                    </div>
                  ))}
                  <p className="tyg-small" style={{ marginTop: 8 }}>{t.note}</p>
                </div>
              );
            })()}
            <div className="tyg-footrow">
              <button type="button" className="tyg-btn" onClick={next}>
                {idx + 1 >= TRIOS.length ? "YOUR TRAINING PLAN ▶" : "NEXT ROUND ▶"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
