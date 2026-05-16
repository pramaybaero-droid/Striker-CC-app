// Toss screen: spin the striker, reveal winner, winner picks Break or Side

function Toss({ match, onDone }) {
  const [phase, setPhase] = React.useState("idle"); // idle | spinning | winner
  const [winner, setWinner] = React.useState(null); // "p1" | "p2"

  const p1 = match.p1, p2 = match.p2;

  const spin = () => {
    setPhase("spinning");
    ping(520, 0.1, "triangle", 0.06);
    setTimeout(() => ping(660, 0.08, "triangle", 0.05), 200);
    setTimeout(() => ping(780, 0.08, "triangle", 0.04), 400);
    setTimeout(() => {
      const w = Math.random() < 0.5 ? "p1" : "p2";
      setWinner(w);
      setPhase("winner");
      chord([523, 659, 784], 0.25);
    }, 1300);
  };

  const chooseBreak = () => {
    // Winner breaks first -> winner takes White, opponent takes Black.
    const newP1Color = winner === "p1" ? "White" : "Black";
    const newP2Color = winner === "p2" ? "White" : "Black";
    onDone({
      tossWinner: winner, tossChoice: "break", breakPlayer: winner,
      p1Color: newP1Color, p2Color: newP2Color,
    });
  };
  const chooseSide = () => {
    // Winner declines to break -> winner takes Black, opponent breaks with White.
    const other = winner === "p1" ? "p2" : "p1";
    const newP1Color = winner === "p1" ? "Black" : "White";
    const newP2Color = winner === "p2" ? "Black" : "White";
    onDone({
      tossWinner: winner, tossChoice: "side", breakPlayer: other,
      p1Color: newP1Color, p2Color: newP2Color,
    });
  };

  return (
    <div className="shell">
      <div className="welcome-card" style={{ maxWidth: 780, margin: "0 auto" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>The Toss</div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)" }}>
          {phase === "idle" && <>Spin the <em>striker.</em></>}
          {phase === "spinning" && <>Spinning...</>}
          {phase === "winner" && <>The toss goes to <em>{match[winner].name}.</em></>}
        </h1>

        <div className="toss-stage">
          <div className={`striker ${phase==="spinning" ? "spin" : ""}`}>
            <div className="ring" />
            <div className="center" />
          </div>

          {phase === "idle" && (
            <>
              <p className="tip" style={{ textAlign: "center", maxWidth: 460 }}>
                {p1.name} vs {p2.name}. The winner of the toss chooses whether to break or pick a side.
              </p>
              <button className="btn primary" onClick={spin}>Flip the Striker</button>
            </>
          )}

          {phase === "winner" && (
            <>
              <div className="toss-result">
                Choose, <em>{match[winner].name}</em>.
              </div>
              <div className="toss-choice">
                <button type="button" className="choice-card" onClick={chooseBreak}>
                  <div className="eyebrow">Option A</div>
                  <div className="big">Break first</div>
                  <div className="sub">You strike first on board 1 with the <strong>White</strong> coins.</div>
                </button>
                <button type="button" className="choice-card" onClick={chooseSide}>
                  <div className="eyebrow">Option B</div>
                  <div className="big">Let opponent break</div>
                  <div className="sub">You take <strong>Black</strong> carrommen and can switch sides. Opponent breaks first with White.</div>
                </button>
              </div>
              <button className="btn ghost sm" onClick={spin} style={{ marginTop: 8 }}>Re-spin</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Toss });
