// Community gate: join an existing club or create a new one before player sign-in.

function CommunityEntry({ onCommunityReady, onCommunityAndPlayerReady, onHelp }) {
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

  const join = async (e) => {
    e.preventDefault();
    if (!joinCode.trim() || joinPin.length !== 4) return;
    setBusy(true); setErr(null);
    try {
      const community = await verifyCommunityPin(joinCode, joinPin);
      onCommunityReady && onCommunityReady(community);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim() || communityPin.length !== 4 || !creatorName.trim() || creatorPin.length < 4) return;
    setBusy(true); setErr(null);
    try {
      const result = await createCommunity({
        name: createName,
        slug: createSlug,
        pin: communityPin,
        creatorName,
        creatorPin,
        description,
      });
      onCommunityAndPlayerReady && onCommunityAndPlayerReady(result);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-card" style={{ maxWidth: 760 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Community access</div>
        <h1 style={{ fontSize: "clamp(42px, 6vw, 76px)" }}>Enter your <em>club.</em></h1>
        <p className="lede">
          Matches, players, history, and leaderboards are private to the community you join.
        </p>

        <div className="option-row" style={{ marginBottom: 18 }}>
          <button type="button" className={`option-pill ${tab === "join" ? "active" : ""}`} onClick={() => { setTab("join"); setErr(null); }}>
            Join community
          </button>
          <button type="button" className={`option-pill ${tab === "create" ? "active" : ""}`} onClick={() => { setTab("create"); setErr(null); }}>
            Create community
          </button>
          {onHelp && (
            <button type="button" className="option-pill" onClick={onHelp}>
              Help
            </button>
          )}
        </div>

        {tab === "join" ? (
          <form onSubmit={join}>
            <div style={{ display: "grid", gap: 14 }}>
              <div className="name-field">
                <div className="eyebrow">Community name or code</div>
                <input autoFocus placeholder={DEFAULT_COMMUNITY_NAME}
                       value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={80} />
                <div className="tip" style={{ marginTop: 8 }}>
                  Default: {DEFAULT_COMMUNITY_NAME} ({DEFAULT_COMMUNITY_SLUG})
                </div>
              </div>
              <div className="name-field">
                <div className="eyebrow">4-digit community PIN</div>
                <input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="PIN"
                       value={joinPin} onChange={e => setJoinPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                       style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.35em" }} />
              </div>
            </div>

            {err && <div className="drive-error" style={{ marginTop: 12 }}>{err}</div>}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 18, flexWrap: "wrap", gap: 12 }}>
              <div className="tip">The community PIN is checked through Supabase and is not shown in the UI.</div>
              <button type="submit" className="btn primary" disabled={busy || !joinCode.trim() || joinPin.length !== 4}>
                {busy ? "Checking..." : "Join"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={create}>
            <div style={{ display: "grid", gap: 14 }}>
              <div className="name-field">
                <div className="eyebrow">Community name</div>
                <input autoFocus placeholder="e.g. Hostel Carrom League"
                       value={createName} onChange={e => setCreateName(e.target.value)} maxLength={80} />
              </div>
              <div className="name-field">
                <div className="eyebrow">Community slug/code</div>
                <input placeholder="hostel-carrom-league"
                       value={createSlug}
                       onChange={e => { setSlugTouched(true); setCreateSlug(normalizeSlug(e.target.value)); }}
                       maxLength={64}
                       style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24 }} />
              </div>
              <div className="name-field">
                <div className="eyebrow">Optional public description</div>
                <input placeholder="Short note for members"
                       value={description} onChange={e => setDescription(e.target.value)} maxLength={160} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div className="name-field">
                  <div className="eyebrow">4-digit community PIN</div>
                  <input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="PIN"
                         value={communityPin}
                         onChange={e => setCommunityPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                         style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.35em" }} />
                </div>
                <div className="name-field">
                  <div className="eyebrow">Creator name</div>
                  <input placeholder="Your name"
                         value={creatorName} onChange={e => setCreatorName(e.target.value)} maxLength={24} />
                </div>
              </div>
              <div className="name-field">
                <div className="eyebrow">Creator player PIN</div>
                <input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="PIN"
                       value={creatorPin} onChange={e => setCreatorPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                       style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.35em" }} />
              </div>
            </div>

            {err && <div className="drive-error" style={{ marginTop: 12 }}>{err}</div>}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 18, flexWrap: "wrap", gap: 12 }}>
              <div className="tip">The creator becomes the community owner/admin.</div>
              <button type="submit" className="btn primary"
                      disabled={busy || !createName.trim() || !createSlug.trim() || communityPin.length !== 4 || !creatorName.trim() || creatorPin.length < 4}>
                {busy ? "Creating..." : "Create and enter"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { CommunityEntry });
