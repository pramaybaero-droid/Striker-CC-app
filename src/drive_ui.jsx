// Drive connection UI - small floating panel

function DrivePanel({ active, matches }) {
  const [clientId, setClientId] = React.useState(() => localStorage.getItem(DRIVE_CLIENT_KEY) || "");
  const [connected, setConnected] = React.useState(() => !!getStoredToken());
  const [status, setStatus] = React.useState("idle"); // idle | syncing | synced | error
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
      },
    });
  }, [active && JSON.stringify(active), connected]);

  const connect = async () => {
    try {
      setError(null);
      if (!clientId) {
        setError("Paste your OAuth Client ID first.");
        return;
      }
      await requestAccessToken({ clientId: clientId.trim() });
      setConnected(true);
      for (const m of matches) {
        scheduleSync(m, { delay: 200, onStatus: setStatus });
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
    if (folderId) window.open(`https://drive.google.com/drive/folders/${folderId}`, "_blank");
    else window.open("https://drive.google.com/drive/my-drive", "_blank");
  };

  const pill = connected
    ? (status === "syncing" ? { txt: "Syncing...", cls: "syncing" }
      : status === "error" ? { txt: "Sync error", cls: "err" }
      : { txt: "Synced to Drive", cls: "ok" })
    : { txt: "Drive off", cls: "off" };

  return (
    <>
      <button className={`drive-pill ${pill.cls}`} onClick={() => setOpen(o => !o)} title="Google Drive sync">
        <span className="drive-ico" aria-hidden>Drive</span>
        <span>{pill.txt}</span>
      </button>

      {open && (
        <div className="drive-panel">
          <div className="panel-head" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 22 }}>Google Drive sync</h3>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Close</button>
          </div>

          {!connected ? (
            <>
              <p className="tip" style={{ marginBottom: 10 }}>
                Paste your OAuth <strong>Client ID</strong> (Web application type). Scores auto-upload to a folder called <em>Striker Carrom Scores</em> in your Drive.
              </p>
              <label className="eyebrow">OAuth Client ID</label>
              <input className="drive-input" placeholder="xxxxxxxx.apps.googleusercontent.com"
                     value={clientId} onChange={e => setClientId(e.target.value)} />
              <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" onClick={connect} disabled={!clientId}>Connect Google</button>
                <a className="btn ghost sm" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Get a Client ID</a>
              </div>
              <details style={{ marginTop: 16 }}>
                <summary className="tip" style={{ cursor: "pointer" }}>Setup steps</summary>
                <ol className="tip" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
                  <li>Google Cloud / APIs and Services / Enable <strong>Google Drive API</strong></li>
                  <li>Credentials / Create OAuth client ID / <strong>Web application</strong></li>
                  <li>Add this page's URL as Authorized JavaScript origin</li>
                  <li>Copy the Client ID and paste it above</li>
                </ol>
              </details>
            </>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                <span className={`sync-status ${pill.cls}`}>o</span>
                <span style={{ fontSize: 13 }}>
                  {status === "syncing" ? "Uploading changes to your Drive..."
                    : status === "error" ? "Last sync failed - click retry"
                    : "Every score change auto-saves to your Drive."}
                </span>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary sm" onClick={syncNow} disabled={!active}>Sync now</button>
                <button className="btn ghost sm" onClick={openFolder}>Open folder</button>
                <button className="btn ghost sm" onClick={disconnect}>Disconnect</button>
              </div>
            </>
          )}

          {error && (
            <div className="drive-error">{error}</div>
          )}
        </div>
      )}
    </>
  );
}

Object.assign(window, { DrivePanel });
