// Per-community player roster, persisted in localStorage.
// Used to power the player-name dropdown on the Welcome screen and the
// "Manage roster" modal that lets you pre-add names for a community.

const ROSTER_STORAGE_PREFIX = "striker.roster.v1.";
const DEFAULT_IISC_ROSTER = ["Subhasish", "Mrityunjoy", "Vimal", "Mayank", "Dhrutikam", "Pramay", "Vishali", "Akash", "Ashok", "Bipul"];

function rosterKey(communityId) {
  return ROSTER_STORAGE_PREFIX + (communityId || "global");
}

function saveRoster(communityId, names) {
  const seen = new Set();
  const clean = [];
  for (const raw of Array.isArray(names) ? names : []) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(v);
    if (clean.length >= 200) break;
  }
  try { localStorage.setItem(rosterKey(communityId), JSON.stringify(clean)); } catch {}
  return clean;
}

function getRoster(communityId, communitySlug) {
  try {
    const raw = localStorage.getItem(rosterKey(communityId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  if (communitySlug === DEFAULT_COMMUNITY_SLUG) {
    return saveRoster(communityId, DEFAULT_IISC_ROSTER);
  }
  return [];
}

function NameInput({ value, onChange, placeholder, autoFocus, roster, exclude }) {
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(-1);
  const wrapRef = React.useRef(null);

  const v = (value || "").trim();
  const exLower = (exclude || [])
    .filter(Boolean)
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s && s !== v.toLowerCase());
  const filter = v.toLowerCase();
  const matches = (roster || [])
    .filter(n => !exLower.includes(String(n).toLowerCase()))
    .filter(n => !filter || String(n).toLowerCase().includes(filter))
    .slice(0, 50);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (n) => { onChange(n); setOpen(false); setHi(-1); };
  const onKey = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(i => Math.min(matches.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && hi >= 0 && matches[hi]) { e.preventDefault(); choose(matches[hi]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const showList = open && matches.length > 0;

  return (
    <div ref={wrapRef} className="name-combo">
      <input
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value || ""}
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        maxLength={24}
        autoComplete="off"
        spellCheck={false}
      />
      {showList && (
        <div className="name-combo-dropdown">
          {matches.map((n, i) => (
            <button
              key={n + "_" + i}
              type="button"
              className={"name-combo-item" + (i === hi ? " hi" : "")}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => { e.preventDefault(); choose(n); }}
            >{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterManager({ open, onClose, communityId, communityName, communitySlug, onListChange }) {
  const [list, setList] = React.useState([]);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setList(getRoster(communityId, communitySlug));
    setDraft("");
  }, [open, communityId, communitySlug]);

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (list.some(x => x.toLowerCase() === v.toLowerCase())) { setDraft(""); return; }
    const next = saveRoster(communityId, [...list, v]);
    setList(next);
    onListChange && onListChange(next);
    setDraft("");
  };

  const remove = (name) => {
    const next = saveRoster(communityId, list.filter(x => x !== name));
    setList(next);
    onListChange && onListChange(next);
  };

  const seedDefault = () => {
    const next = saveRoster(communityId, [...new Set([...list, ...DEFAULT_IISC_ROSTER])]);
    setList(next);
    onListChange && onListChange(next);
  };

  return (
    <Modal open={open} onClose={onClose} className="roster-modal help-modal">
      <div className="stinger">Player roster</div>
      <h2>Players in <em>{communityName || "your community"}</em></h2>
      <p className="help-intro">
        Names listed here appear as dropdown suggestions when you start a match.
        The list is saved on this device only — share it by entering names here on each phone.
      </p>
      <div className="roster-add">
        <input
          autoFocus
          placeholder="Add a player name..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          maxLength={24}
        />
        <button type="button" className="btn primary sm" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      <div className="roster-list">
        {list.length === 0
          ? <div className="tip" style={{ padding: "12px 4px" }}>No players yet. Add names above, or load the default IISc roster below.</div>
          : list.map(n => (
              <div key={n} className="roster-row">
                <span className="roster-name">{n}</span>
                <button type="button" className="btn ghost sm" onClick={() => remove(n)}>Remove</button>
              </div>
            ))}
      </div>
      <div className="modal-actions" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="tip">{list.length} player{list.length === 1 ? "" : "s"}</div>
          {communitySlug === DEFAULT_COMMUNITY_SLUG && (
            <button type="button" className="btn ghost sm" onClick={seedDefault}>Load IISc defaults</button>
          )}
        </div>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

Object.assign(window, {
  ROSTER_STORAGE_PREFIX, DEFAULT_IISC_ROSTER, rosterKey,
  getRoster, saveRoster, NameInput, RosterManager,
});
