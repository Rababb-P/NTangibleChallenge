// The arcade shell: one title screen, two games.
// COACH MODE — Trust Your Gut: bet the box score against the mental data.
// PLAYER MODE — Build Your Game: read the signals, learn the lesson, leave
// with a training plan for the athlete you picked.
import { useState } from "react";
import { CoachMode } from "./CoachMode";
import { PlayerMode } from "./PlayerMode";
import { ROUNDS } from "./rounds";
import { TRIOS } from "./playerRounds";
import { PRESSURE_GAMES, GAMES } from "./stats";
import "./game.css";

export function Arcade() {
  const [mode, setMode] = useState<"title" | "coach" | "player">("title");
  const home = () => setMode("title");
  const exit = () => { window.location.hash = ""; };

  if (mode === "coach") return <CoachMode onHome={home} />;
  if (mode === "player") return <PlayerMode onHome={home} />;

  return (
    <div className="tyg">
      <button type="button" className="tyg-exit" onClick={exit}>✕ BACK TO APP</button>
      <div className="tyg-wrap" style={{ textAlign: "center", marginTop: "6vh" }}>
        <p className="tyg-small">NTANGIBLE ARCADE PRESENTS</p>
        <h1 className="tyg-h1">TRUST YOUR GUT?</h1>
        <p className="tyg-p">
          {PRESSURE_GAMES} of {GAMES.length} games this season were decided by 2 runs or less.
          Two ways to step into them:
        </p>
        <div className="tyg-modes">
          <button type="button" className="tyg-mode" onClick={() => setMode("coach")}>
            <span className="tyg-mode-name" style={{ color: "var(--amber)" }}>COACH MODE</span>
            <span className="tyg-mode-sub">{ROUNDS.length} real moments. Pick your hitter on the box score alone — then the mental data flips the cards. Your gut vs. the data, with receipts.</span>
            <span className="tyg-mode-go tyg-blink">▶ PRESS START</span>
          </button>
          <button type="button" className="tyg-mode" onClick={() => setMode("player")}>
            <span className="tyg-mode-name" style={{ color: "var(--cyan)" }}>PLAYER MODE</span>
            <span className="tyg-mode-sub">Pick who YOU are. Read {TRIOS.length} trios of teammates in the same pressure spot, bet on who delivered — and leave with a training plan built for you.</span>
            <span className="tyg-mode-go tyg-blink">▶ PRESS START</span>
          </button>
        </div>
        <p className="tyg-small">A SYNTHETIC SEASON · EVERY NUMBER COMPUTED LIVE FROM data/</p>
      </div>
    </div>
  );
}
