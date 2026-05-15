// Leaderboard: overall W-L, head-to-head, recent feed, streaks, monthly

function Leaderboard({ community, session, onOpenMatch, isAdmin, onDelete }) {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [tab, setTab] = React.useState("overall"); // overall | feed | h2h | monthly
  const communityId = community?.id || session?.communityId;

  const load = async () => {
    if (!communityId) return;
    try { setRows(await fetchAllMatches({ communityId, limit: 500 })); }
    catch (e) { setErr(e.message); }
  };
  React.useEffect(() => { setRows(null); setErr(null); load(); }, [communityId]);
  React.useEffect(() => {
    let off;
    if (!communityId) return;
    (async () => { off = await subscribeMatches(communityId, () => load()); })();
    return () => { if (off) off(); };
  }, [communityId]);

  const stats = React.useMemo(() => computeStats(rows || []), [rows]);

  if (err) return <div className="shell"><div className="panel"><div className="drive-error">{err}</div></div></div>;
  if (!rows) return <div className="shell"><div className="panel"><div className="empty">Loading leaderboard...</div></div></div>;

  const finished = rows.filter(r => r.winner_name);

  return (
    <div className="shell">
      <div className="panel">
        <div className="panel-head">
          <h3>{community?.name || "Community"} leaderboard</h3>
          <div className="panel-actions">
            <button type="button" className={`btn ghost sm ${tab==="overall"?"":""}`} onClick={() => setTab("overall")}
              style={{ borderColor: tab==="overall"?"var(--gold)":undefined }}>Overall</button>
            <button type="button" className="btn ghost sm" onClick={() => setTab("feed")}
              style={{ borderColor: tab==="feed"?"var(--gold)":undefined }}>Recent</button>
            <button type="button" className="btn ghost sm" onClick={() => setTab("h2h")}
              style={{ borderColor: tab==="h2h"?"var(--gold)":undefined }}>Head-to-head</button>
            <button type="button" className="btn ghost sm" onClick={() => setTab("monthly")}
              style={{ borderColor: tab==="monthly"?"var(--gold)":undefined }}>Monthly</button>
          </div>
        </div>

        {tab === "overall" && <OverallTable stats={stats} />}
        {tab === "feed" && <RecentFeed rows={rows} onOpen={onOpenMatch} isAdmin={isAdmin} onDelete={onDelete} />}
        {tab === "h2h" && <HeadToHead stats={stats} />}
        {tab === "monthly" && <MonthlyStats rows={finished} />}
      </div>
    </div>
  );
}

function computeStats(rows) {
  const players = new Map(); // name -> { wins, losses, matches, setsWon, setsLost, bestStreak, currentStreak }
  const h2h = new Map();     // "A|B" -> { a, b, wins_a, wins_b, matches }
  const finished = rows.filter(r => r.winner_name);
  // Process in chronological order for streaks
  const chrono = [...finished].sort((a,b) => new Date(a.ended_at||a.updated_at) - new Date(b.ended_at||b.updated_at));

  const getP = (n) => {
    if (!players.has(n)) players.set(n, { name: n, wins: 0, losses: 0, matches: 0, setsWon: 0, setsLost: 0, currentStreak: 0, bestStreak: 0 });
    return players.get(n);
  };

  for (const r of chrono) {
    const a = getP(r.p1_name), b = getP(r.p2_name);
    a.matches++; b.matches++;
    a.setsWon += r.p1_sets_won; a.setsLost += r.p2_sets_won;
    b.setsWon += r.p2_sets_won; b.setsLost += r.p1_sets_won;
    if (r.winner_name === r.p1_name) {
      a.wins++; b.losses++;
      a.currentStreak = Math.max(1, a.currentStreak+1);
      b.currentStreak = 0;
    } else if (r.winner_name === r.p2_name) {
      b.wins++; a.losses++;
      b.currentStreak = Math.max(1, b.currentStreak+1);
      a.currentStreak = 0;
    }
    a.bestStreak = Math.max(a.bestStreak, a.currentStreak);
    b.bestStreak = Math.max(b.bestStreak, b.currentStreak);

    const [x, y] = [r.p1_name, r.p2_name].sort();
    const key = `${x}|${y}`;
    if (!h2h.has(key)) h2h.set(key, { a: x, b: y, wins_a: 0, wins_b: 0, matches: 0 });
    const rec = h2h.get(key);
    rec.matches++;
    if (r.winner_name === x) rec.wins_a++;
    else if (r.winner_name === y) rec.wins_b++;
  }

  return {
    players: Array.from(players.values()).sort((a,b) =>
      (b.wins - a.wins) || ((b.wins/Math.max(1,b.matches)) - (a.wins/Math.max(1,a.matches))) || b.matches - a.matches),
    h2h: Array.from(h2h.values()).sort((a,b) => b.matches - a.matches),
  };
}

function OverallTable({ stats }) {
  if (!stats.players.length) return <div className="empty">No completed matches yet - play some!</div>;
  return (
    <div style={{ overflow: "auto" }}>
      <table className="history-table">
        <thead>
          <tr>
            <th>#</th><th>Player</th><th>W</th><th>L</th><th>Matches</th>
            <th>Win %</th><th>Sets W-L</th><th>Best Streak</th><th>Current</th>
          </tr>
        </thead>
        <tbody>
          {stats.players.map((p, i) => (
            <tr key={p.name}>
              <td className="mono">{i+1}</td>
              <td><span className="winner-badge">{p.name}</span></td>
              <td className="mono" style={{ color: "var(--leaf)", fontWeight: 700 }}>{p.wins}</td>
              <td className="mono" style={{ color: "var(--queen)" }}>{p.losses}</td>
              <td className="mono">{p.matches}</td>
              <td className="mono">{p.matches ? Math.round(p.wins/p.matches*100) : 0}%</td>
              <td className="mono">{p.setsWon}-{p.setsLost}</td>
              <td className="mono" style={{ color: "var(--gold)" }}>{p.bestStreak}</td>
              <td className="mono">{p.currentStreak > 0 ? `${p.currentStreak} win streak` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentFeed({ rows, onOpen, isAdmin, onDelete }) {
  if (!rows.length) return <div className="empty">No matches yet.</div>;
  return (
    <div style={{ overflow: "auto" }}>
      <table className="history-table">
        <thead>
          <tr>
            <th>When</th><th>Match</th><th>Score</th><th>Winner</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="mono" style={{ color: "var(--muted)" }}>{fmtDate(r.updated_at)}</td>
              <td>{r.p1_name} vs {r.p2_name}</td>
              <td className="mono">{r.p1_sets_won} - {r.p2_sets_won}</td>
              <td>{r.winner_name ? <span className="winner-badge">{r.winner_name}</span> : "-"}</td>
              <td>
                <span className={`chip ${r.winner_name?"":""}`}
                      style={{ color: r.winner_name?"var(--gold)":"var(--muted)" }}>
                  {r.winner_name ? "Final" : r.phase}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <button type="button" className="btn ghost sm" onClick={() => onOpen && onOpen(r)}>Open</button>
                {isAdmin && (
                  <button type="button" className="btn ghost sm" style={{ marginLeft: 6, color: "var(--queen)" }}
                          onClick={() => onDelete && onDelete(r)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeadToHead({ stats }) {
  if (!stats.h2h.length) return <div className="empty">No head-to-head records yet.</div>;
  return (
    <div style={{ overflow: "auto" }}>
      <table className="history-table">
        <thead>
          <tr><th>Rivalry</th><th>Record</th><th>Matches</th><th>Edge</th></tr>
        </thead>
        <tbody>
          {stats.h2h.map(r => {
            const edge = r.wins_a === r.wins_b ? "Even"
              : r.wins_a > r.wins_b ? `${r.a} +${r.wins_a - r.wins_b}` : `${r.b} +${r.wins_b - r.wins_a}`;
            return (
              <tr key={`${r.a}|${r.b}`}>
                <td>{r.a} vs {r.b}</td>
                <td className="mono">{r.wins_a} - {r.wins_b}</td>
                <td className="mono">{r.matches}</td>
                <td><span className="winner-badge">{edge}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyStats({ rows }) {
  const byMonth = {};
  for (const r of rows) {
    const d = new Date(r.ended_at || r.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    byMonth[key] = byMonth[key] || { month: key, matches: 0, players: new Set(), topPlayer: {} };
    byMonth[key].matches++;
    byMonth[key].players.add(r.p1_name);
    byMonth[key].players.add(r.p2_name);
    if (r.winner_name) byMonth[key].topPlayer[r.winner_name] = (byMonth[key].topPlayer[r.winner_name] || 0) + 1;
  }
  const list = Object.values(byMonth).sort((a,b) => b.month.localeCompare(a.month));
  if (!list.length) return <div className="empty">No finished matches yet.</div>;
  return (
    <div style={{ overflow: "auto" }}>
      <table className="history-table">
        <thead>
          <tr><th>Month</th><th>Matches</th><th>Players</th><th>Top</th></tr>
        </thead>
        <tbody>
          {list.map(m => {
            const top = Object.entries(m.topPlayer).sort((a,b) => b[1]-a[1])[0];
            return (
              <tr key={m.month}>
                <td>{new Date(m.month+"-01").toLocaleDateString(undefined, { year: "numeric", month: "long" })}</td>
                <td className="mono">{m.matches}</td>
                <td className="mono">{m.players.size}</td>
                <td>{top ? <span className="winner-badge">{top[0]} - {top[1]}W</span> : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { Leaderboard });
