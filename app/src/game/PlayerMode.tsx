// Player mode — Build Your Game.
// 1. ARCADE ATTRACT SCREEN, then character select: pick which athlete YOU are.
// 2. Five trio rounds: three teammates faced the same kind of pressure in
//    their own games. You see signals (trajectory, reps, her words) —
//    never the raw score — and bet on who delivered. Reveal teaches the lesson.
// 3. YOUR TRAINING PLAN: the domain where the clutch group outpaces you,
//    and drills that train that exact area.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TRIOS, takeawaysFor, basesLabel, type TrioCard, type TrioRound } from "./playerRounds";
import { PlayScene } from "./PlayScene";
import { callOutcome, callPreRound, callReplay, isCommentaryOn, setCommentaryOn, stop } from "./announcer";
import { CaptionBar, CommentaryToggle } from "./Commentary";
import { RoundLongView } from "./SeasonStories";
import type { SpeechLine } from "./speech";
import {
  ATHLETES, athleteById, fmtAvg, fmtDelta,
  domainsOf, drillsForAxis,
} from "./stats";

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
          <span className="tyg-role">{c.role}</span>
          {/* her spot: where and when — the stakes are pre-known, never the result */}
          <span className="tyg-small">VS {c.game.opponent.toUpperCase()} · INN {c.moment.inning} · {c.game.home_away === "H" ? "HOME" : "AWAY"}</span>
          <div className="tyg-mrow"><span className="k">LEVERAGE</span><span className="v">{"▮".repeat(c.moment.leverage)}{"▯".repeat(5 - c.moment.leverage)}</span></div>
          <div className="tyg-mrow"><span className="k">CLUTCH FACTOR · 3-MO CHANGE</span><span className={"v " + (c.trend >= 0 ? "up" : "down")}>{fmtDelta(c.trend)}</span></div>
          <div className="tyg-mrow"><span className="k">REPS, LAST 30D</span><span className="v">{c.reps30}</span></div>
          <div className="tyg-mrow"><span className="k">RESET PITCHES</span><span className="v">{c.stats.resetAvg?.toFixed(1) ?? "—"} AVG</span></div>
          <div className="tyg-mrow"><span className="k">SEASON BATTING AVG</span><span className="v">{fmtAvg(c.stats.avg)}</span></div>
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

// The pre-bet situation panel: the prompt plus scoreboard chips parsed from
// the situation text — bases, outs, count, stakes. All spoiler-safe.
function SituationBoard({ round }: { round: TrioRound }) {
  const chips: { label: string; info?: boolean }[] = [
    { label: basesLabel(round.bases) },
    ...(round.outs != null ? [{ label: "OUTS: " + round.outs }] : []),
    ...(round.count ? [{ label: "COUNT: " + round.count }] : []),
    ...round.stakes.map((s) => ({ label: s, info: true })),
  ];
  return (
    <div className="tyg-panel">
      <p className="tyg-p">{round.prompt}</p>
      <div className="tyg-sit-chips">
        {chips.map((c) => (
          <span key={c.label} className={"tyg-sit-chip" + (c.info ? " info" : "")}>{c.label}</span>
        ))}
      </div>
      <p className="tyg-small" style={{ marginTop: 8 }}>
        1. TAP A CARD TO PLACE YOUR BET &nbsp;·&nbsp; 2. LOCK IT IN — signals only, no scores.
      </p>
    </div>
  );
}

export function PlayerMode() {
  const [started, setStarted] = useState(false);
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
  // booth commentary: on/off, the current call for the captions, active line
  const [commentary, setCommentary] = useState(isCommentaryOn());
  const [caption, setCaption] = useState<SpeechLine[]>([]);
  const [captionAt, setCaptionAt] = useState(-1);
  const announcedLockIdx = useRef(-1); // outcome already called for this round?

  // The exact string that remounts the scene animation — the announcer keys
  // off it too, so voice and animation can never disagree.
  const sceneKey = idx + (locked ? "-live-" + replay + "-" + take : "-idle");

  useEffect(() => {
    if (!me || done || !commentary) { stop(); setCaption([]); return; }
    const round = TRIOS[idx];
    const onLine = (i: number) => setCaptionAt(i);
    let lines: SpeechLine[];
    if (!locked) {
      lines = callPreRound(round, onLine);
    } else {
      const card = round.cards.find((c) => c.athlete.id === replay);
      if (!card) { setCaption([]); return; }
      if (announcedLockIdx.current !== idx) {
        announcedLockIdx.current = idx; // LOCK IT IN: the full outcome call
        lines = callOutcome(card, pick === round.winnerId, onLine);
      } else {
        lines = callReplay(card, onLine); // booth re-run: short call, no verdict
      }
    }
    setCaption(lines);
    setCaptionAt(-1);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sceneKey covers idx/locked/replay/take; pick is frozen once locked
  }, [sceneKey, me, done, commentary]);
  useEffect(() => () => stop(), []); // never let speech outlive the arcade

  const toggleCommentary = (on: boolean) => { setCommentaryOn(on); setCommentary(on); };

  const restart = () => { setMe(null); setIdx(0); setPick(null); setLocked(false); setScore(0); setDone(false); setReplay(null); announcedLockIdx.current = -1; };

  if (!started)
    return (
      <div className="tyg tyg-attract">
        <div className="tyg-marquee">NTANGIBLE ARCADE</div>
        <div className="tyg-cabinet">
          <p className="tyg-small">PLAYER ONE // MENTAL GAME SIMULATOR</p>
          <h1 className="tyg-h1">CLUTCH UP</h1>
          <div className="tyg-pixel-ball" aria-hidden="true">◆</div>
          <p className="tyg-p tyg-attract-copy">
            The game is tight. The signals are live. Read the pressure, call who delivers,
            then see how your mental game stacks up against the players who came through.
          </p>
          <div className="tyg-attract-stats">
            <span>{TRIOS.length} PRESSURE MOMENTS</span>
            <span>3 PLAYERS PER ROUND</span>
            <span>1 TRAINING PLAN</span>
          </div>
          <button type="button" className="tyg-btn tyg-start tyg-blink" onClick={() => setStarted(true)}>
            INSERT COIN ▶
          </button>
          <p className="tyg-small">READ THE SIGNALS // TRUST THE WORK</p>
        </div>
      </div>
    );

  // ── character select ──
  if (!me)
    return (
      <div className="tyg">
        <CommentaryToggle on={commentary} onToggle={toggleCommentary} />
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
        </div>
      </div>
    );

  const my = athleteById[me];

  // ── training plan (the ending) ──
  if (done) {
    const clutchCards = TRIOS.map((r) => r.cards.find((c) => c.athlete.id === r.winnerId)!).filter(Boolean);
    const domainComparisons = domainsOf(me).map((mine) => {
      const group = Math.round(clutchCards.reduce((sum, c) =>
        sum + (domainsOf(c.athlete.id).find((d) => d.key === mine.key)?.score ?? 0), 0) / clutchCards.length);
      return { ...mine, group, gap: group - mine.score };
    }).sort((a, b) => b.gap - a.gap);
    const groupGap = domainComparisons.find((d) => d.gap > 0);
    const focus = groupGap ?? [...domainComparisons].sort((a, b) => a.score - b.score)[0];
    const drills = focus ? drillsForAxis(focus.key) : [];
    return (
      <div className="tyg">
        <button type="button" className="tyg-exit" onClick={restart}>↺ SELECT PLAYER</button>
        <div className="tyg-wrap">
          <div style={{ textAlign: "center" }}>
            <p className="tyg-small">YOU READ {score}/{TRIOS.length} MOMENTS RIGHT</p>
            <h1 className="tyg-h1" style={{ fontSize: 26 }}>BUILD YOUR GAME, {my.name.split(" ")[0].toUpperCase()}</h1>
          </div>

          <div className="tyg-panel">
            <h2 className="tyg-h2">THE PLAYERS WHO CLUTCHED UP</h2>
            <p className="tyg-small">The five outcomes you just watched—and who delivered each one.</p>
            {clutchCards.map((c, i) => (
              <div className="tyg-receipt" key={c.moment.moment_id}>
                <span>R{i + 1} // {c.athlete.name.toUpperCase()}<br /><span className="tyg-small">{c.moment.action.toUpperCase()}</span></span>
                <span className="n">CLUTCHED UP</span>
              </div>
            ))}
          </div>

          <div className="tyg-panel tyg-matchup">
            <h2 className="tyg-h2">YOU VS. THE PLAYERS WHO DELIVERED</h2>
            {focus && <>
              <p className="tyg-p">{groupGap
                ? <>Your clearest upgrade is <span className="data">{focus.name.toUpperCase()}</span>—the largest area where the players who delivered scored above you.</>
                : <>You beat this clutch group’s average in every domain. Your next development area is still <span className="data">{focus.name.toUpperCase()}</span> because it is your lowest personal score—not because the group scored higher.</>}</p>
              <div className="tyg-matchup-head"><span>YOUR GAME</span><span>CLUTCH GROUP</span></div>
              <div className="tyg-matchup-row">
                <span><b>{focus.score}</b><small>{focus.name}</small></span>
                <em>VS</em>
                <span><b>{focus.group}</b><small>Group average</small></span>
              </div>
              <p className="tyg-small" style={{ marginTop: 12 }}>{focus.summary}</p>
            </>}
          </div>

          {focus && <div className="tyg-panel">
            <h2 className="tyg-h2">YOUR DRILLS — {focus.name.toUpperCase()} REPS</h2>
            {drills.map((d) => (
              <details key={d.id} className="tyg-drill">
                <summary>{d.title.toUpperCase()} <span>{d.duration_min} MIN</span></summary>
                <div className="tyg-drill-body">
                  <p>{d.description}</p>
                  {d.steps.length > 0 && <ol>{d.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
                  {d.video_url && <a className="tyg-video" href={d.video_url} target="_blank" rel="noreferrer">WATCH ON YOUTUBE ▶</a>}
                </div>
              </details>
            ))}
          </div>}

          <div className="tyg-footrow" style={{ justifyContent: "center" }}>
            <button type="button" className="tyg-btn" onClick={restart}>▶ PLAY AS SOMEONE ELSE</button>
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
      <button type="button" className="tyg-exit" onClick={restart}>↺ SELECT PLAYER</button>
      <CommentaryToggle on={commentary} onToggle={toggleCommentary} />
      <div className="tyg-wrap">
        <div className="tyg-panel tyg-score">
          <b>ROUND {idx + 1}/{TRIOS.length} · {round.theme}</b>
          <b><span className="data">READS {score}</span></b>
          <b className="tyg-small">PLAYING AS {my.name.toUpperCase()}</b>
        </div>

        <SituationBoard round={round} />

        <PlayScene
          key={sceneKey}
          playing={locked}
          kind={sceneCard?.kind ?? "hit"}
          flash={sceneCard?.flash ?? ""}
          good={!!sceneCard?.delivered}
          bases={round.bases}
          accent={sceneCard?.athlete.color ?? "#e8e8ff"}
          role={(sceneCard ?? round.cards[0])?.role ?? "AT THE PLATE"}
          dir={sceneCard?.dir}
        />

        {commentary && <CaptionBar lines={caption} at={captionAt} />}

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
              <p className="tyg-small">HOW TO READ IT: CF 3-MO is the change in Clutch Factor over the prior three months. Batting AVG is the season batting average. Higher values and more reps can be favorable; fewer reset pitches is favorable. They are correlations—not guarantees.</p>
              <div className="tyg-round-compare">
                <div className="tyg-round-compare-head"><span>PLAYER</span><span>CF 3-MO</span><span>REPS</span><span>RESET</span><span>BATTING AVG</span><span>RESULT</span></div>
                {[...round.cards].sort((a, b) => Number(b.delivered) - Number(a.delivered)).map((c) => (
                  <div className={"tyg-round-compare-row" + (c.delivered ? " winner" : "")} key={c.athlete.id}>
                    <span>{c.athlete.name.split(" ")[0].toUpperCase()}</span>
                    <span>{fmtDelta(c.trend)}</span>
                    <span>{c.reps30}</span>
                    <span>{c.stats.resetAvg?.toFixed(1) ?? "—"}</span>
                    <span>{fmtAvg(c.stats.avg)}</span>
                    <span>{c.delivered ? "DELIVERED" : "MISS"}</span>
                  </div>
                ))}
              </div>
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
            <RoundLongView athleteIds={round.cards.map((card) => card.athlete.id)} />
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
