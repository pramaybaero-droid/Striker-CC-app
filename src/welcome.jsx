// Welcome screen: enter names and match rules. Coin colors are decided by the toss.

function Welcome({ onStart, onHelp }) {
  const [matchType, setMatchType] = React.useState("singles");
  const [totalSets, setTotalSets] = React.useState(3);
  const [scoreFormat, setScoreFormat] = React.useState("standard");
  const [n1, setN1] = React.useState("");
  const [n2, setN2] = React.useState("");
  const [teamA1, setTeamA1] = React.useState("");
  const [teamA2, setTeamA2] = React.useState("");
  const [teamB1, setTeamB1] = React.useState("");
  const [teamB2, setTeamB2] = React.useState("");

  const trim = (v) => v.trim();
  const singlesReady = trim(n1) && trim(n2) && trim(n1) !== trim(n2);
  const doublesReady = trim(teamA1) && trim(teamA2) && trim(teamB1) && trim(teamB2);
  const ready = matchType === "doubles" ? doublesReady : singlesReady;
  const rules = scoreRules(scoreFormat);

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    onStart({
      matchType,
      totalSets,
      scoreFormat,
      name1: trim(n1),
      name2: trim(n2),
      teamA1: trim(teamA1),
      teamA2: trim(teamA2),
      teamB1: trim(teamB1),
      teamB2: trim(teamB2),
    });
  };

  return (
    <div className="welcome">
      <form className="welcome-card" onSubmit={submit}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Strike / Pocket / Win</div>
        <h1>A new match<br/><em>begins.</em></h1>
        <p className="lede">
          Enter the competitors, choose the match rules, then toss the striker. Coin colors are decided after the toss.
        </p>

        <div className="setup-controls">
          <div className="setup-block">
            <div className="eyebrow">Players</div>
            <div className="option-row">
              <button type="button" className={`option-pill ${matchType === "singles" ? "active" : ""}`} onClick={() => setMatchType("singles")}>
                Singles
              </button>
              <button type="button" className={`option-pill ${matchType === "doubles" ? "active" : ""}`} onClick={() => setMatchType("doubles")}>
                Doubles
              </button>
            </div>
          </div>

          <div className="setup-block">
            <div className="eyebrow">Sets</div>
            <div className="option-row">
              <button type="button" className={`option-pill ${totalSets === 1 ? "active" : ""}`} onClick={() => setTotalSets(1)}>
                1 set
              </button>
              <button type="button" className={`option-pill ${totalSets === 3 ? "active" : ""}`} onClick={() => setTotalSets(3)}>
                3 sets
              </button>
            </div>
          </div>

          <div className="setup-block wide">
            <div className="eyebrow">Scoring</div>
            <div className="option-row">
              <button type="button" className={`option-pill ${scoreFormat === "standard" ? "active" : ""}`} onClick={() => setScoreFormat("standard")}>
                25 pts / 8 boards
              </button>
              <button type="button" className={`option-pill ${scoreFormat === "quick" ? "active" : ""}`} onClick={() => setScoreFormat("quick")}>
                15 pts / 4 boards
              </button>
            </div>
          </div>
        </div>

        {matchType === "singles" ? (
          <div className="names">
            <div className="name-field">
              <div className="eyebrow">Player one</div>
              <input autoFocus placeholder="Name..." value={n1} onChange={e => setN1(e.target.value)} maxLength={24} />
            </div>

            <div className="versus">vs.</div>

            <div className="name-field">
              <div className="eyebrow">Player two</div>
              <input placeholder="Name..." value={n2} onChange={e => setN2(e.target.value)} maxLength={24} />
            </div>
          </div>
        ) : (
          <div className="names doubles-names">
            <div className="name-field team-field">
              <div className="eyebrow">Team A</div>
              <input autoFocus placeholder="Player A1..." value={teamA1} onChange={e => setTeamA1(e.target.value)} maxLength={24} />
              <input placeholder="Player A2..." value={teamA2} onChange={e => setTeamA2(e.target.value)} maxLength={24} />
            </div>

            <div className="versus">vs.</div>

            <div className="name-field team-field">
              <div className="eyebrow">Team B</div>
              <input placeholder="Player B1..." value={teamB1} onChange={e => setTeamB1(e.target.value)} maxLength={24} />
              <input placeholder="Player B2..." value={teamB2} onChange={e => setTeamB2(e.target.value)} maxLength={24} />
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="tip">
            Next: toss the striker / {totalSets} set{totalSets === 1 ? "" : "s"} / {rules.limitPoints} points or {rules.limitBoards} boards
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            {onHelp && (
              <button type="button" className="btn ghost" onClick={onHelp}>
                How it works
              </button>
            )}
            <button type="submit" className="btn primary" disabled={!ready}>
              Toss the Striker ->
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

Object.assign(window, { Welcome });
