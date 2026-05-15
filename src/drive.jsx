// Google Drive sync (per-user OAuth via Google Identity Services + Drive API v3)
//
// Flow:
//  1. User pastes their OAuth Client ID (stored in localStorage)
//  2. User clicks "Connect Google" -> GIS token client pops up consent
//  3. App gets an access token, creates/uses a folder "Striker Carrom Scores"
//  4. On every match change, we debounce-upload a JSON file per match
//     (filename: "match-<id>.json") via multipart upload
//  5. CSV history is also uploaded alongside, one per match
//
// Scope: drive.file  -> app only sees files it created. Users stay in control.

const DRIVE_CLIENT_KEY = "striker.drive.clientId";
const DRIVE_TOKEN_KEY  = "striker.drive.token";
const DRIVE_FOLDER_KEY = "striker.drive.folderId";
const DRIVE_FILEMAP_KEY = "striker.drive.fileMap"; // { [matchId]: { jsonId, csvId } }

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
          _gisReady = true; clearInterval(check); resolve();
        }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.id = "gis-script";
    s.onload = () => { _gisReady = true; resolve(); };
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
  } catch { return null; }
}
function storeToken(token) {
  localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify(token));
}
function clearToken() {
  localStorage.removeItem(DRIVE_TOKEN_KEY);
}

async function requestAccessToken({ clientId, interactive = true }) {
  await loadGIS();
  return new Promise((resolve, reject) => {
    try {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        prompt: interactive ? "" : "none",
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          const token = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + (resp.expires_in * 1000),
          };
          storeToken(token);
          resolve(token);
        },
      });
      _tokenClient.requestAccessToken();
    } catch (e) { reject(e); }
  });
}

async function driveFetch(path, opts = {}, token) {
  const t = token || getStoredToken();
  if (!t) throw new Error("Not signed in");
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { clearToken(); throw new Error("Token expired"); }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}

async function ensureFolder() {
  let folderId = localStorage.getItem(DRIVE_FOLDER_KEY);
  if (folderId) {
    // Verify it still exists
    try {
      await driveFetch(`/drive/v3/files/${folderId}?fields=id,trashed`);
      return folderId;
    } catch { folderId = null; localStorage.removeItem(DRIVE_FOLDER_KEY); }
  }
  // Search for existing
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const search = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)`);
  const data = await search.json();
  if (data.files && data.files[0]) {
    localStorage.setItem(DRIVE_FOLDER_KEY, data.files[0].id);
    return data.files[0].id;
  }
  // Create
  const create = await driveFetch(`/drive/v3/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const folder = await create.json();
  localStorage.setItem(DRIVE_FOLDER_KEY, folder.id);
  return folder.id;
}

function getFileMap() {
  try { return JSON.parse(localStorage.getItem(DRIVE_FILEMAP_KEY) || "{}"); } catch { return {}; }
}
function setFileMap(m) { localStorage.setItem(DRIVE_FILEMAP_KEY, JSON.stringify(m)); }

async function uploadOrUpdate({ existingId, name, mimeType, content, parentId }) {
  const boundary = "strikerboundary" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;

  const metadata = existingId
    ? { name, mimeType }
    : { name, mimeType, parents: [parentId] };

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    close;

  const url = existingId
    ? `/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : `/upload/drive/v3/files?uploadType=multipart`;

  const res = await driveFetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

function matchToCSV(match) {
  const rows = [["Set","Board","Winner","OppLeft","Queen","Pts","Set A","Set B","Time"]];
  (match.history || []).filter(h => h.kind === "board").forEach(h => {
    rows.push([h.set, h.board, h.winnerName, h.oppLeft, h.queen ? "Counted +3" : h.queenIgnored ? "Ignored" : "No",
               h.pts, h.setA, h.setB, new Date(h.at).toISOString()]);
  });
  return rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(",")).join("\n");
}

async function syncMatch(match) {
  const folderId = await ensureFolder();
  const map = getFileMap();
  const existing = map[match.id] || {};
  const baseName = `${(match.p1.name||"A").replace(/[\\\/:\*\?"<>\|]/g,"")}-vs-${(match.p2.name||"B").replace(/[\\\/:\*\?"<>\|]/g,"")}-${match.id}`;

  // JSON (the source of truth)
  const jsonRes = await uploadOrUpdate({
    existingId: existing.jsonId,
    name: `${baseName}.json`,
    mimeType: "application/json",
    content: JSON.stringify(match, null, 2),
    parentId: folderId,
  });
  // CSV
  const csvRes = await uploadOrUpdate({
    existingId: existing.csvId,
    name: `${baseName}.csv`,
    mimeType: "text/csv",
    content: matchToCSV(match),
    parentId: folderId,
  });

  map[match.id] = { jsonId: jsonRes.id, csvId: csvRes.id };
  setFileMap(map);
  return { json: jsonRes, csv: csvRes };
}

// -------- Debounced per-match syncer --------
const _timers = new Map();
const _lastPayload = new Map();

function scheduleSync(match, opts = {}) {
  const { delay = 2000, onStatus } = opts;
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
  DRIVE_CLIENT_KEY, DRIVE_TOKEN_KEY, DRIVE_FOLDER_KEY, DRIVE_FILEMAP_KEY,
  loadGIS, requestAccessToken, getStoredToken, clearToken,
  ensureFolder, syncMatch, scheduleSync,
});
