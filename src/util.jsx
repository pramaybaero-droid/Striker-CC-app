// Utility helpers shared across the app

const LIMIT_POINTS = 25;
const LIMIT_BOARDS = 8;
const QUEEN_CUTOFF = 22;
const MAX_SETS = 3;
const STORAGE_KEY = "striker.matches.v1";
const ACTIVE_KEY = "striker.active.v1";

const SCORE_FORMATS = {
  standard: { label: "25 points / 8 boards", limitPoints: 25, limitBoards: 8, queenCutoff: 22 },
  quick:    { label: "15 points / 4 boards", limitPoints: 15, limitBoards: 4, queenCutoff: 11 },
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
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
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
  communityId = null,
} = {}) {
  const isDoubles = matchType === "doubles";
  const normalizedScoreFormat = SCORE_FORMATS[scoreFormat] ? scoreFormat : "standard";
  const rules = scoreRules(normalizedScoreFormat);
  const setCount = safeTotalSets(totalSets);
  const p1Members = isDoubles
    ? [cleanName(teamA1, "Team A Player 1"), cleanName(teamA2, "Team A Player 2")]
    : [cleanName(name1, "Player One")];
  const p2Members = isDoubles
    ? [cleanName(teamB1, "Team B Player 1"), cleanName(teamB2, "Team B Player 2")]
    : [cleanName(name2, "Player Two")];

  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    communityId,
    ownerId: ownerId,            // player id of the user who started this match
    ownerName: ownerName || "",  // display name at the time the match was started
    phase: "setup",           // setup -> toss -> live -> over
    startedAt: null,
    endedAt: null,
    tossWinner: null,         // "p1" | "p2"
    tossChoice: null,         // "break" | "side"
    breakPlayer: null,        // "p1" | "p2"
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
      setsWon: 0,
    },
    p2: {
      label: isDoubles ? "Team B" : "Player Two",
      name: isDoubles ? p2Members.join(" / ") : p2Members[0],
      members: p2Members,
      color: color2,
      setPts: 0,
      setsWon: 0,
    },
    history: [],              // rows of board results (also set dividers)
    stack: [],                // undo snapshots
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

// Save all matches blob to localStorage, scoped by community.
function persistAll(matches, activeId, communityId) {
  if (!communityId) return;
  try {
    localStorage.setItem(storageKeyForCommunity(STORAGE_KEY, communityId), JSON.stringify(matches));
    if (activeId) localStorage.setItem(storageKeyForCommunity(ACTIVE_KEY, communityId), activeId);
    else localStorage.removeItem(storageKeyForCommunity(ACTIVE_KEY, communityId));
  } catch (e) { console.warn("Persist error:", e); }
}

function loadAll(communityId) {
  if (!communityId) return { matches: [], activeId: null };
  try {
    const raw = localStorage.getItem(storageKeyForCommunity(STORAGE_KEY, communityId));
    const active = localStorage.getItem(storageKeyForCommunity(ACTIVE_KEY, communityId));
    const matches = raw ? JSON.parse(raw) : [];
    return {
      matches: matches.filter(m => !m.communityId || m.communityId === communityId).map(m => ({ ...m, communityId })),
      activeId: active,
    };
  } catch (e) {
    return { matches: [], activeId: null };
  }
}

// Exports
function downloadBlob(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

function exportJSON(match) {
  downloadBlob(`carrom-${(match.p1.name||"A")}-vs-${(match.p2.name||"B")}-${match.id}.json`,
               JSON.stringify(match, null, 2));
}

function exportCSV(match) {
  const rows = [["Set","Board","Winner","OppLeft","Queen","Pts","Set A","Set B","Time"]];
  (match.history || []).filter(h => h.kind === "board").forEach(h => {
    rows.push([h.set, h.board, h.winnerName, h.oppLeft, h.queen ? "Counted +3" : h.queenIgnored ? "Ignored" : "No",
               h.pts, h.setA, h.setB, new Date(h.at).toISOString()]);
  });
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(",")).join("\n");
  downloadBlob(`carrom-${(match.p1.name||"A")}-vs-${(match.p2.name||"B")}-${match.id}.csv`, csv, "text/csv");
}

// simple beep using WebAudio
let _audioCtx = null;
function ping(freq = 880, dur = 0.12, type = "sine", gain = 0.08) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
  } catch (e) { /* silent */ }
}
function chord(freqs, dur = 0.25) {
  freqs.forEach((f, i) => setTimeout(() => ping(f, dur, "triangle", 0.06), i * 80));
}

Object.assign(window, {
  LIMIT_POINTS, LIMIT_BOARDS, QUEEN_CUTOFF, MAX_SETS, SCORE_FORMATS, STORAGE_KEY, ACTIVE_KEY,
  uid, initials, fmtTime, fmtDate, clampInt,
  cleanName, safeTotalSets, setsNeeded, scoreRules,
  matchLimitPoints, matchLimitBoards, matchQueenCutoff, queenBonusCounts,
  defaultMatch, matchWinner,
  communityStorageSuffix, storageKeyForCommunity,
  persistAll, loadAll, exportJSON, exportCSV,
  ping, chord,
});
