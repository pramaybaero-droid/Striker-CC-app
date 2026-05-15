// Toss screen: spin the striker, reveal winner, winner picks Break or Side

function Toss({ match, onDone }) {
  const [phase, setPhase] = React.useState("idle"); // idle | spinning | winner | choosing
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

  const chooseBreak = (who) => {
    // Winner chose to break -> they break AND get White coins automatically.
    const newP1Color = winner === "p1" ? "White" : "Black";
    const newP2Color = winner === "p2" ? "White" : "Black";
    onDone({
      tossWinner: winner, tossChoice: "break", breakPlayer: winner,
      p1Color: newP1Color, p2Color: newP2Color,
    });
  };
  const chooseSide = () => setPhase("choosing");
  const confirmSide = (chosenColor) => {
    // Winner picks a side/color; opponent breaks.
    const other = winner === "p1" ? "p2" : "p1";
    // Swap colors so winner has the chosen color
    let newP1Color = match.p1.color, newP2Color = match.p2.color;
    if (winner === "p1" && match.p1.color !== chosenColor) { newP1Color = chosenColor; newP2Color = chosenColor === "White" ? "Black" : "White"; }
    if (winner === "p2" && match.p2.color !== chosenColor) { newP2Color = chosenColor; newP1Color = chosenColor === "White" ? "Black" : "White"; }
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
          {phase === "choosing" && <><em>{match[winner].name}</em> picks a side.</>}
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
                  <div className="big">Choose your side</div>
                  <div className="sub">Pick White or Black. Opponent breaks first.</div>
                </button>
              </div>
              <button className="btn ghost sm" onClick={spin} style={{ marginTop: 8 }}>Re-spin</button>
            </>
          )}

          {phase === "choosing" && (
            <>
              <div className="toss-choice">
                <button type="button" className="choice-card" onClick={() => confirmSide("White")}>
                  <div className="row" style={{ gap: 14 }}>
                    <Coin color="white" size={36} />
                    <div>
                      <div className="big">Take White</div>
                      <div className="sub">You play the ivory coins.</div>
                    </div>
                  </div>
                </button>
                <button type="button" className="choice-card" onClick={() => confirmSide("Black")}>
                  <div className="row" style={{ gap: 14 }}>
                    <Coin color="black" size={36} />
                    <div>
                      <div className="big">Take Black</div>
                      <div className="sub">You play the ebony coins.</div>
                    </div>
                  </div>
                </button>
              </div>
              <button className="btn ghost sm" onClick={() => setPhase("winner")}>Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Toss });
