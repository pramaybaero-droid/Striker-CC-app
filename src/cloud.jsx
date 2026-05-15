// Supabase client + community access + player PIN auth + match sync

const SUPABASE_URL = "https://csdrlzvkwtkpjfjzglsl.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZHJsenZrd3RrcGpmanpnbHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTY1NjQsImV4cCI6MjA5MjMzMjU2NH0.0_QrLivfuNpDcIm0p4bOsFAbFUKDTgQD-amQOPFFkas";

const COMMUNITY_SESSION_KEY = "striker.community.session.v1";
const PLAYER_SESSION_KEY = "striker.player.session.v2";
const SESSION_KEY = PLAYER_SESSION_KEY; // Backward-compatible alias for older UI code.

const DEFAULT_COMMUNITY_NAME = "IISc Carrom Club";
const DEFAULT_COMMUNITY_SLUG = "iisc-carrom-club";

// Lazy-load supabase-js
let _sbReady = null;
function getSupabase() {
  if (_sbReady) return _sbReady;
  _sbReady = new Promise((resolve, reject) => {
    if (window.supabase?.createClient) {
      resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
      return;
    }
    const sources = [
      "dist/supabase.min.js",
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
    ];
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

    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
      throw new Error(
        "Supabase Anonymous Auth is required for community RLS. Enable Authentication > Sign In / Providers > Anonymous in Supabase, then reload. " +
        error.message
      );
    }
    return data.user;
  })().catch((e) => {
    _authReady = null;
    throw e;
  });
  return _authReady;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
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
  try { return JSON.parse(localStorage.getItem(COMMUNITY_SESSION_KEY) || "null"); }
  catch { return null; }
}

function setCommunitySession(session) {
  if (session) localStorage.setItem(COMMUNITY_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(COMMUNITY_SESSION_KEY);
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
  if (session) localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(PLAYER_SESSION_KEY);
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
    description: row.description || "",
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
    communitySlug: community?.slug,
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
  const { data, error } = await sb.rpc("join_community_with_pin", {
    p_slug: communitySlug,
    p_pin_hash: pinHash,
  });
  if (error) throw new Error(friendlySupabaseError(error));

  const community = mapCommunity(rpcRow(data));
  if (!community?.id) throw new Error("Community not found or wrong PIN.");
  setCommunitySession(community);
  signOut();
  return community;
}

async function createCommunity({ name, slug, pin, creatorName, creatorPin, description = "" }) {
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

  const { data, error } = await sb.rpc("create_community_with_owner", {
    p_id: communityId,
    p_name: cleanName,
    p_slug: cleanSlug,
    p_pin_hash: communityPinHash,
    p_description: normalizeName(description) || null,
    p_creator_name: cleanCreator,
    p_creator_pin_hash: creatorPinHash,
  });
  if (error) throw new Error(friendlySupabaseError(error));

  const row = rpcRow(data);
  const community = mapCommunity({
    id: row.community_id,
    name: row.community_name,
    slug: row.community_slug,
    description: row.description,
    role: row.role,
  });
  const player = mapPlayer({
    id: row.player_id,
    name: row.player_name,
    role: row.role,
    community_id: row.community_id,
  }, community);

  setCommunitySession(community);
  setSession(player);
  return { community, player };
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
  const { data, error } = await sb.rpc("sign_in_or_register_player", {
    p_community_id: communityId,
    p_name: cleanName,
    p_pin_hash: pinHash,
  });
  if (error) throw new Error(friendlySupabaseError(error));

  const row = rpcRow(data);
  const player = mapPlayer(row, community);
  if (!player?.id) throw new Error("Could not sign in.");

  const nextCommunity = { ...community, role: player.role || community.role || "member" };
  setCommunitySession(nextCommunity);
  setSession(player);
  return player;
}

// Legacy name kept so older references fail safe inside the active community.
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
    const { data, error } = await sb.rpc("verify_player_pin", {
      p_community_id: communityId,
      p_player_id: playerId,
      p_pin_hash: pinHash,
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

// ---------- Match sync ----------

function requireCommunityId(communityId) {
  const cid = communityId || getCommunitySession()?.id;
  if (!cid) throw new Error("Choose a community first.");
  return cid;
}

function matchToRow(match, ownerId, communityId) {
  const cid = requireCommunityId(communityId || match.communityId);
  const cleanMatch = { ...match, communityId: cid };
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
    updated_at: new Date().toISOString(),
  };
}

const _sbTimers = new Map();
const _sbLast = new Map();
function scheduleSupabaseSync(match, ownerId, opts = {}) {
  const { delay = 1200, onStatus, communityId } = opts;
  const cid = requireCommunityId(communityId || match.communityId);
  const snap = JSON.stringify({ communityId: cid, match });
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
      const { error } = await sb.from("matches").upsert(row, { onConflict: "id" });
      if (error) throw error;
      onStatus && onStatus("synced");
    } catch (e) {
      console.warn("Supabase sync failed:", e);
      onStatus && onStatus("error", friendlySupabaseError(e));
    }
  }, delay);
  _sbTimers.set(match.id, t);
}

async function fetchAllMatches({ communityId, limit = 200 } = {}) {
  const cid = requireCommunityId(communityId);
  await ensureSupabaseAuth();
  const sb = await getSupabase();
  const { data, error } = await sb.from("matches")
    .select("*")
    .eq("community_id", cid)
    .order("updated_at", { ascending: false })
    .limit(limit);
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
  const { data, error } = await sb.from("matches")
    .select("*")
    .eq("community_id", cid)
    .eq("id", id)
    .maybeSingle();
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
  const { error } = await sb.from("matches")
    .delete()
    .eq("community_id", cid)
    .eq("id", id);
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
  const ch = sb.channel(`matches-live-${cid}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `community_id=eq.${cid}` },
      (payload) => onChange(payload))
    .subscribe();
  return () => { sb.removeChannel(ch); };
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
  const ch = sb.channel(`match-${cid}-${matchId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      (payload) => {
        const row = payload.new || payload.old || payload.record;
        if (row?.community_id && row.community_id !== cid) return;
        onChange(payload);
      })
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

Object.assign(window, {
  SUPABASE_URL, SUPABASE_ANON,
  COMMUNITY_SESSION_KEY, PLAYER_SESSION_KEY, SESSION_KEY,
  DEFAULT_COMMUNITY_NAME, DEFAULT_COMMUNITY_SLUG,
  getSupabase, ensureSupabaseAuth,
  normalizeSlug, hashCommunityPin, hashPlayerPin, hashAdminPin,
  getCommunitySession, setCommunitySession, clearCommunitySession,
  getSession, setSession, signOut, clearAllSessions,
  verifyCommunityPin, createCommunity,
  signInOrRegisterPlayer, signInOrRegister,
  verifyPlayerPin, adminConfigured, isAdminEligible, verifyAdminPin,
  scheduleSupabaseSync, fetchAllMatches, fetchMatchById, deleteMatchById,
  subscribeMatches, subscribeToMatch,
});
