// App root: community gate, player sign-in, scoreboard, leaderboard, admin

function AdminPanel({ open, onClose, session, community, isAdmin, setIsAdmin }) {
  const [pinInput, setPinInput] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const eligible = isAdminEligible(session);

  React.useEffect(() => {
    if (!open) { setPinInput(""); setErr(null); }
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
      if (!ok) { setErr("Wrong player PIN."); return; }
      setIsAdmin(true);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const stepDown = () => { setIsAdmin(false); onClose(); };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: "32px 28px" }}>
        {isAdmin ? (
          <>
            <div className="stinger">Community Admin</div>
            <h2 style={{ fontSize: 36 }}>Admin is <em>active.</em></h2>
            <p className="tip" style={{ margin: "10px 0 18px" }}>
              Active in {community?.name}. Admin mode stays on until you step down, sign out, or switch community.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Close</button>
              <button type="button" className="btn crimson" onClick={stepDown}>Step down</button>
            </div>
          </>
        ) : !eligible ? (
          <>
            <div className="stinger">Access Denied</div>
            <h2 style={{ fontSize: 32 }}>Not an <em>admin.</em></h2>
            <p className="tip" style={{ margin: "10px 0 18px", lineHeight: 1.5 }}>
              Ask a community owner to promote your player account to owner or admin in Supabase.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div className="stinger">Community Admin</div>
            <h2 style={{ fontSize: 36 }}>Confirm your <em>PIN.</em></h2>
            <p className="tip" style={{ margin: "10px 0 18px" }}>
              Signed in as <strong>{session?.name}</strong> in <strong>{community?.name}</strong>. Re-enter your player PIN to unlock edit/delete controls.
            </p>
            <input type="password" inputMode="numeric" value={pinInput}
                   autoFocus
                   onKeyDown={(e) => { if (e.key === "Enter") tryLogin(); }}
                   onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                   placeholder="PIN" className="drive-input"
                   style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.5em", fontSize: 20, textAlign: "center" }} />
            {err && <div className="drive-error">{err}</div>}
            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn primary" onClick={tryLogin} disabled={busy || pinInput.length < 4}>
                {busy ? "Checking..." : "Unlock"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [community, setCommunityState] = React.useState(() => getCommunitySession());
  const [session, setSessionState] = React.useState(() => getSession());
  const [view, setView] = React.useState("play"); // play | leaderboard
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState("idle");

  const {
    state, active,
    createMatch, closeMatch, setActive, updateMatch,
    upsertAndActivate, replaceMatch,
  } = useStore(community?.id);

  React.useEffect(() => {
    const current = getSession();
    if (!community || current?.communityId !== community.id) {
      setSessionState(null);
      setIsAdmin(false);
    }
  }, [community?.id]);

  // If you lose admin eligibility, strip admin status.
  React.useEffect(() => {
    if (!session || !isAdminEligible(session)) setIsAdmin(false);
  }, [session?.id, session?.role]);

  // Auto-sync: only the owner or an unlocked community admin pushes to cloud.
  React.useEffect(() => {
    if (!community || !session || !active) return;
    const canWrite = active.ownerId === session.id || isAdmin;
    if (!canWrite) return;
    scheduleSupabaseSync(active, session.id, {
      communityId: community.id,
      onStatus: (s) => setSyncStatus(s),
    });
  }, [active && JSON.stringify(active), community?.id, session?.id, isAdmin]);

  // Spectator live-sync: if the active match is not writable locally, subscribe to its cloud row.
  React.useEffect(() => {
    if (!community || !session || !active) return;
    const canWrite = active.ownerId === session.id || isAdmin;
    if (canWrite) return;
    let off = null; let cancelled = false;
    (async () => {
      try {
        off = await subscribeToMatch(community.id, active.id, (payload) => {
          const row = payload.new || payload.record;
          if (!row || !row.data || row.community_id !== community.id) return;
          if (cancelled) return;
          replaceMatch({ ...row.data, communityId: community.id });
        });
      } catch (e) { console.warn("spectator subscribe failed:", e); }
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [active?.id, community?.id, session?.id, isAdmin]);

  // Community-wide listener: if an admin deletes a cloud match, remove any local copy.
  React.useEffect(() => {
    if (!community || !session) return;
    let off = null;
    (async () => {
      try {
        off = await subscribeMatches(community.id, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            if (id) closeMatch(id);
          }
        });
      } catch (e) { console.warn("community subscribe failed:", e); }
    })();
    return () => { if (off) off(); };
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
    return <>
      <div className="topbar">
        <div className="brand"><BrandMark /><div className="brand-name">Striker <em>/</em> Carrom</div></div>
        <button type="button" className="btn ghost sm" onClick={() => setHelpOpen(true)}>Help</button>
      </div>
      <CommunityEntry
        onCommunityReady={(c) => { setCommunityState(c); setSessionState(null); setView("play"); }}
        onCommunityAndPlayerReady={({ community, player }) => { setCommunityState(community); setSessionState(player); setView("play"); }}
        onHelp={() => setHelpOpen(true)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>;
  }

  if (!session) {
    return <>
      <div className="topbar">
        <div className="brand"><BrandMark /><div className="brand-name">Striker <em>/</em> Carrom</div></div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="chip" style={{ color: "var(--cream)" }}>{community.name}</span>
          <button type="button" className="btn ghost sm" onClick={() => setHelpOpen(true)}>Help</button>
          <button type="button" className="btn ghost sm" onClick={switchCommunity}>Switch community</button>
        </div>
      </div>
      <SignIn community={community} onSignedIn={(s) => {
        const nextCommunity = { ...community, role: s.role || community.role || "member" };
        setCommunitySession(nextCommunity);
        setCommunityState(nextCommunity);
        setSessionState(s);
      }} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>;
  }

  const startNew = () => setActive(null);
  const goHome = () => { setView("play"); setActive(null); };

  const onStartFromWelcome = (opts) => {
    const id = createMatch({ ...opts, communityId: community.id, ownerId: session.id, ownerName: session.name });
    updateMatch(id, m => ({ ...m, communityId: community.id, phase: "toss" }));
  };

  const onTossDone = (res) => {
    if (!active) return;
    updateMatch(active.id, m => ({
      ...m,
      communityId: community.id,
      phase: "live",
      startedAt: Date.now(),
      tossWinner: res.tossWinner,
      tossChoice: res.tossChoice,
      breakPlayer: res.breakPlayer,
      p1: { ...m.p1, color: res.p1Color || m.p1.color },
      p2: { ...m.p2, color: res.p2Color || m.p2.color },
    }));
  };

  const openFromCloud = (row) => {
    if (!row?.data || row.community_id !== community.id) return;
    upsertAndActivate({ ...row.data, communityId: community.id });
    setView("play");
  };

  const deleteFromCloud = async (row) => {
    if (!isAdmin || row.community_id !== community.id) return;
    if (!confirm(`Delete match "${row.p1_name} vs ${row.p2_name}"? This cannot be undone.`)) return;
    try {
      await deleteMatchById(community.id, row.id);
      closeMatch(row.id);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  const syncPill = (
    <span className={`drive-pill ${syncStatus === "synced" ? "ok" : syncStatus === "syncing" ? "syncing" : syncStatus === "error" ? "err" : "off"}`}>
      <span className="drive-ico">o</span>
      {syncStatus === "syncing" ? "Syncing..." : syncStatus === "synced" ? "Cloud synced" : syncStatus === "error" ? "Sync error" : "Cloud"}
    </span>
  );

  const showAdminButton = isAdminEligible(session);

  return (
    <>
      <div className="topbar">
        <div className="brand" style={{ cursor: "pointer" }} onClick={goHome}>
          <BrandMark />
          <div className="brand-name">Striker <em>/</em> Carrom</div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="chip" style={{ color: "var(--cream)" }}>{community.name}</span>
          <button type="button" className={`tab ${view === "play" ? "active" : ""}`} onClick={() => setView("play")}>Play</button>
          <button type="button" className={`tab ${view === "leaderboard" ? "active" : ""}`} onClick={() => setView("leaderboard")}>Leaderboard</button>
          {syncPill}
          <button type="button" className="btn ghost sm" onClick={() => setHelpOpen(true)}>Help</button>
          <span className="chip hide-sm" style={{ color: "var(--cream)" }}>
            <span style={{ color: "var(--gold)" }}>o</span> {session.name}
          </span>
          {showAdminButton && (
            !isAdmin
              ? <button type="button" className="btn ghost sm" onClick={() => setAdminOpen(true)}>Admin</button>
              : <span className="chip break" onClick={() => setAdminOpen(true)} style={{ cursor: "pointer" }}>Admin</span>
          )}
          <button type="button" className="btn ghost sm" onClick={startNew}>+ New</button>
          <button type="button" className="btn ghost sm" onClick={() => { signOut(); setSessionState(null); setIsAdmin(false); }}>Sign out</button>
          <button type="button" className="btn ghost sm" onClick={switchCommunity}>Switch community</button>
        </div>
      </div>

      {state.matches.length > 0 && view === "play" && (
        <div className="tab-row">
          {state.matches.map(m => {
            const label = `${m.p1.name || "A"} vs ${m.p2.name || "B"}`;
            const isActive = m.id === state.activeId;
            const isMine = m.ownerId === session.id;
            return (
              <div key={m.id} className={`tab ${isActive ? "active" : ""}`}
                   onClick={() => setActive(m.id)} role="button"
                   title={m.ownerName ? `Started by ${m.ownerName}` : ""}>
                <span>{label}{!isMine && m.ownerName ? ` / ${m.ownerName}` : ""}</span>
                <span style={{ opacity: .6 }} className="mono">{m.p1.setsWon}-{m.p2.setsWon}</span>
                <button type="button" className="close" onClick={(e) => { e.stopPropagation();
                  if (confirm(`Close ${label} locally? Cloud copy stays.`)) closeMatch(m.id); }}>x</button>
              </div>
            );
          })}
          <button type="button" className="tab" onClick={() => setActive(null)}>+ New</button>
        </div>
      )}

      {view === "leaderboard" && (
        <Leaderboard community={community}
                     session={session}
                     isAdmin={isAdmin}
                     onOpenMatch={openFromCloud}
                     onDelete={deleteFromCloud} />
      )}

      {view === "play" && !active && <Welcome onStart={onStartFromWelcome} onHelp={() => setHelpOpen(true)} />}
      {view === "play" && active?.phase === "toss" && <Toss match={active} onDone={onTossDone} />}
      {view === "play" && active && (active.phase === "live" || active.phase === "over") && (
        <Scoreboard match={active}
          session={session}
          isAdmin={isAdmin}
          onUpdate={(u) => updateMatch(active.id, u)}
          onClose={() => { if (confirm("Close this match locally? Cloud copy stays.")) closeMatch(active.id); }} />
      )}
      {view === "play" && active?.phase === "setup" && <Welcome onStart={onStartFromWelcome} onHelp={() => setHelpOpen(true)} />}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)}
                  session={session}
                  community={community}
                  isAdmin={isAdmin} setIsAdmin={setIsAdmin} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
