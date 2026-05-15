// Scoreboard + Award panel + History + Match timer
// Edit access rules:
//   - Match owner: full control.
//   - Community admin or owner: full control plus admin-only match controls.
//   - Everyone else: read-only spectator mode.

function useMatchTimer(match) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (match.phase !== "live") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [match.phase]);
  const elapsed = match.startedAt ? ((match.endedAt || now) - match.startedAt) : 0;
  return elapsed;
}

function Scoreboard({ match, onUpdate, onClose, session, isAdmin }) {
  const [oppLeft, setOppLeft]         = React.useState(0);
  const [queen, setQueen]             = React.useState(false);
  const [confettiKey, setConfettiKey] = React.useState(0);
  const [setModal, setSetModal]       = React.useState(null);
  const [matchModal, setMatchModal]   = React.useState(false);

  const elapsed       = useMatchTimer(match);
  const limitPoints   = matchLimitPoints(match);
  const limitBoards   = matchLimitBoards(match);
  const queenCutoff   = matchQueenCutoff(match);
  const totalSetCount = safeTotalSets(match.totalSets);
  const neededSets    = Number(match.setsToWin) || setsNeeded(match);

  const mw = matchWinner(match);

  const isOwner   = !!match.ownerId && match.ownerId === session?.id;
  const canEdit   = isOwner || isAdmin;
  const canEditBy = isOwner ? "owner" : isAdmin ? "admin" : "none";

  const lastHistoryIdRef = React.useRef(match.history.length);
  React.useEffect(() => {
    const len = match.history.length;
    if (len > lastHistoryIdRef.current) {
      if (canEdit) {
        const lastNew = match.history.slice(lastHistoryIdRef.current).reverse()
          .find(h => h.kind === "set-end");
        if (lastNew) {
          chord([523, 659, 784, 1047], 0.3);
          setConfettiKey(k => k + 1);
          if (matchWinner(match)) setMatchModal(true);
          else setSetModal(lastNew);
        }
      }
    }
    lastHistoryIdRef.current = len;
  }, [match.history.length, canEdit]);

  const award = (to) => {
    if (!canEdit || mw) return;
    onUpdate(m => awardBoard(m, to, oppLeft, queen));
    setOppLeft(0);
    setQueen(false);
    ping(720, 0.08, "triangle", 0.05);
  };

  const doUndo = () => {
    if (!canEdit) return;
    const next = popUndo(match);
    if (!next) return;
    onUpdate(() => next);
    ping(360, 0.08, "sine", 0.05);
  };

  const doResetSet = () => {
    if (!canEdit) return;
    if (!confirm(`Reset current Set ${match.setNo}? This removes this set's boards.`)) return;
    onUpdate(m => resetSet(m));
  };
  const doResetMatch = () => {
    if (!canEdit) return;
    if (!confirm("Reset the entire match? Names and colors are kept.")) return;
    onUpdate(m => resetMatch(m));
  };
  const doSwap = () => {
    if (!canEdit) return;
    onUpdate(m => swapPlayers(m));
  };

  const doRollbackLastSet = () => {
    if (!isAdmin) return;
    const hasFinalizedSet = (match.history || []).some(h => h.kind === "set-end");
    if (!hasFinalizedSet) {
      alert("No completed set to roll back.");
      return;
    }
    if (!confirm("Admin: roll back the most recently completed set? Scores and sets won will be restored to mid-set.")) return;
    onUpdate(m => rollbackLastSet(m));
  };
  const doSkipSet = () => {
    if (!isAdmin) return;
    if (!confirm(`Admin: force-end Set ${match.setNo} right now? Whoever is ahead takes the set.`)) return;
    onUpdate(m => skipToNextSet(m));
  };
  const doReopenMatch = () => {
    if (!isAdmin) return;
    if (match.phase !== "over") return;
    if (!confirm("Admin: re-open this finished match so scores can be edited?")) return;
    onUpdate(m => reopenMatch(m));
  };

  const p1Lead = match.p1.setPts > match.p2.setPts;
  const p2Lead = match.p2.setPts > match.p1.setPts;
  const setPoint = !mw && (match.p1.setPts >= queenCutoff || match.p2.setPts >= queenCutoff);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (!canEdit) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match, canEdit]);

  return (
    <div className="shell">
      <Confetti trigger={confettiKey} />

      {!canEdit && (
        <div className="banner" style={{ marginBottom: 16, marginTop: 0 }}>
          <span style={{ color: "var(--gold)", fontWeight: 800 }}>View</span>
          <div>
            <strong>Read-only</strong> - this match is being run by{" "}
            <strong>{match.ownerName || "another player"}</strong>. You can watch scores update live but cannot change them. Scores from the cloud refresh automatically.
          </div>
        </div>
      )}
      {canEdit && canEditBy === "admin" && !isOwner && (
        <div className="banner" style={{ marginBottom: 16, marginTop: 0, borderColor: "var(--queen-2)", background: "rgba(201,52,76,0.08)" }}>
          <span style={{ color: "var(--queen)", fontWeight: 800 }}>Admin</span>
          <div>
            <strong>Admin mode</strong> - you are editing {match.ownerName ? <><strong>{match.ownerName}</strong>'s</> : "a"} match. All changes overwrite the cloud record.
          </div>
        </div>
      )}

      <div className="score-grid">
        <PlayerCard player={match.p1} playerKey="p1" match={match}
                    leading={p1Lead} winner={mw === "p1"} breakPlayer={match.breakPlayer} />

        <div className="center-card">
          {mw ? (
            <span className="status-tag match-over">Match Won</span>
          ) : setPoint ? (
            <span className="status-tag setpoint">Set Point</span>
          ) : (
            <span className="status-tag"><span className="live-dot" />Live</span>
          )}
          <div className="set-of" style={{ marginTop: 14 }}>Set</div>
          <div className="big-set">{match.setNo}</div>
          <div className="set-of">of {totalSetCount}</div>
          <div className="board-line">
            <span>Board</span>
            <span className="mono" style={{ color: "var(--cream)" }}>
              {Math.min(match.boardNo, limitBoards)} / {limitBoards}
            </span>
          </div>
          <div className="set-of" style={{ marginTop: 12 }}>{limitPoints} pts / Queen at {queenCutoff}+</div>
          <div className="timer">{fmtTime(elapsed)}</div>
        </div>

        <PlayerCard player={match.p2} playerKey="p2" match={match}
                    leading={p2Lead} winner={mw === "p2"} breakPlayer={match.breakPlayer} />
      </div>

      {canEdit && !mw && (
        <div className="award">
          <h3>Award the current board</h3>
          <div className="award-row">
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Opponent coins left</div>
              <div className="coin-stepper">
                <button onClick={() => setOppLeft(v => Math.max(0, v - 1))} aria-label="decrease">-</button>
                <div className="val">{oppLeft}</div>
                <button onClick={() => setOppLeft(v => Math.min(9, v + 1))} aria-label="increase">+</button>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Queen</div>
              <button type="button"
                      className={`queen-toggle ${queen ? "on" : ""}`}
                      onClick={() => setQueen(q => !q)}>
                <span className="queen-coin" />
                {queen ? "Covered (+3 if allowed)" : "Not covered"}
              </button>
            </div>
            <div />
            <div className="award-actions">
              <button className="btn dark" onClick={() => award("p1")}>
                Award to {match.p1.name}
              </button>
              <button className="btn primary" onClick={() => award("p2")}>
                Award to {match.p2.name}
              </button>
            </div>
            <div className="award-hint">
              Enter how many of the <strong>losing</strong> player's coins remain. Queen +3 is ignored only when the board winner already has {queenCutoff}+ points before this board.
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canEdit && (
          <>
            <button className="btn ghost sm" onClick={doUndo} disabled={!match.stack?.length}>Undo</button>
            <button className="btn ghost sm" onClick={doResetSet}>Reset Set</button>
            <button className="btn ghost sm" onClick={doResetMatch}>Reset Match</button>
            <button className="btn ghost sm" onClick={doSwap}>Swap Players</button>
          </>
        )}
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => exportJSON(match)}>Export JSON</button>
        <button className="btn ghost sm" onClick={() => exportCSV(match)}>Export CSV</button>
        <button className="btn ghost sm" onClick={onClose}>Close Match</button>
      </div>

      {isAdmin && (
        <>
          <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderColor: "var(--queen-2)", background: "rgba(201,52,76,0.04)" }}>
            <span className="eyebrow" style={{ color: "var(--queen)", marginRight: 6 }}>Admin</span>
            <button className="btn ghost sm" onClick={doRollbackLastSet}>Rollback last set</button>
            <button className="btn ghost sm" onClick={doSkipSet} disabled={!!mw}>Force-end current set</button>
            {match.phase === "over" && (
              <button className="btn crimson sm" onClick={doReopenMatch}>Re-open match</button>
            )}
            <div className="spacer" />
            <span className="tip">Owner: {match.ownerName || "-"} / id {match.ownerId ? match.ownerId.slice(0,8) : "-"}</span>
          </div>
          <AdminRulesEditor match={match} onApply={onUpdate} />
        </>
      )}

      <HistoryPanel match={match} />

      <Modal open={!!setModal} onClose={() => setSetModal(null)}>
        {setModal && <>
          <div className="stinger">Set {setModal.set} complete</div>
          <h2>
            {setModal.winner
              ? <>Set to <em>{setModal.winnerName}</em></>
              : <>Tied set</>}
          </h2>
          <div className="modal-score">
            {match.p1.name} {setModal.finalA} / {setModal.finalB} {match.p2.name}
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setSetModal(null)}>
              Next Set
            </button>
          </div>
        </>}
      </Modal>

      <Modal open={matchModal} onClose={() => setMatchModal(false)}>
        <div className="stinger crimson">Match Complete</div>
        <h2><em>{mw ? match[mw].name : ""}</em> wins</h2>
        <div className="modal-score">
          Sets {match.p1.setsWon} - {match.p2.setsWon} / first to {neededSets} / {fmtTime(elapsed)}
        </div>
        <div className="modal-actions">
          {canEdit && (
            <button className="btn primary" onClick={() => { doResetMatch(); setMatchModal(false); }}>
              Rematch
            </button>
          )}
          <button className="btn ghost" onClick={() => setMatchModal(false)}>Review Board</button>
        </div>
      </Modal>
    </div>
  );
}

function AdminRulesEditor({ match, onApply }) {
  const readDraft = React.useCallback(() => ({
    totalSets: safeTotalSets(match.totalSets),
    setsToWin: clampInt(match.setsToWin, 1, safeTotalSets(match.totalSets), setsNeeded(match)),
    limitPoints: clampInt(matchLimitPoints(match), 1, 99, 25),
    limitBoards: clampInt(matchLimitBoards(match), 1, 25, 8),
    queenCutoff: clampInt(matchQueenCutoff(match), 0, matchLimitPoints(match), 22),
    setNo: clampInt(match.setNo, 1, safeTotalSets(match.totalSets), 1),
    boardNo: clampInt(match.boardNo, 1, matchLimitBoards(match), 1),
  }), [match.id, match.totalSets, match.setsToWin, match.limitPoints, match.limitBoards, match.queenCutoff, match.setNo, match.boardNo]);

  const [draft, setDraft] = React.useState(readDraft);
  React.useEffect(() => setDraft(readDraft()), [readDraft]);

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const apply = () => {
    const totalSets = clampInt(draft.totalSets, 1, 9, safeTotalSets(match.totalSets));
    const setsToWin = clampInt(draft.setsToWin, 1, totalSets, setsNeeded(totalSets));
    const limitPoints = clampInt(draft.limitPoints, 1, 99, matchLimitPoints(match));
    const limitBoards = clampInt(draft.limitBoards, 1, 25, matchLimitBoards(match));
    const queenCutoff = clampInt(draft.queenCutoff, 0, limitPoints, Math.min(matchQueenCutoff(match), limitPoints));
    const setNo = clampInt(draft.setNo, 1, totalSets, Math.min(match.setNo || 1, totalSets));
    const boardNo = clampInt(draft.boardNo, 1, limitBoards, Math.min(match.boardNo || 1, limitBoards));

    onApply(m => {
      let next = pushUndo(m);
      next = {
        ...next,
        scoreFormat: "custom",
        totalSets,
        setsToWin,
        limitPoints,
        limitBoards,
        queenCutoff,
        setNo,
        boardNo,
      };
      const winner = matchWinner(next);
      if (winner) {
        return { ...next, phase: "over", endedAt: next.endedAt || Date.now() };
      }
      if (next.phase === "over") {
        return { ...next, phase: "live", endedAt: null };
      }
      return next;
    });
  };

  return (
    <div className="panel" style={{ borderColor: "var(--queen-2)", background: "rgba(201,52,76,0.04)" }}>
      <div className="panel-head">
        <h3>Admin match rules</h3>
        <button type="button" className="btn primary sm" onClick={apply}>Apply rules</button>
      </div>
      <div className="setup-controls" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 0 }}>
        <NumberField label="Total sets" value={draft.totalSets} min={1} max={9} onChange={v => update("totalSets", v)} />
        <NumberField label="Sets to win" value={draft.setsToWin} min={1} max={safeTotalSets(draft.totalSets)} onChange={v => update("setsToWin", v)} />
        <NumberField label="Points per set" value={draft.limitPoints} min={1} max={99} onChange={v => update("limitPoints", v)} />
        <NumberField label="Boards per set" value={draft.limitBoards} min={1} max={25} onChange={v => update("limitBoards", v)} />
        <NumberField label="Queen cutoff" value={draft.queenCutoff} min={0} max={clampInt(draft.limitPoints, 1, 99, 25)} onChange={v => update("queenCutoff", v)} />
        <NumberField label="Current set" value={draft.setNo} min={1} max={safeTotalSets(draft.totalSets)} onChange={v => update("setNo", v)} />
        <NumberField label="Current board" value={draft.boardNo} min={1} max={clampInt(draft.limitBoards, 1, 25, 8)} onChange={v => update("boardNo", v)} />
      </div>
      <div className="tip">
        Community admins can correct match format, current set, current board, scoring limit, board limit, and queen cutoff. Existing board history is kept.
      </div>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }) {
  return (
    <label className="name-field" style={{ display: "block", padding: 14 }}>
      <div className="eyebrow">{label}</div>
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function PlayerCard({ player, playerKey, match, leading, winner, breakPlayer }) {
  const cls = `player-card ${leading ? "leading" : ""} ${winner ? "winner-match" : ""}`;
  return (
    <div className={cls}>
      <div className="player-head">
        <Avatar name={player.name} color={player.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="player-name">{player.name}</div>
          {player.label && <div className="player-label eyebrow">{player.label}</div>}
          {match.matchType === "doubles" && player.members?.length > 1 && (
            <div className="member-list">{player.members.join(" + ")}</div>
          )}
          <div className="player-meta">
            <span className="chip"><Coin color={player.color.toLowerCase()} size={10} /> {player.color}</span>
            {breakPlayer === playerKey && <span className="chip break">Breaks</span>}
          </div>
        </div>
      </div>

      <div className="score-rows">
        <div className="score-cell">
          <div className="eyebrow">Set points</div>
          <div className="num">{player.setPts}</div>
        </div>
        <div className="score-cell">
          <div className="eyebrow">Sets won</div>
          <div className="num small">{player.setsWon}</div>
          <SetPips won={player.setsWon} max={Number(match.setsToWin) || setsNeeded(match)} />
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ match }) {
  const rows = match.history;
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Match history</h3>
        <div className="panel-actions">
          <span className="tip">
            {rows.filter(r => r.kind === "board").length} boards played
          </span>
        </div>
      </div>
      {!rows.length ? (
        <div className="empty">No boards yet - award the first one above.</div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>#</th><th>Set</th><th>Board</th><th>Winner</th>
                <th>Opp. Left</th><th>Queen</th><th>Pts</th>
                <th>{match.p1.name}</th><th>{match.p2.name}</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let n = 0;
                return rows.map((h, i) => {
                  if (h.kind === "set-end") {
                    return (
                      <tr key={i} className="set-row">
                        <td colSpan={10}>
                          Set {h.set} to {h.winnerName} / final {h.finalA}-{h.finalB}
                        </td>
                      </tr>
                    );
                  }
                  n += 1;
                  return (
                    <tr key={i}>
                      <td className="mono">{n}</td>
                      <td>{h.set}</td>
                      <td>{h.board}</td>
                      <td><span className="winner-badge">{h.winnerName}</span></td>
                      <td className="mono">{h.oppLeft}</td>
                      <td>{h.queen ? <span className="queen-badge">+3</span> : h.queenIgnored ? <span className="queen-badge ignored">Ignored</span> : "-"}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{h.pts}</td>
                      <td className="score-cell-inline">{h.setA}</td>
                      <td className="score-cell-inline">{h.setB}</td>
                      <td className="mono" style={{ color: "var(--muted)" }}>
                        {new Date(h.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Scoreboard, AdminRulesEditor, NumberField, PlayerCard, HistoryPanel });
