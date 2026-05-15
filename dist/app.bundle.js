"use strict";

/* src/util.jsx */
const LIMIT_POINTS = 25;
const LIMIT_BOARDS = 8;
const QUEEN_CUTOFF = 22;
const MAX_SETS = 3;
const STORAGE_KEY = "striker.matches.v1";
const ACTIVE_KEY = "striker.active.v1";
const SCORE_FORMATS = {
  standard: {
    label: "25 points / 8 boards",
    limitPoints: 25,
    limitBoards: 8,
    queenCutoff: 22
  },
  quick: {
    label: "15 points / 4 boards",
    limitPoints: 15,
    limitBoards: 4,
    queenCutoff: 11
  }
};
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function fmtTime(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
function cleanName(name, fallback) {
  const n = String(name || "").trim();
  return n || fallback;
}
function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function safeTotalSets(value) {
  return clampInt(value, 1, 9, 3);
}
function setsNeeded(matchOrSets) {
  const total = typeof matchOrSets === "number" ? safeTotalSets(matchOrSets) : safeTotalSets(matchOrSets?.totalSets);
  return Math.floor(total / 2) + 1;
}
function scoreRules(format) {
  return SCORE_FORMATS[format] || SCORE_FORMATS.standard;
}
function matchLimitPoints(match) {
  return Number(match?.limitPoints) || scoreRules(match?.scoreFormat).limitPoints;
}
function matchLimitBoards(match) {
  return Number(match?.limitBoards) || scoreRules(match?.scoreFormat).limitBoards;
}
function matchQueenCutoff(match) {
  return Number(match?.queenCutoff) || scoreRules(match?.scoreFormat).queenCutoff;
}
function queenBonusCounts(match, playerKey) {
  const current = match?.[playerKey]?.setPts || 0;
  return current < matchQueenCutoff(match);
}
function defaultMatch({
  name1 = "Player One",
  name2 = "Player Two",
  teamA1 = "Team A Player 1",
  teamA2 = "Team A Player 2",
  teamB1 = "Team B Player 1",
  teamB2 = "Team B Player 2",
  matchType = "singles",
  totalSets = MAX_SETS,
  scoreFormat = "standard",
  color1 = "White",
  color2 = "Black",
  ownerId = null,
  ownerName = "",
  communityId = null
} = {}) {
  const isDoubles = matchType === "doubles";
  const normalizedScoreFormat = SCORE_FORMATS[scoreFormat] ? scoreFormat : "standard";
  const rules = scoreRules(normalizedScoreFormat);
  const setCount = safeTotalSets(totalSets);
  const p1Members = isDoubles ? [cleanName(teamA1, "Team A Player 1"), cleanName(teamA2, "Team A Player 2")] : [cleanName(name1, "Player One")];
  const p2Members = isDoubles ? [cleanName(teamB1, "Team B Player 1"), cleanName(teamB2, "Team B Player 2")] : [cleanName(name2, "Player Two")];
  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    communityId,
    ownerId: ownerId,
    ownerName: ownerName || "",
    phase: "setup",
    startedAt: null,
    endedAt: null,
    tossWinner: null,
    tossChoice: null,
    breakPlayer: null,
    matchType: isDoubles ? "doubles" : "singles",
    totalSets: setCount,
    setsToWin: setsNeeded(setCount),
    scoreFormat: normalizedScoreFormat,
    limitPoints: rules.limitPoints,
    limitBoards: rules.limitBoards,
    queenCutoff: rules.queenCutoff,
    setNo: 1,
    boardNo: 1,
    p1: {
      label: isDoubles ? "Team A" : "Player One",
      name: isDoubles ? p1Members.join(" / ") : p1Members[0],
      members: p1Members,
      color: color1,
      setPts: 0,
      setsWon: 0
    },
    p2: {
      label: isDoubles ? "Team B" : "Player Two",
      name: isDoubles ? p2Members.join(" / ") : p2Members[0],
      members: p2Members,
      color: color2,
      setPts: 0,
      setsWon: 0
    },
    history: [],
    stack: []
  };
}
function matchWinner(m) {
  if (!m) return null;
  const needed = Number(m.setsToWin) || setsNeeded(m);
  if (m.p1.setsWon >= needed) return "p1";
  if (m.p2.setsWon >= needed) return "p2";
  return null;
}
function communityStorageSuffix(communityId) {
  return communityId ? `.${communityId}` : ".no-community";
}
function storageKeyForCommunity(baseKey, communityId) {
  return `${baseKey}${communityStorageSuffix(communityId)}`;
}
function persistAll(matches, activeId, communityId) {
  if (!communityId) return;
  try {
    localStorage.setItem(storageKeyForCommunity(STORAGE_KEY, communityId), JSON.stringify(matches));
    if (activeId) localStorage.setItem(storageKeyForCommunity(ACTIVE_KEY, communityId), activeId);else localStorage.removeItem(storageKeyForCommunity(ACTIVE_KEY, communityId));
  } catch (e) {
    console.warn("Persist error:", e);
  }
}
function loadAll(communityId) {
  if (!communityId) return {
    matches: [],
    activeId: null
  };
  try {
    const raw = localStorage.getItem(storageKeyForCommunity(STORAGE_KEY, communityId));
    const active = localStorage.getItem(storageKeyForCommunity(ACTIVE_KEY, communityId));
    const matches = raw ? JSON.parse(raw) : [];
    return {
      matches: matches.filter(m => !m.communityId || m.communityId === communityId).map(m => ({
        ...m,
        communityId
      })),
      activeId: active
    };
  } catch (e) {
    return {
      matches: [],
      activeId: null
    };
  }
}
function downloadBlob(filename, content, type = "application/json") {
  const blob = new Blob([content], {
    type
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportJSON(match) {
  downloadBlob(`carrom-${match.p1.name || "A"}-vs-${match.p2.name || "B"}-${match.id}.json`, JSON.stringify(match, null, 2));
}
function exportCSV(match) {
  const rows = [["Set", "Board", "Winner", "OppLeft", "Queen", "Pts", "Set A", "Set B", "Time"]];
  (match.history || []).filter(h => h.kind === "board").forEach(h => {
    rows.push([h.set, h.board, h.winnerName, h.oppLeft, h.queen ? "Counted +3" : h.queenIgnored ? "Ignored" : "No", h.pts, h.setA, h.setB, new Date(h.at).toISOString()]);
  });
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  downloadBlob(`carrom-${match.p1.name || "A"}-vs-${match.p2.name || "B"}-${match.id}.csv`, csv, "text/csv");
}
let _audioCtx = null;
function ping(freq = 880, dur = 0.12, type = "sine", gain = 0.08) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
  } catch (e) {}
}
function chord(freqs, dur = 0.25) {
  freqs.forEach((f, i) => setTimeout(() => ping(f, dur, "triangle", 0.06), i * 80));
}
Object.assign(window, {
  LIMIT_POINTS,
  LIMIT_BOARDS,
  QUEEN_CUTOFF,
  MAX_SETS,
  SCORE_FORMATS,
  STORAGE_KEY,
  ACTIVE_KEY,
  uid,
  initials,
  fmtTime,
  fmtDate,
  clampInt,
  cleanName,
  safeTotalSets,
  setsNeeded,
  scoreRules,
  matchLimitPoints,
  matchLimitBoards,
  matchQueenCutoff,
  queenBonusCounts,
  defaultMatch,
  matchWinner,
  communityStorageSuffix,
  storageKeyForCommunity,
  persistAll,
  loadAll,
  exportJSON,
  exportCSV,
  ping,
  chord
});

/* src/store.jsx */
function useStore(communityId) {
  const readState = React.useCallback(cid => {
    const {
      matches,
      activeId
    } = loadAll(cid);
    return {
      matches: matches || [],
      activeId: activeId || null,
      communityId: cid || null
    };
  }, []);
  const [state, setState] = React.useState(() => {
    return readState(communityId);
  });
  React.useEffect(() => {
    setState(readState(communityId));
  }, [communityId, readState]);
  React.useEffect(() => {
    if (state.communityId !== (communityId || null)) return;
    persistAll(state.matches, state.activeId, communityId);
  }, [state, communityId]);
  const createMatch = React.useCallback(opts => {
    const m = defaultMatch({
      ...opts,
      communityId
    });
    setState(s => {
      const base = s.communityId === (communityId || null) ? s : readState(communityId);
      return {
        ...base,
        matches: [...base.matches, m],
        activeId: m.id
      };
    });
    return m.id;
  }, [communityId, readState]);
  const closeMatch = React.useCallback(id => {
    setState(s => {
      const matches = s.matches.filter(m => m.id !== id);
      const activeId = s.activeId === id ? matches[matches.length - 1]?.id || null : s.activeId;
      return {
        ...s,
        matches,
        activeId
      };
    });
  }, []);
  const setActive = React.useCallback(id => setState(s => ({
    ...s,
    activeId: id
  })), []);
  const updateMatch = React.useCallback((id, updater) => {
    setState(s => ({
      ...s,
      matches: s.matches.map(m => {
        if (m.id !== id) return m;
        const next = typeof updater === "function" ? updater(m) : {
          ...m,
          ...updater
        };
        next.updatedAt = Date.now();
        return next;
      })
    }));
  }, []);
  const upsertAndActivate = React.useCallback((match, {
    activate = true
  } = {}) => {
    setState(s => {
      const idx = s.matches.findIndex(x => x.id === match.id);
      const matches = idx >= 0 ? s.matches.map((x, i) => i === idx ? match : x) : [...s.matches, match];
      return {
        ...s,
        matches,
        activeId: activate ? match.id : s.activeId
      };
    });
  }, []);
  const replaceMatch = React.useCallback(match => {
    setState(s => {
      const idx = s.matches.findIndex(x => x.id === match.id);
      if (idx < 0) return s;
      const matches = s.matches.map((x, i) => i === idx ? match : x);
      return {
        ...s,
        matches
      };
    });
  }, []);
  const active = state.matches.find(m => m.id === state.activeId) || null;
  return {
    state,
    active,
    createMatch,
    closeMatch,
    setActive,
    updateMatch,
    upsertAndActivate,
    replaceMatch
  };
}
function pushUndo(m) {
  const {
    stack: _omit,
    ...rest
  } = m;
  const snap = JSON.stringify(rest);
  const stack = [...(m.stack || []), snap];
  if (stack.length > 50) stack.shift();
  return {
    ...m,
    stack
  };
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
    [toKey]: {
      ...next[toKey],
      setPts: next[toKey].setPts + pts
    }
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
    setB: next.p2.setPts
  };
  next = {
    ...next,
    history: [...next.history, entry],
    boardNo: next.boardNo + 1
  };
  const endedPts = next.p1.setPts >= matchLimitPoints(next) || next.p2.setPts >= matchLimitPoints(next);
  const endedBoards = next.boardNo > matchLimitBoards(next);
  if (endedPts || endedBoards) {
    next = finalizeSet(next);
  }
  return next;
}
function finalizeSet(m) {
  const a = m.p1.setPts,
    b = m.p2.setPts;
  let next = {
    ...m
  };
  let setWinner = null;
  if (a > b) {
    next = {
      ...next,
      p1: {
        ...next.p1,
        setsWon: next.p1.setsWon + 1
      }
    };
    setWinner = "p1";
  } else if (b > a) {
    next = {
      ...next,
      p2: {
        ...next.p2,
        setsWon: next.p2.setsWon + 1
      }
    };
    setWinner = "p2";
  }
  next.history = [...next.history, {
    kind: "set-end",
    at: Date.now(),
    set: next.setNo,
    winner: setWinner,
    winnerName: setWinner ? next[setWinner].name : "Tied",
    finalA: a,
    finalB: b
  }];
  const mw = matchWinner(next);
  if (mw) {
    next.phase = "over";
    next.endedAt = Date.now();
    return next;
  }
  next = {
    ...next,
    setNo: next.setNo + 1,
    boardNo: 1,
    p1: {
      ...next.p1,
      setPts: 0
    },
    p2: {
      ...next.p2,
      setPts: 0
    }
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
    p1: {
      ...next.p1,
      setPts: 0
    },
    p2: {
      ...next.p2,
      setPts: 0
    }
  };
}
function resetMatch(m) {
  const next = pushUndo(m);
  return {
    ...next,
    setNo: 1,
    boardNo: 1,
    startedAt: Date.now(),
    endedAt: null,
    phase: "live",
    p1: {
      ...next.p1,
      setPts: 0,
      setsWon: 0
    },
    p2: {
      ...next.p2,
      setPts: 0,
      setsWon: 0
    },
    history: []
  };
}
function swapPlayers(m) {
  const next = pushUndo(m);
  return {
    ...next,
    p1: next.p2,
    p2: next.p1,
    breakPlayer: next.breakPlayer === "p1" ? "p2" : next.breakPlayer === "p2" ? "p1" : next.breakPlayer,
    tossWinner: next.tossWinner === "p1" ? "p2" : next.tossWinner === "p2" ? "p1" : next.tossWinner
  };
}
function rollbackLastSet(m) {
  const history = m.history || [];
  let lastSetEndIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === "set-end") {
      lastSetEndIdx = i;
      break;
    }
  }
  if (lastSetEndIdx === -1) return m;
  const setEnd = history[lastSetEndIdx];
  const next = pushUndo(m);
  const newHistory = history.slice(0, lastSetEndIdx);
  const boardsInThatSet = newHistory.filter(h => h.kind === "board" && h.set === setEnd.set).length;
  const newP1 = {
    ...next.p1,
    setPts: setEnd.finalA
  };
  const newP2 = {
    ...next.p2,
    setPts: setEnd.finalB
  };
  if (setEnd.winner === "p1") newP1.setsWon = Math.max(0, next.p1.setsWon - 1);else if (setEnd.winner === "p2") newP2.setsWon = Math.max(0, next.p2.setsWon - 1);
  return {
    ...next,
    p1: newP1,
    p2: newP2,
    setNo: setEnd.set,
    boardNo: boardsInThatSet + 1,
    history: newHistory,
    phase: "live",
    endedAt: null
  };
}
function skipToNextSet(m) {
  if (matchWinner(m)) return m;
  return finalizeSet(pushUndo(m));
}
function reopenMatch(m) {
  if (m.phase !== "over") return m;
  const next = pushUndo(m);
  return {
    ...next,
    phase: "live",
    endedAt: null
  };
}
Object.assign(window, {
  useStore,
  pushUndo,
  popUndo,
  awardBoard,
  finalizeSet,
  resetSet,
  resetMatch,
  swapPlayers,
  rollbackLastSet,
  skipToNextSet,
  reopenMatch
});

/* src/parts.jsx */
const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;
function BrandMark({
  size = 34
}) {
  return React.createElement("div", {
    className: "brand-mark",
    style: {
      width: size,
      height: size
    }
  });
}
function Coin({
  color = "white",
  size = 18
}) {
  return React.createElement("div", {
    className: `coin-dot ${color === "Black" || color === "black" ? "black" : ""}`,
    style: {
      width: size,
      height: size
    }
  });
}
function Avatar({
  name,
  color
}) {
  const cls = color === "Black" ? "black" : "white";
  return React.createElement("div", {
    className: `avatar ${cls}`,
    title: name
  }, initials(name));
}
function Chip({
  children,
  variant
}) {
  return React.createElement("span", {
    className: `chip ${variant || ""}`
  }, children);
}
function SetPips({
  won,
  max = 2
}) {
  const pips = [];
  for (let i = 0; i < max; i++) pips.push(React.createElement("span", {
    key: i,
    className: `pip ${i < won ? "won" : ""}`
  }));
  return React.createElement("div", {
    className: "setpips",
    title: `${won} of ${max} sets won`
  }, pips);
}
function Confetti({
  trigger,
  onDone
}) {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const colors = ["#c8a65a", "#f3e7cf", "#d94562", "#6b8e3d", "#fbf5e8", "#8e1f30"];
    const arr = Array.from({
      length: 140
    }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 2.2 + Math.random() * 2,
      bg: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 14
    }));
    setBits(arr);
    const t = setTimeout(() => {
      setBits([]);
      onDone && onDone();
    }, 4500);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!bits.length) return null;
  return React.createElement("div", {
    className: "confetti"
  }, bits.map(b => React.createElement("i", {
    key: b.id,
    style: {
      left: `${b.left}vw`,
      background: b.bg,
      width: b.w,
      height: b.h,
      transform: `rotate(${b.rot}deg)`,
      animationDuration: `${b.dur}s`,
      animationDelay: `${b.delay}s`
    }
  })));
}
function Modal({
  open,
  onClose,
  children,
  className = ""
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, React.createElement("div", {
    className: `modal ${className}`,
    onClick: e => e.stopPropagation()
  }, children));
}
function HelpModal({
  open,
  onClose
}) {
  return React.createElement(Modal, {
    open: open,
    onClose: onClose,
    className: "help-modal"
  }, React.createElement("div", {
    className: "stinger"
  }, "App Guide"), React.createElement("h2", null, "How to use ", React.createElement("em", null, "Striker.")), React.createElement("p", {
    className: "help-intro"
  }, "Use this app to run singles or doubles carrom matches, choose 1 or 3 sets, track every board, move between sets automatically, and keep a match history."), React.createElement("div", {
    className: "help-grid"
  }, React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "1"), React.createElement("h3", null, "Choose competitors"), React.createElement("p", null, "Select Singles for one name per side or Doubles for Team A and Team B with two names each. Coin color is decided after the toss.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "2"), React.createElement("h3", null, "Choose match rules"), React.createElement("p", null, "Pick 1 set or 3 sets, then choose either 25 points / 8 boards or 15 points / 4 boards. A set ends when either limit is reached first.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "3"), React.createElement("h3", null, "Toss and break"), React.createElement("p", null, "Flip the striker. The toss winner chooses either Break first or Choose your side. Break first automatically means White coins.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "4"), React.createElement("h3", null, "Choose side"), React.createElement("p", null, "If the toss winner chooses a side instead of breaking, they pick White or Black and the opponent breaks first.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "5"), React.createElement("h3", null, "Enter points"), React.createElement("p", null, "After each board, enter how many coins the losing player has left, turn Queen on only if covered, then tap the board winner.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "6"), React.createElement("h3", null, "Scoring rule"), React.createElement("p", null, "The app adds the losing player's coins left as points. Queen +3 counts until the winner already has 22+ points in 25-point games or 11+ points in 15-point games before that board.")), React.createElement("div", {
    className: "help-step"
  }, React.createElement("span", {
    className: "help-num"
  }, "7"), React.createElement("h3", null, "Sets and match"), React.createElement("p", null, "In a 1-set match, the first set winner wins the match. In a 3-set match, first to 2 sets wins the match."))), React.createElement("div", {
    className: "help-note"
  }, "Use Undo if you enter a board wrongly. Reset Set removes only the current set's boards. Reset Match keeps names and colors but starts scoring again. Export JSON or CSV from the match screen when you need a saved copy."), React.createElement("div", {
    className: "modal-actions",
    style: {
      marginTop: 22
    }
  }, React.createElement("button", {
    className: "btn primary",
    onClick: onClose
  }, "Got it")));
}
function TopBar({
  onNew,
  onHome,
  driveSlot
}) {
  return React.createElement("div", {
    className: "topbar"
  }, React.createElement("div", {
    className: "brand",
    style: {
      cursor: "pointer"
    },
    onClick: onHome
  }, React.createElement(BrandMark, null), React.createElement("div", {
    className: "brand-name"
  }, "Striker ", React.createElement("em", null, "/"), " Carrom")), React.createElement("div", {
    className: "row",
    style: {
      gap: 10
    }
  }, driveSlot, React.createElement("button", {
    className: "btn ghost sm",
    onClick: onNew
  }, "+ New Match")));
}
Object.assign(window, {
  BrandMark,
  Coin,
  Avatar,
  Chip,
  SetPips,
  Confetti,
  Modal,
  HelpModal,
  TopBar
});

/* src/cloud.jsx */
const SUPABASE_URL = "https://csdrlzvkwtkpjfjzglsl.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZHJsenZrd3RrcGpmanpnbHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTY1NjQsImV4cCI6MjA5MjMzMjU2NH0.0_QrLivfuNpDcIm0p4bOsFAbFUKDTgQD-amQOPFFkas";
const COMMUNITY_SESSION_KEY = "striker.community.session.v1";
const PLAYER_SESSION_KEY = "striker.player.session.v2";
const SESSION_KEY = PLAYER_SESSION_KEY;
const DEFAULT_COMMUNITY_NAME = "IISc Carrom Club";
const DEFAULT_COMMUNITY_SLUG = "iisc-carrom-club";
let _sbReady = null;
function getSupabase() {
  if (_sbReady) return _sbReady;
  _sbReady = new Promise((resolve, reject) => {
    if (window.supabase?.createClient) {
      resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
      return;
    }
    const sources = ["dist/supabase.min.js", "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"];
    let idx = 0;
    const loadNext = () => {
      if (window.supabase?.createClient) {
        resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
        return;
      }
      const src = sources[idx++];
      if (!src) {
        reject(new Error("Supabase client could not load. Make sure dist/supabase.min.js is deployed, or allow cdn.jsdelivr.net in the browser/network."));
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = loadNext;
      s.onerror = loadNext;
      document.head.appendChild(s);
    };
    loadNext();
  });
  return _sbReady;
}
let _authReady = null;
async function ensureSupabaseAuth() {
  if (_authReady) return _authReady;
  _authReady = (async () => {
    const sb = await getSupabase();
    const current = await sb.auth.getSession();
    if (current?.data?.session?.user) return current.data.session.user;
    const {
      data,
      error
    } = await sb.auth.signInAnonymously();
    if (error) {
      throw new Error("Supabase Anonymous Auth is required for community RLS. Enable Authentication > Sign In / Providers > Anonymous in Supabase, then reload. " + error.message);
    }
    return data.user;
  })().catch(e => {
    _authReady = null;
    throw e;
  });
  return _authReady;
}
function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
function isFourDigitPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}
function isPlayerPin(pin) {
  return /^\d{4,6}$/.test(String(pin || ""));
}
function uuidv4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
}
async function sha256Hex(message) {
  const buf = new TextEncoder().encode(message);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashCommunityPin(slugOrCommunityId, pin) {
  const scope = normalizeSlug(slugOrCommunityId) || String(slugOrCommunityId || "").trim().toLowerCase();
  return sha256Hex(`striker_community_pin_v1|${scope}|${pin}`);
}
async function hashPlayerPin(communityId, name, pin) {
  return sha256Hex(`striker_player_pin_v2|${communityId}|${normalizeName(name).toLowerCase()}|${pin}`);
}
async function hashAdminPin(pin) {
  return sha256Hex(`striker_app_admin_pin_v1|${pin}`);
}
function getCommunitySession() {
  try {
    return JSON.parse(localStorage.getItem(COMMUNITY_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
function setCommunitySession(session) {
  if (session) localStorage.setItem(COMMUNITY_SESSION_KEY, JSON.stringify(session));else localStorage.removeItem(COMMUNITY_SESSION_KEY);
}
function clearCommunitySession() {
  localStorage.removeItem(COMMUNITY_SESSION_KEY);
}
function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) || "null");
    const community = getCommunitySession();
    if (!session || !community || session.communityId !== community.id) return null;
    return session;
  } catch {
    return null;
  }
}
function setSession(session) {
  if (session) localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));else localStorage.removeItem(PLAYER_SESSION_KEY);
}
function signOut() {
  setSession(null);
}
function clearAllSessions() {
  signOut();
  clearCommunitySession();
}
function mapCommunity(row) {
  if (!row) return null;
  return {
    id: row.id || row.community_id,
    name: row.name || row.community_name,
    slug: row.slug || row.community_slug,
    role: row.role || "member",
    description: row.description || ""
  };
}
function mapPlayer(row, community) {
  if (!row) return null;
  return {
    id: row.id || row.player_id,
    name: row.name || row.player_name,
    role: row.role || "member",
    communityId: row.community_id || community?.id,
    communityName: community?.name,
    communitySlug: community?.slug
  };
}
function rpcRow(data) {
  return Array.isArray(data) ? data[0] : data;
}
function friendlySupabaseError(error) {
  const msg = error?.message || String(error || "Unknown Supabase error");
  if (/Could not find the function|function .* does not exist|relation .* does not exist/i.test(msg)) {
    return "Supabase community schema is not installed. Open the Supabase SQL editor, paste the contents of supabase-community-schema.sql, and click Run. Then reload this page.";
  }
  if (/anonymous.*disabled|anonymous sign.?ins are disabled|signups not allowed/i.test(msg)) {
    return "Anonymous sign-ins are disabled in Supabase. Open Authentication > Sign In / Providers and turn Anonymous Sign-Ins ON, then reload.";
  }
  if (/JWT|invalid api key|invalid token/i.test(msg)) {
    return "Supabase rejected the anon key. Check SUPABASE_URL and SUPABASE_ANON in index.html.";
  }
  if (/duplicate key|violates unique constraint/i.test(msg)) {
    return "That community slug or player name is already taken in this community.";
  }
  if (/Community not found or wrong PIN|Wrong PIN|not found or wrong/i.test(msg)) {
    return "Community not found or wrong PIN. Check that you typed the slug exactly (e.g. iisc-carrom-club) and that the schema SQL was run with the matching PIN.";
  }
  return msg;
}
async function verifyCommunityPin(slug, pin) {
  const communitySlug = normalizeSlug(slug);
  if (!communitySlug) throw new Error("Enter a community name, code, or slug.");
  if (!isFourDigitPin(pin)) throw new Error("Community PIN must be exactly 4 digits.");
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const pinHash = await hashCommunityPin(communitySlug, pin);
  const {
    data,
    error
  } = await sb.rpc("join_community_with_pin", {
    p_slug: communitySlug,
    p_pin_hash: pinHash
  });
  if (error) throw new Error(friendlySupabaseError(error));
  const community = mapCommunity(rpcRow(data));
  if (!community?.id) throw new Error("Community not found or wrong PIN.");
  setCommunitySession(community);
  signOut();
  return community;
}
async function createCommunity({
  name,
  slug,
  pin,
  creatorName,
  creatorPin,
  description = ""
}) {
  const cleanName = normalizeName(name);
  const cleanSlug = normalizeSlug(slug || name);
  const cleanCreator = normalizeName(creatorName);
  if (!cleanName) throw new Error("Enter a community name.");
  if (!cleanSlug) throw new Error("Enter a community slug.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) throw new Error("Community slug can use lowercase letters, numbers, and hyphens.");
  if (!isFourDigitPin(pin)) throw new Error("Community PIN must be exactly 4 digits.");
  if (!cleanCreator) throw new Error("Enter the creator display name.");
  if (!isPlayerPin(creatorPin)) throw new Error("Player PIN must be 4 to 6 digits.");
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const communityId = uuidv4();
  const communityPinHash = await hashCommunityPin(cleanSlug, pin);
  const creatorPinHash = await hashPlayerPin(communityId, cleanCreator, creatorPin);
  const {
    data,
    error
  } = await sb.rpc("create_community_with_owner", {
    p_id: communityId,
    p_name: cleanName,
    p_slug: cleanSlug,
    p_pin_hash: communityPinHash,
    p_description: normalizeName(description) || null,
    p_creator_name: cleanCreator,
    p_creator_pin_hash: creatorPinHash
  });
  if (error) throw new Error(friendlySupabaseError(error));
  const row = rpcRow(data);
  const community = mapCommunity({
    id: row.community_id,
    name: row.community_name,
    slug: row.community_slug,
    description: row.description,
    role: row.role
  });
  const player = mapPlayer({
    id: row.player_id,
    name: row.player_name,
    role: row.role,
    community_id: row.community_id
  }, community);
  setCommunitySession(community);
  setSession(player);
  return {
    community,
    player
  };
}
async function signInOrRegisterPlayer(communityId, name, pin) {
  const community = getCommunitySession();
  const cleanName = normalizeName(name);
  if (!communityId) throw new Error("Choose a community first.");
  if (!community || community.id !== communityId) throw new Error("Community session expired. Switch community and join again.");
  if (!cleanName) throw new Error("Enter a name.");
  if (!isPlayerPin(pin)) throw new Error("Player PIN must be 4 to 6 digits.");
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const pinHash = await hashPlayerPin(communityId, cleanName, pin);
  const {
    data,
    error
  } = await sb.rpc("sign_in_or_register_player", {
    p_community_id: communityId,
    p_name: cleanName,
    p_pin_hash: pinHash
  });
  if (error) throw new Error(friendlySupabaseError(error));
  const row = rpcRow(data);
  const player = mapPlayer(row, community);
  if (!player?.id) throw new Error("Could not sign in.");
  const nextCommunity = {
    ...community,
    role: player.role || community.role || "member"
  };
  setCommunitySession(nextCommunity);
  setSession(player);
  return player;
}
async function signInOrRegister(name, pin) {
  const community = getCommunitySession();
  if (!community?.id) throw new Error("Choose a community first.");
  return signInOrRegisterPlayer(community.id, name, pin);
}
async function verifyPlayerPin(communityId, playerId, name, pin) {
  if (!communityId || !playerId || !name || !isPlayerPin(pin)) return false;
  try {
    await ensureSupabaseAuth();
    const sb = await getSupabase();
    const pinHash = await hashPlayerPin(communityId, name, pin);
    const {
      data,
      error
    } = await sb.rpc("verify_player_pin", {
      p_community_id: communityId,
      p_player_id: playerId,
      p_pin_hash: pinHash
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.warn("Player PIN verification failed:", e);
    return false;
  }
}
function adminConfigured(session = getSession()) {
  return !!session && ["owner", "admin"].includes(session.role);
}
function isAdminEligible(session = getSession()) {
  return adminConfigured(session);
}
async function verifyAdminPin(pin, session = getSession()) {
  if (!isAdminEligible(session)) return false;
  return verifyPlayerPin(session.communityId, session.id, session.name, pin);
}
function requireCommunityId(communityId) {
  const cid = communityId || getCommunitySession()?.id;
  if (!cid) throw new Error("Choose a community first.");
  return cid;
}
function matchToRow(match, ownerId, communityId) {
  const cid = requireCommunityId(communityId || match.communityId);
  const cleanMatch = {
    ...match,
    communityId: cid
  };
  return {
    id: match.id,
    community_id: cid,
    owner_player_id: match.ownerId || ownerId || null,
    p1_name: match.p1.name,
    p2_name: match.p2.name,
    p1_color: match.p1.color,
    p2_color: match.p2.color,
    p1_sets_won: match.p1.setsWon,
    p2_sets_won: match.p2.setsWon,
    winner_name: (() => {
      const mw = matchWinner(match);
      return mw ? match[mw].name : null;
    })(),
    phase: match.phase,
    data: cleanMatch,
    started_at: match.startedAt ? new Date(match.startedAt).toISOString() : null,
    ended_at: match.endedAt ? new Date(match.endedAt).toISOString() : null,
    updated_at: new Date().toISOString()
  };
}
const _sbTimers = new Map();
const _sbLast = new Map();
function scheduleSupabaseSync(match, ownerId, opts = {}) {
  const {
    delay = 1200,
    onStatus,
    communityId
  } = opts;
  const cid = requireCommunityId(communityId || match.communityId);
  const snap = JSON.stringify({
    communityId: cid,
    match
  });
  if (_sbLast.get(match.id) === snap) return;
  _sbLast.set(match.id, snap);
  if (_sbTimers.has(match.id)) clearTimeout(_sbTimers.get(match.id));
  const t = setTimeout(async () => {
    _sbTimers.delete(match.id);
    try {
      onStatus && onStatus("syncing");
      await ensureSupabaseAuth();
      const sb = await getSupabase();
      const row = matchToRow(match, ownerId, cid);
      const {
        error
      } = await sb.from("matches").upsert(row, {
        onConflict: "id"
      });
      if (error) throw error;
      onStatus && onStatus("synced");
    } catch (e) {
      console.warn("Supabase sync failed:", e);
      onStatus && onStatus("error", friendlySupabaseError(e));
    }
  }, delay);
  _sbTimers.set(match.id, t);
}
async function fetchAllMatches({
  communityId,
  limit = 200
} = {}) {
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const {
    data,
    error
  } = await sb.from("matches").select("*").eq("community_id", cid).order("updated_at", {
    ascending: false
  }).limit(limit);
  if (error) throw new Error(friendlySupabaseError(error));
  return data || [];
}
async function fetchMatchById(communityId, id) {
  if (id === undefined) {
    id = communityId;
    communityId = undefined;
  }
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const {
    data,
    error
  } = await sb.from("matches").select("*").eq("community_id", cid).eq("id", id).maybeSingle();
  if (error) throw new Error(friendlySupabaseError(error));
  return data;
}
async function deleteMatchById(communityId, id) {
  if (id === undefined) {
    id = communityId;
    communityId = undefined;
  }
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const {
    error
  } = await sb.from("matches").delete().eq("community_id", cid).eq("id", id);
  if (error) throw new Error(friendlySupabaseError(error));
}
async function subscribeMatches(communityId, onChange) {
  if (typeof communityId === "function") {
    onChange = communityId;
    communityId = undefined;
  }
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const ch = sb.channel(`matches-live-${cid}`).on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "matches",
    filter: `community_id=eq.${cid}`
  }, payload => onChange(payload)).subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}
async function subscribeToMatch(communityId, matchId, onChange) {
  if (typeof matchId === "function") {
    onChange = matchId;
    matchId = communityId;
    communityId = undefined;
  }
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const ch = sb.channel(`match-${cid}-${matchId}`).on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "matches",
    filter: `id=eq.${matchId}`
  }, payload => {
    const row = payload.new || payload.old || payload.record;
    if (row?.community_id && row.community_id !== cid) return;
    onChange(payload);
  }).subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}
Object.assign(window, {
  SUPABASE_URL,
  SUPABASE_ANON,
  COMMUNITY_SESSION_KEY,
  PLAYER_SESSION_KEY,
  SESSION_KEY,
  DEFAULT_COMMUNITY_NAME,
  DEFAULT_COMMUNITY_SLUG,
  getSupabase,
  ensureSupabaseAuth,
  normalizeSlug,
  hashCommunityPin,
  hashPlayerPin,
  hashAdminPin,
  getCommunitySession,
  setCommunitySession,
  clearCommunitySession,
  getSession,
  setSession,
  signOut,
  clearAllSessions,
  verifyCommunityPin,
  createCommunity,
  signInOrRegisterPlayer,
  signInOrRegister,
  verifyPlayerPin,
  adminConfigured,
  isAdminEligible,
  verifyAdminPin,
  scheduleSupabaseSync,
  fetchAllMatches,
  fetchMatchById,
  deleteMatchById,
  subscribeMatches,
  subscribeToMatch
});

/* src/community.jsx */
function CommunityEntry({
  onCommunityReady,
  onCommunityAndPlayerReady,
  onHelp
}) {
  const [tab, setTab] = React.useState("join");
  const [joinCode, setJoinCode] = React.useState(DEFAULT_COMMUNITY_SLUG);
  const [joinPin, setJoinPin] = React.useState("");
  const [createName, setCreateName] = React.useState("");
  const [createSlug, setCreateSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [communityPin, setCommunityPin] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creatorName, setCreatorName] = React.useState("");
  const [creatorPin, setCreatorPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    if (!slugTouched) setCreateSlug(normalizeSlug(createName));
  }, [createName, slugTouched]);
  const join = async e => {
    e.preventDefault();
    if (!joinCode.trim() || joinPin.length !== 4) return;
    setBusy(true);
    setErr(null);
    try {
      const community = await verifyCommunityPin(joinCode, joinPin);
      onCommunityReady && onCommunityReady(community);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const create = async e => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim() || communityPin.length !== 4 || !creatorName.trim() || creatorPin.length < 4) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await createCommunity({
        name: createName,
        slug: createSlug,
        pin: communityPin,
        creatorName,
        creatorPin,
        description
      });
      onCommunityAndPlayerReady && onCommunityAndPlayerReady(result);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "welcome"
  }, React.createElement("div", {
    className: "welcome-card",
    style: {
      maxWidth: 760
    }
  }, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 14
    }
  }, "Community access"), React.createElement("h1", {
    style: {
      fontSize: "clamp(42px, 6vw, 76px)"
    }
  }, "Enter your ", React.createElement("em", null, "club.")), React.createElement("p", {
    className: "lede"
  }, "Matches, players, history, and leaderboards are private to the community you join."), React.createElement("div", {
    className: "option-row",
    style: {
      marginBottom: 18
    }
  }, React.createElement("button", {
    type: "button",
    className: `option-pill ${tab === "join" ? "active" : ""}`,
    onClick: () => {
      setTab("join");
      setErr(null);
    }
  }, "Join community"), React.createElement("button", {
    type: "button",
    className: `option-pill ${tab === "create" ? "active" : ""}`,
    onClick: () => {
      setTab("create");
      setErr(null);
    }
  }, "Create community"), onHelp && React.createElement("button", {
    type: "button",
    className: "option-pill",
    onClick: onHelp
  }, "Help")), tab === "join" ? React.createElement("form", {
    onSubmit: join
  }, React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Community name or code"), React.createElement("input", {
    autoFocus: true,
    placeholder: DEFAULT_COMMUNITY_NAME,
    value: joinCode,
    onChange: e => setJoinCode(e.target.value),
    maxLength: 80
  }), React.createElement("div", {
    className: "tip",
    style: {
      marginTop: 8
    }
  }, "Default: ", DEFAULT_COMMUNITY_NAME, " (", DEFAULT_COMMUNITY_SLUG, ")")), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "4-digit community PIN"), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]*",
    placeholder: "PIN",
    value: joinPin,
    onChange: e => setJoinPin(e.target.value.replace(/\D/g, "").slice(0, 4)),
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.35em"
    }
  }))), err && React.createElement("div", {
    className: "drive-error",
    style: {
      marginTop: 12
    }
  }, err), React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between",
      marginTop: 18,
      flexWrap: "wrap",
      gap: 12
    }
  }, React.createElement("div", {
    className: "tip"
  }, "The community PIN is checked through Supabase and is not shown in the UI."), React.createElement("button", {
    type: "submit",
    className: "btn primary",
    disabled: busy || !joinCode.trim() || joinPin.length !== 4
  }, busy ? "Checking..." : "Join"))) : React.createElement("form", {
    onSubmit: create
  }, React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Community name"), React.createElement("input", {
    autoFocus: true,
    placeholder: "e.g. Hostel Carrom League",
    value: createName,
    onChange: e => setCreateName(e.target.value),
    maxLength: 80
  })), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Community slug/code"), React.createElement("input", {
    placeholder: "hostel-carrom-league",
    value: createSlug,
    onChange: e => {
      setSlugTouched(true);
      setCreateSlug(normalizeSlug(e.target.value));
    },
    maxLength: 64,
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 24
    }
  })), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Optional public description"), React.createElement("input", {
    placeholder: "Short note for members",
    value: description,
    onChange: e => setDescription(e.target.value),
    maxLength: 160
  })), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 14
    }
  }, React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "4-digit community PIN"), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]*",
    placeholder: "PIN",
    value: communityPin,
    onChange: e => setCommunityPin(e.target.value.replace(/\D/g, "").slice(0, 4)),
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.35em"
    }
  })), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Creator name"), React.createElement("input", {
    placeholder: "Your name",
    value: creatorName,
    onChange: e => setCreatorName(e.target.value),
    maxLength: 24
  }))), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Creator player PIN"), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]*",
    placeholder: "PIN",
    value: creatorPin,
    onChange: e => setCreatorPin(e.target.value.replace(/\D/g, "").slice(0, 6)),
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.35em"
    }
  }))), err && React.createElement("div", {
    className: "drive-error",
    style: {
      marginTop: 12
    }
  }, err), React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between",
      marginTop: 18,
      flexWrap: "wrap",
      gap: 12
    }
  }, React.createElement("div", {
    className: "tip"
  }, "The creator becomes the community owner/admin."), React.createElement("button", {
    type: "submit",
    className: "btn primary",
    disabled: busy || !createName.trim() || !createSlug.trim() || communityPin.length !== 4 || !creatorName.trim() || creatorPin.length < 4
  }, busy ? "Creating..." : "Create and enter")))));
}
Object.assign(window, {
  CommunityEntry
});

/* src/signin.jsx */
function SignIn({
  community,
  onSignedIn
}) {
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const go = async e => {
    e.preventDefault();
    if (!community?.id || !name.trim() || pin.length < 4) return;
    setBusy(true);
    setErr(null);
    try {
      const session = await signInOrRegisterPlayer(community.id, name, pin);
      onSignedIn(session);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "welcome"
  }, React.createElement("form", {
    className: "welcome-card",
    onSubmit: go,
    style: {
      maxWidth: 560
    }
  }, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 14
    }
  }, "Sign in / ", community?.name), React.createElement("h1", {
    style: {
      fontSize: "clamp(40px, 6vw, 72px)"
    }
  }, "Welcome, ", React.createElement("em", null, "striker.")), React.createElement("p", {
    className: "lede"
  }, "Enter your name and player PIN for this community. The same name can be used separately in another community."), React.createElement("div", {
    style: {
      display: "grid",
      gap: 14,
      marginTop: 18
    }
  }, React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Your name"), React.createElement("input", {
    autoFocus: true,
    placeholder: "e.g. Raj",
    value: name,
    onChange: e => setName(e.target.value),
    maxLength: 24
  })), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "4-6 digit player PIN"), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]*",
    placeholder: "PIN",
    value: pin,
    onChange: e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6)),
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.5em"
    }
  }))), err && React.createElement("div", {
    className: "drive-error",
    style: {
      marginTop: 12
    }
  }, err), React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between",
      marginTop: 18,
      flexWrap: "wrap",
      gap: 12
    }
  }, React.createElement("div", {
    className: "tip"
  }, "Your PIN is hashed with this community before being stored."), React.createElement("button", {
    type: "submit",
    className: "btn primary",
    disabled: busy || !name.trim() || pin.length < 4
  }, busy ? "Signing in..." : "Enter"))));
}
Object.assign(window, {
  SignIn
});

/* src/welcome.jsx */
function Welcome({
  onStart,
  onHelp
}) {
  const [matchType, setMatchType] = React.useState("singles");
  const [totalSets, setTotalSets] = React.useState(3);
  const [scoreFormat, setScoreFormat] = React.useState("standard");
  const [n1, setN1] = React.useState("");
  const [n2, setN2] = React.useState("");
  const [teamA1, setTeamA1] = React.useState("");
  const [teamA2, setTeamA2] = React.useState("");
  const [teamB1, setTeamB1] = React.useState("");
  const [teamB2, setTeamB2] = React.useState("");
  const trim = v => v.trim();
  const singlesReady = trim(n1) && trim(n2) && trim(n1) !== trim(n2);
  const doublesReady = trim(teamA1) && trim(teamA2) && trim(teamB1) && trim(teamB2);
  const ready = matchType === "doubles" ? doublesReady : singlesReady;
  const rules = scoreRules(scoreFormat);
  const submit = e => {
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
      teamB2: trim(teamB2)
    });
  };
  return React.createElement("div", {
    className: "welcome"
  }, React.createElement("form", {
    className: "welcome-card",
    onSubmit: submit
  }, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 14
    }
  }, "Strike / Pocket / Win"), React.createElement("h1", null, "A new match", React.createElement("br", null), React.createElement("em", null, "begins.")), React.createElement("p", {
    className: "lede"
  }, "Enter the competitors, choose the match rules, then toss the striker. Coin colors are decided after the toss."), React.createElement("div", {
    className: "setup-controls"
  }, React.createElement("div", {
    className: "setup-block"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Players"), React.createElement("div", {
    className: "option-row"
  }, React.createElement("button", {
    type: "button",
    className: `option-pill ${matchType === "singles" ? "active" : ""}`,
    onClick: () => setMatchType("singles")
  }, "Singles"), React.createElement("button", {
    type: "button",
    className: `option-pill ${matchType === "doubles" ? "active" : ""}`,
    onClick: () => setMatchType("doubles")
  }, "Doubles"))), React.createElement("div", {
    className: "setup-block"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Sets"), React.createElement("div", {
    className: "option-row"
  }, React.createElement("button", {
    type: "button",
    className: `option-pill ${totalSets === 1 ? "active" : ""}`,
    onClick: () => setTotalSets(1)
  }, "1 set"), React.createElement("button", {
    type: "button",
    className: `option-pill ${totalSets === 3 ? "active" : ""}`,
    onClick: () => setTotalSets(3)
  }, "3 sets"))), React.createElement("div", {
    className: "setup-block wide"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Scoring"), React.createElement("div", {
    className: "option-row"
  }, React.createElement("button", {
    type: "button",
    className: `option-pill ${scoreFormat === "standard" ? "active" : ""}`,
    onClick: () => setScoreFormat("standard")
  }, "25 pts / 8 boards"), React.createElement("button", {
    type: "button",
    className: `option-pill ${scoreFormat === "quick" ? "active" : ""}`,
    onClick: () => setScoreFormat("quick")
  }, "15 pts / 4 boards")))), matchType === "singles" ? React.createElement("div", {
    className: "names"
  }, React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Player one"), React.createElement("input", {
    autoFocus: true,
    placeholder: "Name...",
    value: n1,
    onChange: e => setN1(e.target.value),
    maxLength: 24
  })), React.createElement("div", {
    className: "versus"
  }, "vs."), React.createElement("div", {
    className: "name-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Player two"), React.createElement("input", {
    placeholder: "Name...",
    value: n2,
    onChange: e => setN2(e.target.value),
    maxLength: 24
  }))) : React.createElement("div", {
    className: "names doubles-names"
  }, React.createElement("div", {
    className: "name-field team-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Team A"), React.createElement("input", {
    autoFocus: true,
    placeholder: "Player A1...",
    value: teamA1,
    onChange: e => setTeamA1(e.target.value),
    maxLength: 24
  }), React.createElement("input", {
    placeholder: "Player A2...",
    value: teamA2,
    onChange: e => setTeamA2(e.target.value),
    maxLength: 24
  })), React.createElement("div", {
    className: "versus"
  }, "vs."), React.createElement("div", {
    className: "name-field team-field"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Team B"), React.createElement("input", {
    placeholder: "Player B1...",
    value: teamB1,
    onChange: e => setTeamB1(e.target.value),
    maxLength: 24
  }), React.createElement("input", {
    placeholder: "Player B2...",
    value: teamB2,
    onChange: e => setTeamB2(e.target.value),
    maxLength: 24
  }))), React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12
    }
  }, React.createElement("div", {
    className: "tip"
  }, "Next: toss the striker / ", totalSets, " set", totalSets === 1 ? "" : "s", " / ", rules.limitPoints, " points or ", rules.limitBoards, " boards"), React.createElement("div", {
    className: "row",
    style: {
      flexWrap: "wrap",
      gap: 10
    }
  }, onHelp && React.createElement("button", {
    type: "button",
    className: "btn ghost",
    onClick: onHelp
  }, "How it works"), React.createElement("button", {
    type: "submit",
    className: "btn primary",
    disabled: !ready
  }, "Toss the Striker ->")))));
}
Object.assign(window, {
  Welcome
});

/* src/toss.jsx */
function Toss({
  match,
  onDone
}) {
  const [phase, setPhase] = React.useState("idle");
  const [winner, setWinner] = React.useState(null);
  const p1 = match.p1,
    p2 = match.p2;
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
  const chooseBreak = who => {
    const newP1Color = winner === "p1" ? "White" : "Black";
    const newP2Color = winner === "p2" ? "White" : "Black";
    onDone({
      tossWinner: winner,
      tossChoice: "break",
      breakPlayer: winner,
      p1Color: newP1Color,
      p2Color: newP2Color
    });
  };
  const chooseSide = () => setPhase("choosing");
  const confirmSide = chosenColor => {
    const other = winner === "p1" ? "p2" : "p1";
    let newP1Color = match.p1.color,
      newP2Color = match.p2.color;
    if (winner === "p1" && match.p1.color !== chosenColor) {
      newP1Color = chosenColor;
      newP2Color = chosenColor === "White" ? "Black" : "White";
    }
    if (winner === "p2" && match.p2.color !== chosenColor) {
      newP2Color = chosenColor;
      newP1Color = chosenColor === "White" ? "Black" : "White";
    }
    onDone({
      tossWinner: winner,
      tossChoice: "side",
      breakPlayer: other,
      p1Color: newP1Color,
      p2Color: newP2Color
    });
  };
  return React.createElement("div", {
    className: "shell"
  }, React.createElement("div", {
    className: "welcome-card",
    style: {
      maxWidth: 780,
      margin: "0 auto"
    }
  }, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 10
    }
  }, "The Toss"), React.createElement("h1", {
    style: {
      fontSize: "clamp(36px, 6vw, 72px)"
    }
  }, phase === "idle" && React.createElement(React.Fragment, null, "Spin the ", React.createElement("em", null, "striker.")), phase === "spinning" && React.createElement(React.Fragment, null, "Spinning..."), phase === "winner" && React.createElement(React.Fragment, null, "The toss goes to ", React.createElement("em", null, match[winner].name, ".")), phase === "choosing" && React.createElement(React.Fragment, null, React.createElement("em", null, match[winner].name), " picks a side.")), React.createElement("div", {
    className: "toss-stage"
  }, React.createElement("div", {
    className: `striker ${phase === "spinning" ? "spin" : ""}`
  }, React.createElement("div", {
    className: "ring"
  }), React.createElement("div", {
    className: "center"
  })), phase === "idle" && React.createElement(React.Fragment, null, React.createElement("p", {
    className: "tip",
    style: {
      textAlign: "center",
      maxWidth: 460
    }
  }, p1.name, " vs ", p2.name, ". The winner of the toss chooses whether to break or pick a side."), React.createElement("button", {
    className: "btn primary",
    onClick: spin
  }, "Flip the Striker")), phase === "winner" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "toss-result"
  }, "Choose, ", React.createElement("em", null, match[winner].name), "."), React.createElement("div", {
    className: "toss-choice"
  }, React.createElement("button", {
    type: "button",
    className: "choice-card",
    onClick: chooseBreak
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Option A"), React.createElement("div", {
    className: "big"
  }, "Break first"), React.createElement("div", {
    className: "sub"
  }, "You strike first on board 1 with the ", React.createElement("strong", null, "White"), " coins.")), React.createElement("button", {
    type: "button",
    className: "choice-card",
    onClick: chooseSide
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Option B"), React.createElement("div", {
    className: "big"
  }, "Choose your side"), React.createElement("div", {
    className: "sub"
  }, "Pick White or Black. Opponent breaks first."))), React.createElement("button", {
    className: "btn ghost sm",
    onClick: spin,
    style: {
      marginTop: 8
    }
  }, "Re-spin")), phase === "choosing" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "toss-choice"
  }, React.createElement("button", {
    type: "button",
    className: "choice-card",
    onClick: () => confirmSide("White")
  }, React.createElement("div", {
    className: "row",
    style: {
      gap: 14
    }
  }, React.createElement(Coin, {
    color: "white",
    size: 36
  }), React.createElement("div", null, React.createElement("div", {
    className: "big"
  }, "Take White"), React.createElement("div", {
    className: "sub"
  }, "You play the ivory coins.")))), React.createElement("button", {
    type: "button",
    className: "choice-card",
    onClick: () => confirmSide("Black")
  }, React.createElement("div", {
    className: "row",
    style: {
      gap: 14
    }
  }, React.createElement(Coin, {
    color: "black",
    size: 36
  }), React.createElement("div", null, React.createElement("div", {
    className: "big"
  }, "Take Black"), React.createElement("div", {
    className: "sub"
  }, "You play the ebony coins."))))), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setPhase("winner")
  }, "Back")))));
}
Object.assign(window, {
  Toss
});

/* src/drive.jsx */
const DRIVE_CLIENT_KEY = "striker.drive.clientId";
const DRIVE_TOKEN_KEY = "striker.drive.token";
const DRIVE_FOLDER_KEY = "striker.drive.folderId";
const DRIVE_FILEMAP_KEY = "striker.drive.fileMap";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Striker Carrom Scores";
let _tokenClient = null;
let _gisReady = false;
function loadGIS() {
  return new Promise((resolve, reject) => {
    if (_gisReady) return resolve();
    if (document.getElementById("gis-script")) {
      const check = setInterval(() => {
        if (window.google && window.google.accounts) {
          _gisReady = true;
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.id = "gis-script";
    s.onload = () => {
      _gisReady = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}
function getStoredToken() {
  try {
    const raw = localStorage.getItem(DRIVE_TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (t.expiresAt && t.expiresAt < Date.now() + 30_000) return null;
    return t;
  } catch {
    return null;
  }
}
function storeToken(token) {
  localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify(token));
}
function clearToken() {
  localStorage.removeItem(DRIVE_TOKEN_KEY);
}
async function requestAccessToken({
  clientId,
  interactive = true
}) {
  await loadGIS();
  return new Promise((resolve, reject) => {
    try {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        prompt: interactive ? "" : "none",
        callback: resp => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          const token = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + resp.expires_in * 1000
          };
          storeToken(token);
          resolve(token);
        }
      });
      _tokenClient.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}
async function driveFetch(path, opts = {}, token) {
  const t = token || getStoredToken();
  if (!t) throw new Error("Not signed in");
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("Token expired");
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}
async function ensureFolder() {
  let folderId = localStorage.getItem(DRIVE_FOLDER_KEY);
  if (folderId) {
    try {
      await driveFetch(`/drive/v3/files/${folderId}?fields=id,trashed`);
      return folderId;
    } catch {
      folderId = null;
      localStorage.removeItem(DRIVE_FOLDER_KEY);
    }
  }
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const search = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)`);
  const data = await search.json();
  if (data.files && data.files[0]) {
    localStorage.setItem(DRIVE_FOLDER_KEY, data.files[0].id);
    return data.files[0].id;
  }
  const create = await driveFetch(`/drive/v3/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder"
    })
  });
  const folder = await create.json();
  localStorage.setItem(DRIVE_FOLDER_KEY, folder.id);
  return folder.id;
}
function getFileMap() {
  try {
    return JSON.parse(localStorage.getItem(DRIVE_FILEMAP_KEY) || "{}");
  } catch {
    return {};
  }
}
function setFileMap(m) {
  localStorage.setItem(DRIVE_FILEMAP_KEY, JSON.stringify(m));
}
async function uploadOrUpdate({
  existingId,
  name,
  mimeType,
  content,
  parentId
}) {
  const boundary = "strikerboundary" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;
  const metadata = existingId ? {
    name,
    mimeType
  } : {
    name,
    mimeType,
    parents: [parentId]
  };
  const body = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + delimiter + `Content-Type: ${mimeType}\r\n\r\n` + content + close;
  const url = existingId ? `/upload/drive/v3/files/${existingId}?uploadType=multipart` : `/upload/drive/v3/files?uploadType=multipart`;
  const res = await driveFetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });
  return res.json();
}
function matchToCSV(match) {
  const rows = [["Set", "Board", "Winner", "OppLeft", "Queen", "Pts", "Set A", "Set B", "Time"]];
  (match.history || []).filter(h => h.kind === "board").forEach(h => {
    rows.push([h.set, h.board, h.winnerName, h.oppLeft, h.queen ? "Counted +3" : h.queenIgnored ? "Ignored" : "No", h.pts, h.setA, h.setB, new Date(h.at).toISOString()]);
  });
  return rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
async function syncMatch(match) {
  const folderId = await ensureFolder();
  const map = getFileMap();
  const existing = map[match.id] || {};
  const baseName = `${(match.p1.name || "A").replace(/[\\\/:\*\?"<>\|]/g, "")}-vs-${(match.p2.name || "B").replace(/[\\\/:\*\?"<>\|]/g, "")}-${match.id}`;
  const jsonRes = await uploadOrUpdate({
    existingId: existing.jsonId,
    name: `${baseName}.json`,
    mimeType: "application/json",
    content: JSON.stringify(match, null, 2),
    parentId: folderId
  });
  const csvRes = await uploadOrUpdate({
    existingId: existing.csvId,
    name: `${baseName}.csv`,
    mimeType: "text/csv",
    content: matchToCSV(match),
    parentId: folderId
  });
  map[match.id] = {
    jsonId: jsonRes.id,
    csvId: csvRes.id
  };
  setFileMap(map);
  return {
    json: jsonRes,
    csv: csvRes
  };
}
const _timers = new Map();
const _lastPayload = new Map();
function scheduleSync(match, opts = {}) {
  const {
    delay = 2000,
    onStatus
  } = opts;
  if (!getStoredToken()) return;
  const snap = JSON.stringify(match);
  if (_lastPayload.get(match.id) === snap) return;
  _lastPayload.set(match.id, snap);
  if (_timers.has(match.id)) clearTimeout(_timers.get(match.id));
  const t = setTimeout(async () => {
    _timers.delete(match.id);
    try {
      onStatus && onStatus("syncing");
      await syncMatch(match);
      onStatus && onStatus("synced");
    } catch (e) {
      console.warn("Drive sync failed:", e);
      onStatus && onStatus("error", e.message);
    }
  }, delay);
  _timers.set(match.id, t);
}
Object.assign(window, {
  DRIVE_CLIENT_KEY,
  DRIVE_TOKEN_KEY,
  DRIVE_FOLDER_KEY,
  DRIVE_FILEMAP_KEY,
  loadGIS,
  requestAccessToken,
  getStoredToken,
  clearToken,
  ensureFolder,
  syncMatch,
  scheduleSync
});

/* src/drive_ui.jsx */
function DrivePanel({
  active,
  matches
}) {
  const [clientId, setClientId] = React.useState(() => localStorage.getItem(DRIVE_CLIENT_KEY) || "");
  const [connected, setConnected] = React.useState(() => !!getStoredToken());
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState(null);
  React.useEffect(() => {
    if (clientId) localStorage.setItem(DRIVE_CLIENT_KEY, clientId);
  }, [clientId]);
  React.useEffect(() => {
    if (!connected || !active) return;
    scheduleSync(active, {
      delay: 1500,
      onStatus: (s, msg) => {
        setStatus(s);
        if (s === "error") setError(msg);
      }
    });
  }, [active && JSON.stringify(active), connected]);
  const connect = async () => {
    try {
      setError(null);
      if (!clientId) {
        setError("Paste your OAuth Client ID first.");
        return;
      }
      await requestAccessToken({
        clientId: clientId.trim()
      });
      setConnected(true);
      for (const m of matches) {
        scheduleSync(m, {
          delay: 200,
          onStatus: setStatus
        });
      }
    } catch (e) {
      setError(e.message || String(e));
    }
  };
  const disconnect = () => {
    clearToken();
    setConnected(false);
    setStatus("idle");
  };
  const syncNow = async () => {
    if (!active) return;
    try {
      setStatus("syncing");
      setError(null);
      await syncMatch(active);
      setStatus("synced");
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  };
  const openFolder = () => {
    const folderId = localStorage.getItem(DRIVE_FOLDER_KEY);
    if (folderId) window.open(`https://drive.google.com/drive/folders/${folderId}`, "_blank");else window.open("https://drive.google.com/drive/my-drive", "_blank");
  };
  const pill = connected ? status === "syncing" ? {
    txt: "Syncing...",
    cls: "syncing"
  } : status === "error" ? {
    txt: "Sync error",
    cls: "err"
  } : {
    txt: "Synced to Drive",
    cls: "ok"
  } : {
    txt: "Drive off",
    cls: "off"
  };
  return React.createElement(React.Fragment, null, React.createElement("button", {
    className: `drive-pill ${pill.cls}`,
    onClick: () => setOpen(o => !o),
    title: "Google Drive sync"
  }, React.createElement("span", {
    className: "drive-ico",
    "aria-hidden": true
  }, "Drive"), React.createElement("span", null, pill.txt)), open && React.createElement("div", {
    className: "drive-panel"
  }, React.createElement("div", {
    className: "panel-head",
    style: {
      marginBottom: 10
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 22
    }
  }, "Google Drive sync"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setOpen(false)
  }, "Close")), !connected ? React.createElement(React.Fragment, null, React.createElement("p", {
    className: "tip",
    style: {
      marginBottom: 10
    }
  }, "Paste your OAuth ", React.createElement("strong", null, "Client ID"), " (Web application type). Scores auto-upload to a folder called ", React.createElement("em", null, "Striker Carrom Scores"), " in your Drive."), React.createElement("label", {
    className: "eyebrow"
  }, "OAuth Client ID"), React.createElement("input", {
    className: "drive-input",
    placeholder: "xxxxxxxx.apps.googleusercontent.com",
    value: clientId,
    onChange: e => setClientId(e.target.value)
  }), React.createElement("div", {
    className: "row",
    style: {
      marginTop: 12,
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    className: "btn primary",
    onClick: connect,
    disabled: !clientId
  }, "Connect Google"), React.createElement("a", {
    className: "btn ghost sm",
    href: "https://console.cloud.google.com/apis/credentials",
    target: "_blank",
    rel: "noopener"
  }, "Get a Client ID")), React.createElement("details", {
    style: {
      marginTop: 16
    }
  }, React.createElement("summary", {
    className: "tip",
    style: {
      cursor: "pointer"
    }
  }, "Setup steps"), React.createElement("ol", {
    className: "tip",
    style: {
      lineHeight: 1.7,
      paddingLeft: 18
    }
  }, React.createElement("li", null, "Google Cloud / APIs and Services / Enable ", React.createElement("strong", null, "Google Drive API")), React.createElement("li", null, "Credentials / Create OAuth client ID / ", React.createElement("strong", null, "Web application")), React.createElement("li", null, "Add this page's URL as Authorized JavaScript origin"), React.createElement("li", null, "Copy the Client ID and paste it above")))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "row",
    style: {
      marginBottom: 12,
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("span", {
    className: `sync-status ${pill.cls}`
  }, "o"), React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, status === "syncing" ? "Uploading changes to your Drive..." : status === "error" ? "Last sync failed - click retry" : "Every score change auto-saves to your Drive.")), React.createElement("div", {
    className: "row",
    style: {
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    className: "btn primary sm",
    onClick: syncNow,
    disabled: !active
  }, "Sync now"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: openFolder
  }, "Open folder"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: disconnect
  }, "Disconnect"))), error && React.createElement("div", {
    className: "drive-error"
  }, error)));
}
Object.assign(window, {
  DrivePanel
});

/* src/scoreboard.jsx */
function useMatchTimer(match) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (match.phase !== "live") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [match.phase]);
  const elapsed = match.startedAt ? (match.endedAt || now) - match.startedAt : 0;
  return elapsed;
}
function Scoreboard({
  match,
  onUpdate,
  onClose,
  session,
  isAdmin
}) {
  const [oppLeft, setOppLeft] = React.useState(0);
  const [queen, setQueen] = React.useState(false);
  const [confettiKey, setConfettiKey] = React.useState(0);
  const [setModal, setSetModal] = React.useState(null);
  const [matchModal, setMatchModal] = React.useState(false);
  const elapsed = useMatchTimer(match);
  const limitPoints = matchLimitPoints(match);
  const limitBoards = matchLimitBoards(match);
  const queenCutoff = matchQueenCutoff(match);
  const totalSetCount = safeTotalSets(match.totalSets);
  const neededSets = Number(match.setsToWin) || setsNeeded(match);
  const mw = matchWinner(match);
  const isOwner = !!match.ownerId && match.ownerId === session?.id;
  const canEdit = isOwner || isAdmin;
  const canEditBy = isOwner ? "owner" : isAdmin ? "admin" : "none";
  const lastHistoryIdRef = React.useRef(match.history.length);
  React.useEffect(() => {
    const len = match.history.length;
    if (len > lastHistoryIdRef.current) {
      if (canEdit) {
        const lastNew = match.history.slice(lastHistoryIdRef.current).reverse().find(h => h.kind === "set-end");
        if (lastNew) {
          chord([523, 659, 784, 1047], 0.3);
          setConfettiKey(k => k + 1);
          if (matchWinner(match)) setMatchModal(true);else setSetModal(lastNew);
        }
      }
    }
    lastHistoryIdRef.current = len;
  }, [match.history.length, canEdit]);
  const award = to => {
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
    const onKey = e => {
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
  return React.createElement("div", {
    className: "shell"
  }, React.createElement(Confetti, {
    trigger: confettiKey
  }), !canEdit && React.createElement("div", {
    className: "banner",
    style: {
      marginBottom: 16,
      marginTop: 0
    }
  }, React.createElement("span", {
    style: {
      color: "var(--gold)",
      fontWeight: 800
    }
  }, "View"), React.createElement("div", null, React.createElement("strong", null, "Read-only"), " - this match is being run by", " ", React.createElement("strong", null, match.ownerName || "another player"), ". You can watch scores update live but cannot change them. Scores from the cloud refresh automatically.")), canEdit && canEditBy === "admin" && !isOwner && React.createElement("div", {
    className: "banner",
    style: {
      marginBottom: 16,
      marginTop: 0,
      borderColor: "var(--queen-2)",
      background: "rgba(201,52,76,0.08)"
    }
  }, React.createElement("span", {
    style: {
      color: "var(--queen)",
      fontWeight: 800
    }
  }, "Admin"), React.createElement("div", null, React.createElement("strong", null, "Admin mode"), " - you are editing ", match.ownerName ? React.createElement(React.Fragment, null, React.createElement("strong", null, match.ownerName), "'s") : "a", " match. All changes overwrite the cloud record.")), React.createElement("div", {
    className: "score-grid"
  }, React.createElement(PlayerCard, {
    player: match.p1,
    playerKey: "p1",
    match: match,
    leading: p1Lead,
    winner: mw === "p1",
    breakPlayer: match.breakPlayer
  }), React.createElement("div", {
    className: "center-card"
  }, mw ? React.createElement("span", {
    className: "status-tag match-over"
  }, "Match Won") : setPoint ? React.createElement("span", {
    className: "status-tag setpoint"
  }, "Set Point") : React.createElement("span", {
    className: "status-tag"
  }, React.createElement("span", {
    className: "live-dot"
  }), "Live"), React.createElement("div", {
    className: "set-of",
    style: {
      marginTop: 14
    }
  }, "Set"), React.createElement("div", {
    className: "big-set"
  }, match.setNo), React.createElement("div", {
    className: "set-of"
  }, "of ", totalSetCount), React.createElement("div", {
    className: "board-line"
  }, React.createElement("span", null, "Board"), React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--cream)"
    }
  }, Math.min(match.boardNo, limitBoards), " / ", limitBoards)), React.createElement("div", {
    className: "set-of",
    style: {
      marginTop: 12
    }
  }, limitPoints, " pts / Queen at ", queenCutoff, "+"), React.createElement("div", {
    className: "timer"
  }, fmtTime(elapsed))), React.createElement(PlayerCard, {
    player: match.p2,
    playerKey: "p2",
    match: match,
    leading: p2Lead,
    winner: mw === "p2",
    breakPlayer: match.breakPlayer
  })), canEdit && !mw && React.createElement("div", {
    className: "award"
  }, React.createElement("h3", null, "Award the current board"), React.createElement("div", {
    className: "award-row"
  }, React.createElement("div", null, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Opponent coins left"), React.createElement("div", {
    className: "coin-stepper"
  }, React.createElement("button", {
    onClick: () => setOppLeft(v => Math.max(0, v - 1)),
    "aria-label": "decrease"
  }, "-"), React.createElement("div", {
    className: "val"
  }, oppLeft), React.createElement("button", {
    onClick: () => setOppLeft(v => Math.min(9, v + 1)),
    "aria-label": "increase"
  }, "+"))), React.createElement("div", null, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Queen"), React.createElement("button", {
    type: "button",
    className: `queen-toggle ${queen ? "on" : ""}`,
    onClick: () => setQueen(q => !q)
  }, React.createElement("span", {
    className: "queen-coin"
  }), queen ? "Covered (+3 if allowed)" : "Not covered")), React.createElement("div", null), React.createElement("div", {
    className: "award-actions"
  }, React.createElement("button", {
    className: "btn dark",
    onClick: () => award("p1")
  }, "Award to ", match.p1.name), React.createElement("button", {
    className: "btn primary",
    onClick: () => award("p2")
  }, "Award to ", match.p2.name)), React.createElement("div", {
    className: "award-hint"
  }, "Enter how many of the ", React.createElement("strong", null, "losing"), " player's coins remain. Queen +3 is ignored only when the board winner already has ", queenCutoff, "+ points before this board."))), React.createElement("div", {
    className: "panel",
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, canEdit && React.createElement(React.Fragment, null, React.createElement("button", {
    className: "btn ghost sm",
    onClick: doUndo,
    disabled: !match.stack?.length
  }, "Undo"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: doResetSet
  }, "Reset Set"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: doResetMatch
  }, "Reset Match"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: doSwap
  }, "Swap Players")), React.createElement("div", {
    className: "spacer"
  }), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => exportJSON(match)
  }, "Export JSON"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => exportCSV(match)
  }, "Export CSV"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: onClose
  }, "Close Match")), isAdmin && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "panel",
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      borderColor: "var(--queen-2)",
      background: "rgba(201,52,76,0.04)"
    }
  }, React.createElement("span", {
    className: "eyebrow",
    style: {
      color: "var(--queen)",
      marginRight: 6
    }
  }, "Admin"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: doRollbackLastSet
  }, "Rollback last set"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: doSkipSet,
    disabled: !!mw
  }, "Force-end current set"), match.phase === "over" && React.createElement("button", {
    className: "btn crimson sm",
    onClick: doReopenMatch
  }, "Re-open match"), React.createElement("div", {
    className: "spacer"
  }), React.createElement("span", {
    className: "tip"
  }, "Owner: ", match.ownerName || "-", " / id ", match.ownerId ? match.ownerId.slice(0, 8) : "-")), React.createElement(AdminRulesEditor, {
    match: match,
    onApply: onUpdate
  })), React.createElement(HistoryPanel, {
    match: match
  }), React.createElement(Modal, {
    open: !!setModal,
    onClose: () => setSetModal(null)
  }, setModal && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "stinger"
  }, "Set ", setModal.set, " complete"), React.createElement("h2", null, setModal.winner ? React.createElement(React.Fragment, null, "Set to ", React.createElement("em", null, setModal.winnerName)) : React.createElement(React.Fragment, null, "Tied set")), React.createElement("div", {
    className: "modal-score"
  }, match.p1.name, " ", setModal.finalA, " / ", setModal.finalB, " ", match.p2.name), React.createElement("div", {
    className: "modal-actions"
  }, React.createElement("button", {
    className: "btn primary",
    onClick: () => setSetModal(null)
  }, "Next Set")))), React.createElement(Modal, {
    open: matchModal,
    onClose: () => setMatchModal(false)
  }, React.createElement("div", {
    className: "stinger crimson"
  }, "Match Complete"), React.createElement("h2", null, React.createElement("em", null, mw ? match[mw].name : ""), " wins"), React.createElement("div", {
    className: "modal-score"
  }, "Sets ", match.p1.setsWon, " - ", match.p2.setsWon, " / first to ", neededSets, " / ", fmtTime(elapsed)), React.createElement("div", {
    className: "modal-actions"
  }, canEdit && React.createElement("button", {
    className: "btn primary",
    onClick: () => {
      doResetMatch();
      setMatchModal(false);
    }
  }, "Rematch"), React.createElement("button", {
    className: "btn ghost",
    onClick: () => setMatchModal(false)
  }, "Review Board"))));
}
function AdminRulesEditor({
  match,
  onApply
}) {
  const readDraft = React.useCallback(() => ({
    totalSets: safeTotalSets(match.totalSets),
    setsToWin: clampInt(match.setsToWin, 1, safeTotalSets(match.totalSets), setsNeeded(match)),
    limitPoints: clampInt(matchLimitPoints(match), 1, 99, 25),
    limitBoards: clampInt(matchLimitBoards(match), 1, 25, 8),
    queenCutoff: clampInt(matchQueenCutoff(match), 0, matchLimitPoints(match), 22),
    setNo: clampInt(match.setNo, 1, safeTotalSets(match.totalSets), 1),
    boardNo: clampInt(match.boardNo, 1, matchLimitBoards(match), 1)
  }), [match.id, match.totalSets, match.setsToWin, match.limitPoints, match.limitBoards, match.queenCutoff, match.setNo, match.boardNo]);
  const [draft, setDraft] = React.useState(readDraft);
  React.useEffect(() => setDraft(readDraft()), [readDraft]);
  const update = (field, value) => setDraft(d => ({
    ...d,
    [field]: value
  }));
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
        boardNo
      };
      const winner = matchWinner(next);
      if (winner) {
        return {
          ...next,
          phase: "over",
          endedAt: next.endedAt || Date.now()
        };
      }
      if (next.phase === "over") {
        return {
          ...next,
          phase: "live",
          endedAt: null
        };
      }
      return next;
    });
  };
  return React.createElement("div", {
    className: "panel",
    style: {
      borderColor: "var(--queen-2)",
      background: "rgba(201,52,76,0.04)"
    }
  }, React.createElement("div", {
    className: "panel-head"
  }, React.createElement("h3", null, "Admin match rules"), React.createElement("button", {
    type: "button",
    className: "btn primary sm",
    onClick: apply
  }, "Apply rules")), React.createElement("div", {
    className: "setup-controls",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      marginTop: 0
    }
  }, React.createElement(NumberField, {
    label: "Total sets",
    value: draft.totalSets,
    min: 1,
    max: 9,
    onChange: v => update("totalSets", v)
  }), React.createElement(NumberField, {
    label: "Sets to win",
    value: draft.setsToWin,
    min: 1,
    max: safeTotalSets(draft.totalSets),
    onChange: v => update("setsToWin", v)
  }), React.createElement(NumberField, {
    label: "Points per set",
    value: draft.limitPoints,
    min: 1,
    max: 99,
    onChange: v => update("limitPoints", v)
  }), React.createElement(NumberField, {
    label: "Boards per set",
    value: draft.limitBoards,
    min: 1,
    max: 25,
    onChange: v => update("limitBoards", v)
  }), React.createElement(NumberField, {
    label: "Queen cutoff",
    value: draft.queenCutoff,
    min: 0,
    max: clampInt(draft.limitPoints, 1, 99, 25),
    onChange: v => update("queenCutoff", v)
  }), React.createElement(NumberField, {
    label: "Current set",
    value: draft.setNo,
    min: 1,
    max: safeTotalSets(draft.totalSets),
    onChange: v => update("setNo", v)
  }), React.createElement(NumberField, {
    label: "Current board",
    value: draft.boardNo,
    min: 1,
    max: clampInt(draft.limitBoards, 1, 25, 8),
    onChange: v => update("boardNo", v)
  })), React.createElement("div", {
    className: "tip"
  }, "Community admins can correct match format, current set, current board, scoring limit, board limit, and queen cutoff. Existing board history is kept."));
}
function NumberField({
  label,
  value,
  min,
  max,
  onChange
}) {
  return React.createElement("label", {
    className: "name-field",
    style: {
      display: "block",
      padding: 14
    }
  }, React.createElement("div", {
    className: "eyebrow"
  }, label), React.createElement("input", {
    type: "number",
    min: min,
    max: max,
    step: "1",
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: "100%"
    }
  }));
}
function PlayerCard({
  player,
  playerKey,
  match,
  leading,
  winner,
  breakPlayer
}) {
  const cls = `player-card ${leading ? "leading" : ""} ${winner ? "winner-match" : ""}`;
  return React.createElement("div", {
    className: cls
  }, React.createElement("div", {
    className: "player-head"
  }, React.createElement(Avatar, {
    name: player.name,
    color: player.color
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "player-name"
  }, player.name), player.label && React.createElement("div", {
    className: "player-label eyebrow"
  }, player.label), match.matchType === "doubles" && player.members?.length > 1 && React.createElement("div", {
    className: "member-list"
  }, player.members.join(" + ")), React.createElement("div", {
    className: "player-meta"
  }, React.createElement("span", {
    className: "chip"
  }, React.createElement(Coin, {
    color: player.color.toLowerCase(),
    size: 10
  }), " ", player.color), breakPlayer === playerKey && React.createElement("span", {
    className: "chip break"
  }, "Breaks")))), React.createElement("div", {
    className: "score-rows"
  }, React.createElement("div", {
    className: "score-cell"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Set points"), React.createElement("div", {
    className: "num"
  }, player.setPts)), React.createElement("div", {
    className: "score-cell"
  }, React.createElement("div", {
    className: "eyebrow"
  }, "Sets won"), React.createElement("div", {
    className: "num small"
  }, player.setsWon), React.createElement(SetPips, {
    won: player.setsWon,
    max: Number(match.setsToWin) || setsNeeded(match)
  }))));
}
function HistoryPanel({
  match
}) {
  const rows = match.history;
  return React.createElement("div", {
    className: "panel"
  }, React.createElement("div", {
    className: "panel-head"
  }, React.createElement("h3", null, "Match history"), React.createElement("div", {
    className: "panel-actions"
  }, React.createElement("span", {
    className: "tip"
  }, rows.filter(r => r.kind === "board").length, " boards played"))), !rows.length ? React.createElement("div", {
    className: "empty"
  }, "No boards yet - award the first one above.") : React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, React.createElement("table", {
    className: "history-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", null, "Set"), React.createElement("th", null, "Board"), React.createElement("th", null, "Winner"), React.createElement("th", null, "Opp. Left"), React.createElement("th", null, "Queen"), React.createElement("th", null, "Pts"), React.createElement("th", null, match.p1.name), React.createElement("th", null, match.p2.name), React.createElement("th", null, "Time"))), React.createElement("tbody", null, (() => {
    let n = 0;
    return rows.map((h, i) => {
      if (h.kind === "set-end") {
        return React.createElement("tr", {
          key: i,
          className: "set-row"
        }, React.createElement("td", {
          colSpan: 10
        }, "Set ", h.set, " to ", h.winnerName, " / final ", h.finalA, "-", h.finalB));
      }
      n += 1;
      return React.createElement("tr", {
        key: i
      }, React.createElement("td", {
        className: "mono"
      }, n), React.createElement("td", null, h.set), React.createElement("td", null, h.board), React.createElement("td", null, React.createElement("span", {
        className: "winner-badge"
      }, h.winnerName)), React.createElement("td", {
        className: "mono"
      }, h.oppLeft), React.createElement("td", null, h.queen ? React.createElement("span", {
        className: "queen-badge"
      }, "+3") : h.queenIgnored ? React.createElement("span", {
        className: "queen-badge ignored"
      }, "Ignored") : "-"), React.createElement("td", {
        className: "mono",
        style: {
          fontWeight: 700
        }
      }, h.pts), React.createElement("td", {
        className: "score-cell-inline"
      }, h.setA), React.createElement("td", {
        className: "score-cell-inline"
      }, h.setB), React.createElement("td", {
        className: "mono",
        style: {
          color: "var(--muted)"
        }
      }, new Date(h.at).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      })));
    });
  })()))));
}
Object.assign(window, {
  Scoreboard,
  AdminRulesEditor,
  NumberField,
  PlayerCard,
  HistoryPanel
});

/* src/leaderboard.jsx */
function Leaderboard({
  community,
  session,
  onOpenMatch,
  isAdmin,
  onDelete
}) {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [tab, setTab] = React.useState("overall");
  const communityId = community?.id || session?.communityId;
  const load = async () => {
    if (!communityId) return;
    try {
      setRows(await fetchAllMatches({
        communityId,
        limit: 500
      }));
    } catch (e) {
      setErr(e.message);
    }
  };
  React.useEffect(() => {
    setRows(null);
    setErr(null);
    load();
  }, [communityId]);
  React.useEffect(() => {
    let off;
    if (!communityId) return;
    (async () => {
      off = await subscribeMatches(communityId, () => load());
    })();
    return () => {
      if (off) off();
    };
  }, [communityId]);
  const stats = React.useMemo(() => computeStats(rows || []), [rows]);
  if (err) return React.createElement("div", {
    className: "shell"
  }, React.createElement("div", {
    className: "panel"
  }, React.createElement("div", {
    className: "drive-error"
  }, err)));
  if (!rows) return React.createElement("div", {
    className: "shell"
  }, React.createElement("div", {
    className: "panel"
  }, React.createElement("div", {
    className: "empty"
  }, "Loading leaderboard...")));
  const finished = rows.filter(r => r.winner_name);
  return React.createElement("div", {
    className: "shell"
  }, React.createElement("div", {
    className: "panel"
  }, React.createElement("div", {
    className: "panel-head"
  }, React.createElement("h3", null, community?.name || "Community", " leaderboard"), React.createElement("div", {
    className: "panel-actions"
  }, React.createElement("button", {
    type: "button",
    className: `btn ghost sm ${tab === "overall" ? "" : ""}`,
    onClick: () => setTab("overall"),
    style: {
      borderColor: tab === "overall" ? "var(--gold)" : undefined
    }
  }, "Overall"), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => setTab("feed"),
    style: {
      borderColor: tab === "feed" ? "var(--gold)" : undefined
    }
  }, "Recent"), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => setTab("h2h"),
    style: {
      borderColor: tab === "h2h" ? "var(--gold)" : undefined
    }
  }, "Head-to-head"), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => setTab("monthly"),
    style: {
      borderColor: tab === "monthly" ? "var(--gold)" : undefined
    }
  }, "Monthly"))), tab === "overall" && React.createElement(OverallTable, {
    stats: stats
  }), tab === "feed" && React.createElement(RecentFeed, {
    rows: rows,
    onOpen: onOpenMatch,
    isAdmin: isAdmin,
    onDelete: onDelete
  }), tab === "h2h" && React.createElement(HeadToHead, {
    stats: stats
  }), tab === "monthly" && React.createElement(MonthlyStats, {
    rows: finished
  })));
}
function computeStats(rows) {
  const players = new Map();
  const h2h = new Map();
  const finished = rows.filter(r => r.winner_name);
  const chrono = [...finished].sort((a, b) => new Date(a.ended_at || a.updated_at) - new Date(b.ended_at || b.updated_at));
  const getP = n => {
    if (!players.has(n)) players.set(n, {
      name: n,
      wins: 0,
      losses: 0,
      matches: 0,
      setsWon: 0,
      setsLost: 0,
      currentStreak: 0,
      bestStreak: 0
    });
    return players.get(n);
  };
  for (const r of chrono) {
    const a = getP(r.p1_name),
      b = getP(r.p2_name);
    a.matches++;
    b.matches++;
    a.setsWon += r.p1_sets_won;
    a.setsLost += r.p2_sets_won;
    b.setsWon += r.p2_sets_won;
    b.setsLost += r.p1_sets_won;
    if (r.winner_name === r.p1_name) {
      a.wins++;
      b.losses++;
      a.currentStreak = Math.max(1, a.currentStreak + 1);
      b.currentStreak = 0;
    } else if (r.winner_name === r.p2_name) {
      b.wins++;
      a.losses++;
      b.currentStreak = Math.max(1, b.currentStreak + 1);
      a.currentStreak = 0;
    }
    a.bestStreak = Math.max(a.bestStreak, a.currentStreak);
    b.bestStreak = Math.max(b.bestStreak, b.currentStreak);
    const [x, y] = [r.p1_name, r.p2_name].sort();
    const key = `${x}|${y}`;
    if (!h2h.has(key)) h2h.set(key, {
      a: x,
      b: y,
      wins_a: 0,
      wins_b: 0,
      matches: 0
    });
    const rec = h2h.get(key);
    rec.matches++;
    if (r.winner_name === x) rec.wins_a++;else if (r.winner_name === y) rec.wins_b++;
  }
  return {
    players: Array.from(players.values()).sort((a, b) => b.wins - a.wins || b.wins / Math.max(1, b.matches) - a.wins / Math.max(1, a.matches) || b.matches - a.matches),
    h2h: Array.from(h2h.values()).sort((a, b) => b.matches - a.matches)
  };
}
function OverallTable({
  stats
}) {
  if (!stats.players.length) return React.createElement("div", {
    className: "empty"
  }, "No completed matches yet - play some!");
  return React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, React.createElement("table", {
    className: "history-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", null, "Player"), React.createElement("th", null, "W"), React.createElement("th", null, "L"), React.createElement("th", null, "Matches"), React.createElement("th", null, "Win %"), React.createElement("th", null, "Sets W-L"), React.createElement("th", null, "Best Streak"), React.createElement("th", null, "Current"))), React.createElement("tbody", null, stats.players.map((p, i) => React.createElement("tr", {
    key: p.name
  }, React.createElement("td", {
    className: "mono"
  }, i + 1), React.createElement("td", null, React.createElement("span", {
    className: "winner-badge"
  }, p.name)), React.createElement("td", {
    className: "mono",
    style: {
      color: "var(--leaf)",
      fontWeight: 700
    }
  }, p.wins), React.createElement("td", {
    className: "mono",
    style: {
      color: "var(--queen)"
    }
  }, p.losses), React.createElement("td", {
    className: "mono"
  }, p.matches), React.createElement("td", {
    className: "mono"
  }, p.matches ? Math.round(p.wins / p.matches * 100) : 0, "%"), React.createElement("td", {
    className: "mono"
  }, p.setsWon, "-", p.setsLost), React.createElement("td", {
    className: "mono",
    style: {
      color: "var(--gold)"
    }
  }, p.bestStreak), React.createElement("td", {
    className: "mono"
  }, p.currentStreak > 0 ? `${p.currentStreak} win streak` : "-"))))));
}
function RecentFeed({
  rows,
  onOpen,
  isAdmin,
  onDelete
}) {
  if (!rows.length) return React.createElement("div", {
    className: "empty"
  }, "No matches yet.");
  return React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, React.createElement("table", {
    className: "history-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "When"), React.createElement("th", null, "Match"), React.createElement("th", null, "Score"), React.createElement("th", null, "Winner"), React.createElement("th", null, "Status"), React.createElement("th", null))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    className: "mono",
    style: {
      color: "var(--muted)"
    }
  }, fmtDate(r.updated_at)), React.createElement("td", null, r.p1_name, " vs ", r.p2_name), React.createElement("td", {
    className: "mono"
  }, r.p1_sets_won, " - ", r.p2_sets_won), React.createElement("td", null, r.winner_name ? React.createElement("span", {
    className: "winner-badge"
  }, r.winner_name) : "-"), React.createElement("td", null, React.createElement("span", {
    className: `chip ${r.winner_name ? "" : ""}`,
    style: {
      color: r.winner_name ? "var(--gold)" : "var(--muted)"
    }
  }, r.winner_name ? "Final" : r.phase)), React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => onOpen && onOpen(r)
  }, "Open"), isAdmin && React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    style: {
      marginLeft: 6,
      color: "var(--queen)"
    },
    onClick: () => onDelete && onDelete(r)
  }, "Delete")))))));
}
function HeadToHead({
  stats
}) {
  if (!stats.h2h.length) return React.createElement("div", {
    className: "empty"
  }, "No head-to-head records yet.");
  return React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, React.createElement("table", {
    className: "history-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Rivalry"), React.createElement("th", null, "Record"), React.createElement("th", null, "Matches"), React.createElement("th", null, "Edge"))), React.createElement("tbody", null, stats.h2h.map(r => {
    const edge = r.wins_a === r.wins_b ? "Even" : r.wins_a > r.wins_b ? `${r.a} +${r.wins_a - r.wins_b}` : `${r.b} +${r.wins_b - r.wins_a}`;
    return React.createElement("tr", {
      key: `${r.a}|${r.b}`
    }, React.createElement("td", null, r.a, " vs ", r.b), React.createElement("td", {
      className: "mono"
    }, r.wins_a, " - ", r.wins_b), React.createElement("td", {
      className: "mono"
    }, r.matches), React.createElement("td", null, React.createElement("span", {
      className: "winner-badge"
    }, edge)));
  }))));
}
function MonthlyStats({
  rows
}) {
  const byMonth = {};
  for (const r of rows) {
    const d = new Date(r.ended_at || r.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = byMonth[key] || {
      month: key,
      matches: 0,
      players: new Set(),
      topPlayer: {}
    };
    byMonth[key].matches++;
    byMonth[key].players.add(r.p1_name);
    byMonth[key].players.add(r.p2_name);
    if (r.winner_name) byMonth[key].topPlayer[r.winner_name] = (byMonth[key].topPlayer[r.winner_name] || 0) + 1;
  }
  const list = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
  if (!list.length) return React.createElement("div", {
    className: "empty"
  }, "No finished matches yet.");
  return React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, React.createElement("table", {
    className: "history-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Month"), React.createElement("th", null, "Matches"), React.createElement("th", null, "Players"), React.createElement("th", null, "Top"))), React.createElement("tbody", null, list.map(m => {
    const top = Object.entries(m.topPlayer).sort((a, b) => b[1] - a[1])[0];
    return React.createElement("tr", {
      key: m.month
    }, React.createElement("td", null, new Date(m.month + "-01").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long"
    })), React.createElement("td", {
      className: "mono"
    }, m.matches), React.createElement("td", {
      className: "mono"
    }, m.players.size), React.createElement("td", null, top ? React.createElement("span", {
      className: "winner-badge"
    }, top[0], " - ", top[1], "W") : "-"));
  }))));
}
Object.assign(window, {
  Leaderboard
});

/* src/app.jsx */
function AdminPanel({
  open,
  onClose,
  session,
  community,
  isAdmin,
  setIsAdmin
}) {
  const [pinInput, setPinInput] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const eligible = isAdminEligible(session);
  React.useEffect(() => {
    if (!open) {
      setPinInput("");
      setErr(null);
    }
  }, [open]);
  const tryLogin = async () => {
    setErr(null);
    if (!eligible) {
      setErr("Only community owners and admins can unlock admin controls.");
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyAdminPin(pinInput, session);
      if (!ok) {
        setErr("Wrong player PIN.");
        return;
      }
      setIsAdmin(true);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const stepDown = () => {
    setIsAdmin(false);
    onClose();
  };
  if (!open) return null;
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation(),
    style: {
      padding: "32px 28px"
    }
  }, isAdmin ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "stinger"
  }, "Community Admin"), React.createElement("h2", {
    style: {
      fontSize: 36
    }
  }, "Admin is ", React.createElement("em", null, "active.")), React.createElement("p", {
    className: "tip",
    style: {
      margin: "10px 0 18px"
    }
  }, "Active in ", community?.name, ". Admin mode stays on until you step down, sign out, or switch community."), React.createElement("div", {
    className: "modal-actions"
  }, React.createElement("button", {
    type: "button",
    className: "btn ghost",
    onClick: onClose
  }, "Close"), React.createElement("button", {
    type: "button",
    className: "btn crimson",
    onClick: stepDown
  }, "Step down"))) : !eligible ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "stinger"
  }, "Access Denied"), React.createElement("h2", {
    style: {
      fontSize: 32
    }
  }, "Not an ", React.createElement("em", null, "admin.")), React.createElement("p", {
    className: "tip",
    style: {
      margin: "10px 0 18px",
      lineHeight: 1.5
    }
  }, "Ask a community owner to promote your player account to owner or admin in Supabase."), React.createElement("div", {
    className: "modal-actions"
  }, React.createElement("button", {
    type: "button",
    className: "btn ghost",
    onClick: onClose
  }, "Close"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "stinger"
  }, "Community Admin"), React.createElement("h2", {
    style: {
      fontSize: 36
    }
  }, "Confirm your ", React.createElement("em", null, "PIN.")), React.createElement("p", {
    className: "tip",
    style: {
      margin: "10px 0 18px"
    }
  }, "Signed in as ", React.createElement("strong", null, session?.name), " in ", React.createElement("strong", null, community?.name), ". Re-enter your player PIN to unlock edit/delete controls."), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    value: pinInput,
    autoFocus: true,
    onKeyDown: e => {
      if (e.key === "Enter") tryLogin();
    },
    onChange: e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)),
    placeholder: "PIN",
    className: "drive-input",
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.5em",
      fontSize: 20,
      textAlign: "center"
    }
  }), err && React.createElement("div", {
    className: "drive-error"
  }, err), React.createElement("div", {
    className: "modal-actions",
    style: {
      marginTop: 18
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn ghost",
    onClick: onClose,
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    type: "button",
    className: "btn primary",
    onClick: tryLogin,
    disabled: busy || pinInput.length < 4
  }, busy ? "Checking..." : "Unlock")))));
}
function App() {
  const [community, setCommunityState] = React.useState(() => getCommunitySession());
  const [session, setSessionState] = React.useState(() => getSession());
  const [view, setView] = React.useState("play");
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState("idle");
  const {
    state,
    active,
    createMatch,
    closeMatch,
    setActive,
    updateMatch,
    upsertAndActivate,
    replaceMatch
  } = useStore(community?.id);
  React.useEffect(() => {
    const current = getSession();
    if (!community || current?.communityId !== community.id) {
      setSessionState(null);
      setIsAdmin(false);
    }
  }, [community?.id]);
  React.useEffect(() => {
    if (!session || !isAdminEligible(session)) setIsAdmin(false);
  }, [session?.id, session?.role]);
  React.useEffect(() => {
    if (!community || !session || !active) return;
    const canWrite = active.ownerId === session.id || isAdmin;
    if (!canWrite) return;
    scheduleSupabaseSync(active, session.id, {
      communityId: community.id,
      onStatus: s => setSyncStatus(s)
    });
  }, [active && JSON.stringify(active), community?.id, session?.id, isAdmin]);
  React.useEffect(() => {
    if (!community || !session || !active) return;
    const canWrite = active.ownerId === session.id || isAdmin;
    if (canWrite) return;
    let off = null;
    let cancelled = false;
    (async () => {
      try {
        off = await subscribeToMatch(community.id, active.id, payload => {
          const row = payload.new || payload.record;
          if (!row || !row.data || row.community_id !== community.id) return;
          if (cancelled) return;
          replaceMatch({
            ...row.data,
            communityId: community.id
          });
        });
      } catch (e) {
        console.warn("spectator subscribe failed:", e);
      }
    })();
    return () => {
      cancelled = true;
      if (off) off();
    };
  }, [active?.id, community?.id, session?.id, isAdmin]);
  React.useEffect(() => {
    if (!community || !session) return;
    let off = null;
    (async () => {
      try {
        off = await subscribeMatches(community.id, payload => {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            if (id) closeMatch(id);
          }
        });
      } catch (e) {
        console.warn("community subscribe failed:", e);
      }
    })();
    return () => {
      if (off) off();
    };
  }, [community?.id, session?.id]);
  const switchCommunity = () => {
    clearAllSessions();
    setCommunityState(null);
    setSessionState(null);
    setIsAdmin(false);
    setView("play");
    setActive(null);
    setSyncStatus("idle");
  };
  if (!community) {
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "topbar"
    }, React.createElement("div", {
      className: "brand"
    }, React.createElement(BrandMark, null), React.createElement("div", {
      className: "brand-name"
    }, "Striker ", React.createElement("em", null, "/"), " Carrom")), React.createElement("button", {
      type: "button",
      className: "btn ghost sm",
      onClick: () => setHelpOpen(true)
    }, "Help")), React.createElement(CommunityEntry, {
      onCommunityReady: c => {
        setCommunityState(c);
        setSessionState(null);
        setView("play");
      },
      onCommunityAndPlayerReady: ({
        community,
        player
      }) => {
        setCommunityState(community);
        setSessionState(player);
        setView("play");
      },
      onHelp: () => setHelpOpen(true)
    }), React.createElement(HelpModal, {
      open: helpOpen,
      onClose: () => setHelpOpen(false)
    }));
  }
  if (!session) {
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "topbar"
    }, React.createElement("div", {
      className: "brand"
    }, React.createElement(BrandMark, null), React.createElement("div", {
      className: "brand-name"
    }, "Striker ", React.createElement("em", null, "/"), " Carrom")), React.createElement("div", {
      className: "row",
      style: {
        gap: 10,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      className: "chip",
      style: {
        color: "var(--cream)"
      }
    }, community.name), React.createElement("button", {
      type: "button",
      className: "btn ghost sm",
      onClick: () => setHelpOpen(true)
    }, "Help"), React.createElement("button", {
      type: "button",
      className: "btn ghost sm",
      onClick: switchCommunity
    }, "Switch community"))), React.createElement(SignIn, {
      community: community,
      onSignedIn: s => {
        const nextCommunity = {
          ...community,
          role: s.role || community.role || "member"
        };
        setCommunitySession(nextCommunity);
        setCommunityState(nextCommunity);
        setSessionState(s);
      }
    }), React.createElement(HelpModal, {
      open: helpOpen,
      onClose: () => setHelpOpen(false)
    }));
  }
  const startNew = () => setActive(null);
  const goHome = () => {
    setView("play");
    setActive(null);
  };
  const onStartFromWelcome = opts => {
    const id = createMatch({
      ...opts,
      communityId: community.id,
      ownerId: session.id,
      ownerName: session.name
    });
    updateMatch(id, m => ({
      ...m,
      communityId: community.id,
      phase: "toss"
    }));
  };
  const onTossDone = res => {
    if (!active) return;
    updateMatch(active.id, m => ({
      ...m,
      communityId: community.id,
      phase: "live",
      startedAt: Date.now(),
      tossWinner: res.tossWinner,
      tossChoice: res.tossChoice,
      breakPlayer: res.breakPlayer,
      p1: {
        ...m.p1,
        color: res.p1Color || m.p1.color
      },
      p2: {
        ...m.p2,
        color: res.p2Color || m.p2.color
      }
    }));
  };
  const openFromCloud = row => {
    if (!row?.data || row.community_id !== community.id) return;
    upsertAndActivate({
      ...row.data,
      communityId: community.id
    });
    setView("play");
  };
  const deleteFromCloud = async row => {
    if (!isAdmin || row.community_id !== community.id) return;
    if (!confirm(`Delete match "${row.p1_name} vs ${row.p2_name}"? This cannot be undone.`)) return;
    try {
      await deleteMatchById(community.id, row.id);
      closeMatch(row.id);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };
  const syncPill = React.createElement("span", {
    className: `drive-pill ${syncStatus === "synced" ? "ok" : syncStatus === "syncing" ? "syncing" : syncStatus === "error" ? "err" : "off"}`
  }, React.createElement("span", {
    className: "drive-ico"
  }, "o"), syncStatus === "syncing" ? "Syncing..." : syncStatus === "synced" ? "Cloud synced" : syncStatus === "error" ? "Sync error" : "Cloud");
  const showAdminButton = isAdminEligible(session);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "topbar"
  }, React.createElement("div", {
    className: "brand",
    style: {
      cursor: "pointer"
    },
    onClick: goHome
  }, React.createElement(BrandMark, null), React.createElement("div", {
    className: "brand-name"
  }, "Striker ", React.createElement("em", null, "/"), " Carrom")), React.createElement("div", {
    className: "row",
    style: {
      gap: 10,
      flexWrap: "wrap"
    }
  }, React.createElement("span", {
    className: "chip",
    style: {
      color: "var(--cream)"
    }
  }, community.name), React.createElement("button", {
    type: "button",
    className: `tab ${view === "play" ? "active" : ""}`,
    onClick: () => setView("play")
  }, "Play"), React.createElement("button", {
    type: "button",
    className: `tab ${view === "leaderboard" ? "active" : ""}`,
    onClick: () => setView("leaderboard")
  }, "Leaderboard"), syncPill, React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => setHelpOpen(true)
  }, "Help"), React.createElement("span", {
    className: "chip hide-sm",
    style: {
      color: "var(--cream)"
    }
  }, React.createElement("span", {
    style: {
      color: "var(--gold)"
    }
  }, "o"), " ", session.name), showAdminButton && (!isAdmin ? React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => setAdminOpen(true)
  }, "Admin") : React.createElement("span", {
    className: "chip break",
    onClick: () => setAdminOpen(true),
    style: {
      cursor: "pointer"
    }
  }, "Admin")), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: startNew
  }, "+ New"), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => {
      signOut();
      setSessionState(null);
      setIsAdmin(false);
    }
  }, "Sign out"), React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: switchCommunity
  }, "Switch community"))), state.matches.length > 0 && view === "play" && React.createElement("div", {
    className: "tab-row"
  }, state.matches.map(m => {
    const label = `${m.p1.name || "A"} vs ${m.p2.name || "B"}`;
    const isActive = m.id === state.activeId;
    const isMine = m.ownerId === session.id;
    return React.createElement("div", {
      key: m.id,
      className: `tab ${isActive ? "active" : ""}`,
      onClick: () => setActive(m.id),
      role: "button",
      title: m.ownerName ? `Started by ${m.ownerName}` : ""
    }, React.createElement("span", null, label, !isMine && m.ownerName ? ` / ${m.ownerName}` : ""), React.createElement("span", {
      style: {
        opacity: .6
      },
      className: "mono"
    }, m.p1.setsWon, "-", m.p2.setsWon), React.createElement("button", {
      type: "button",
      className: "close",
      onClick: e => {
        e.stopPropagation();
        if (confirm(`Close ${label} locally? Cloud copy stays.`)) closeMatch(m.id);
      }
    }, "x"));
  }), React.createElement("button", {
    type: "button",
    className: "tab",
    onClick: () => setActive(null)
  }, "+ New")), view === "leaderboard" && React.createElement(Leaderboard, {
    community: community,
    session: session,
    isAdmin: isAdmin,
    onOpenMatch: openFromCloud,
    onDelete: deleteFromCloud
  }), view === "play" && !active && React.createElement(Welcome, {
    onStart: onStartFromWelcome,
    onHelp: () => setHelpOpen(true)
  }), view === "play" && active?.phase === "toss" && React.createElement(Toss, {
    match: active,
    onDone: onTossDone
  }), view === "play" && active && (active.phase === "live" || active.phase === "over") && React.createElement(Scoreboard, {
    match: active,
    session: session,
    isAdmin: isAdmin,
    onUpdate: u => updateMatch(active.id, u),
    onClose: () => {
      if (confirm("Close this match locally? Cloud copy stays.")) closeMatch(active.id);
    }
  }), view === "play" && active?.phase === "setup" && React.createElement(Welcome, {
    onStart: onStartFromWelcome,
    onHelp: () => setHelpOpen(true)
  }), React.createElement(HelpModal, {
    open: helpOpen,
    onClose: () => setHelpOpen(false)
  }), React.createElement(AdminPanel, {
    open: adminOpen,
    onClose: () => setAdminOpen(false),
    session: session,
    community: community,
    isAdmin: isAdmin,
    setIsAdmin: setIsAdmin
  }));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App, null));
