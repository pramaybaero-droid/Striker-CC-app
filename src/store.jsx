// Store hook - manages list of matches + active id + persistence

function useStore(communityId) {
  const readState = React.useCallback((cid) => {
    const { matches, activeId } = loadAll(cid);
    return { matches: matches || [], activeId: activeId || null, communityId: cid || null };
  }, []);

  const [state, setState] = React.useState(() => {
    return readState(communityId);
  });

  React.useEffect(() => {
    setState(readState(communityId));
  }, [communityId, readState]);

  // Autosave on every change, scoped by community.
  React.useEffect(() => {
    if (state.communityId !== (communityId || null)) return;
    persistAll(state.matches, state.activeId, communityId);
  }, [state, communityId]);

  const createMatch = React.useCallback((opts) => {
    const m = defaultMatch({ ...opts, communityId });
    setState(s => {
      const base = s.communityId === (communityId || null) ? s : readState(communityId);
      return { ...base, matches: [...base.matches, m], activeId: m.id };
    });
    return m.id;
  }, [communityId, readState]);

  const closeMatch = React.useCallback((id) => {
    setState(s => {
      const matches = s.matches.filter(m => m.id !== id);
      const activeId = s.activeId === id ? (matches[matches.length-1]?.id || null) : s.activeId;
      return { ...s, matches, activeId };
    });
  }, []);

  const setActive = React.useCallback((id) => setState(s => ({ ...s, activeId: id })), []);

  const updateMatch = React.useCallback((id, updater) => {
    setState(s => ({
      ...s,
      matches: s.matches.map(m => {
        if (m.id !== id) return m;
        const next = typeof updater === "function" ? updater(m) : { ...m, ...updater };
        next.updatedAt = Date.now();
        return next;
      })
    }));
  }, []);

  // Insert-or-replace a match (used when loading from cloud, or accepting realtime updates)
  const upsertAndActivate = React.useCallback((match, { activate = true } = {}) => {
    setState(s => {
      const idx = s.matches.findIndex(x => x.id === match.id);
      const matches = idx >= 0
        ? s.matches.map((x, i) => i === idx ? match : x)
        : [...s.matches, match];
      return { ...s, matches, activeId: activate ? match.id : s.activeId };
    });
  }, []);

  // Replace a match in place without changing activeId (used by realtime spectator sync)
  const replaceMatch = React.useCallback((match) => {
    setState(s => {
      const idx = s.matches.findIndex(x => x.id === match.id);
      if (idx < 0) return s;
      const matches = s.matches.map((x, i) => i === idx ? match : x);
      return { ...s, matches };
    });
  }, []);

  const active = state.matches.find(m => m.id === state.activeId) || null;

  return { state, active, createMatch, closeMatch, setActive, updateMatch, upsertAndActivate, replaceMatch };
}

// ------- Pure state transitions (match mutators) -------

function pushUndo(m) {
  // Don't store the stack inside each snapshot (prevents exponential growth)
  const { stack: _omit, ...rest } = m;
  const snap = JSON.stringify(rest);
  const stack = [...(m.stack || []), snap];
  if (stack.length > 50) stack.shift();
  return { ...m, stack };
}

function popUndo(m) {
  if (!m.stack || !m.stack.length) return null;
  const stack = [...m.stack];
  const last = stack.pop();
  const restored = JSON.parse(last);
  restored.stack = stack;
  return restored;
}

function awardBoard(m, toKey, oppLeft, queen) {
  if (matchWinner(m)) return m;
  const coinsLeft = Math.max(0, Math.min(9, oppLeft));
  const queenCounted = !!queen && queenBonusCounts(m, toKey);
  const queenIgnored = !!queen && !queenCounted;
  const pts = coinsLeft + (queenCounted ? 3 : 0);

  let next = pushUndo(m);
  const winnerName = next[toKey].name;
  next = {
    ...next,
    [toKey]: { ...next[toKey], setPts: next[toKey].setPts + pts },
  };

  const entry = {
    kind: "board",
    at: Date.now(),
    set: next.setNo,
    board: next.boardNo,
    winner: toKey,
    winnerName,
    oppLeft: coinsLeft,
    queen: queenCounted,
    queenRequested: !!queen,
    queenIgnored,
    queenCutoff: matchQueenCutoff(next),
    pts,
    setA: next.p1.setPts,
    setB: next.p2.setPts,
  };
  next = { ...next, history: [...next.history, entry], boardNo: next.boardNo + 1 };

  // Check set end
  const endedPts    = next.p1.setPts >= matchLimitPoints(next) || next.p2.setPts >= matchLimitPoints(next);
  const endedBoards = next.boardNo > matchLimitBoards(next);
  if (endedPts || endedBoards) {
    next = finalizeSet(next);
  }
  return next;
}

function finalizeSet(m) {
  const a = m.p1.setPts, b = m.p2.setPts;
  let next = { ...m };
  let setWinner = null;
  if (a > b) { next = { ...next, p1: { ...next.p1, setsWon: next.p1.setsWon + 1 } }; setWinner = "p1"; }
  else if (b > a) { next = { ...next, p2: { ...next.p2, setsWon: next.p2.setsWon + 1 } }; setWinner = "p2"; }

  next.history = [...next.history, {
    kind: "set-end",
    at: Date.now(),
    set: next.setNo,
    winner: setWinner,
    winnerName: setWinner ? next[setWinner].name : "Tied",
    finalA: a, finalB: b,
  }];

  const mw = matchWinner(next);
  if (mw) {
    next.phase = "over";
    next.endedAt = Date.now();
    return next;
  }
  // Start next set
  next = {
    ...next,
    setNo: next.setNo + 1,
    boardNo: 1,
    p1: { ...next.p1, setPts: 0 },
    p2: { ...next.p2, setPts: 0 },
  };
  return next;
}

function resetSet(m) {
  const next = pushUndo(m);
  const setNo = next.setNo;
  return {
    ...next,
    history: next.history.filter(h => h.set !== setNo),
    boardNo: 1,
    p1: { ...next.p1, setPts: 0 },
    p2: { ...next.p2, setPts: 0 },
  };
}

function resetMatch(m) {
  const next = pushUndo(m);
  return {
    ...next,
    setNo: 1, boardNo: 1,
    startedAt: Date.now(),
    endedAt: null,
    phase: "live",
    p1: { ...next.p1, setPts: 0, setsWon: 0 },
    p2: { ...next.p2, setPts: 0, setsWon: 0 },
    history: [],
  };
}

function swapPlayers(m) {
  const next = pushUndo(m);
  return {
    ...next,
    p1: next.p2, p2: next.p1,
    breakPlayer: next.breakPlayer === "p1" ? "p2" : next.breakPlayer === "p2" ? "p1" : next.breakPlayer,
    tossWinner:  next.tossWinner  === "p1" ? "p2" : next.tossWinner  === "p2" ? "p1" : next.tossWinner,
  };
}

// -------- Admin-only mutators --------

// Roll back the most recently finalized set:
//  - remove the last set-end entry and ALL history after it
//  - restore p1/p2 setPts to the values at that set's completion
//  - decrement the appropriate setsWon
//  - set setNo back to that set, phase back to "live"
function rollbackLastSet(m) {
  const history = m.history || [];
  let lastSetEndIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === "set-end") { lastSetEndIdx = i; break; }
  }
  if (lastSetEndIdx === -1) return m;
  const setEnd = history[lastSetEndIdx];
  const next = pushUndo(m);

  const newHistory = history.slice(0, lastSetEndIdx);
  const boardsInThatSet = newHistory.filter(h => h.kind === "board" && h.set === setEnd.set).length;
  const newP1 = { ...next.p1, setPts: setEnd.finalA };
  const newP2 = { ...next.p2, setPts: setEnd.finalB };
  if (setEnd.winner === "p1") newP1.setsWon = Math.max(0, next.p1.setsWon - 1);
  else if (setEnd.winner === "p2") newP2.setsWon = Math.max(0, next.p2.setsWon - 1);

  return {
    ...next,
    p1: newP1, p2: newP2,
    setNo: setEnd.set,
    boardNo: boardsInThatSet + 1,
    history: newHistory,
    phase: "live",
    endedAt: null,
  };
}

// Force-finalize the current set even if neither limit has been reached.
function skipToNextSet(m) {
  if (matchWinner(m)) return m;
  return finalizeSet(pushUndo(m));
}

// Flip a finished ("over") match back to "live" so scores can be edited.
function reopenMatch(m) {
  if (m.phase !== "over") return m;
  const next = pushUndo(m);
  return { ...next, phase: "live", endedAt: null };
}

Object.assign(window, {
  useStore, pushUndo, popUndo, awardBoard, finalizeSet,
  resetSet, resetMatch, swapPlayers,
  rollbackLastSet, skipToNextSet, reopenMatch,
});
