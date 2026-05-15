// Shared small components

const { useState, useEffect, useRef, useCallback, useMemo } = React;

function BrandMark({ size = 34 }) {
  return <div className="brand-mark" style={{ width: size, height: size }} />;
}

function Coin({ color = "white", size = 18 }) {
  return <div className={`coin-dot ${color === "Black" || color === "black" ? "black" : ""}`}
              style={{ width: size, height: size }} />;
}

function Avatar({ name, color }) {
  const cls = (color === "Black") ? "black" : "white";
  return <div className={`avatar ${cls}`} title={name}>{initials(name)}</div>;
}

function Chip({ children, variant }) {
  return <span className={`chip ${variant || ""}`}>{children}</span>;
}

function SetPips({ won, max = 2 }) {
  const pips = [];
  for (let i = 0; i < max; i++) pips.push(<span key={i} className={`pip ${i < won ? "won" : ""}`} />);
  return <div className="setpips" title={`${won} of ${max} sets won`}>{pips}</div>;
}

function Confetti({ trigger, onDone }) {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const colors = ["#c8a65a", "#f3e7cf", "#d94562", "#6b8e3d", "#fbf5e8", "#8e1f30"];
    const arr = Array.from({ length: 140 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 2.2 + Math.random() * 2,
      bg: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 14,
    }));
    setBits(arr);
    const t = setTimeout(() => { setBits([]); onDone && onDone(); }, 4500);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!bits.length) return null;
  return (
    <div className="confetti">
      {bits.map(b => (
        <i key={b.id} style={{
          left: `${b.left}vw`,
          background: b.bg,
          width: b.w, height: b.h,
          transform: `rotate(${b.rot}deg)`,
          animationDuration: `${b.dur}s`,
          animationDelay: `${b.delay}s`,
        }} />
      ))}
    </div>
  );
}

function Modal({ open, onClose, children, className = "" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function HelpModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} className="help-modal">
      <div className="stinger">App Guide</div>
      <h2>How to use <em>Striker.</em></h2>
      <p className="help-intro">
        Use this app to run singles or doubles carrom matches, choose 1 or 3 sets, track every board, move between sets automatically, and keep a match history.
      </p>

      <div className="help-grid">
        <div className="help-step">
          <span className="help-num">1</span>
          <h3>Choose competitors</h3>
          <p>Select Singles for one name per side or Doubles for Team A and Team B with two names each. Coin color is decided after the toss.</p>
        </div>
        <div className="help-step">
          <span className="help-num">2</span>
          <h3>Choose match rules</h3>
          <p>Pick 1 set or 3 sets, then choose either 25 points / 8 boards or 15 points / 4 boards. A set ends when either limit is reached first.</p>
        </div>
        <div className="help-step">
          <span className="help-num">3</span>
          <h3>Toss and break</h3>
          <p>Flip the striker. The toss winner chooses either Break first or Choose your side. Break first automatically means White coins.</p>
        </div>
        <div className="help-step">
          <span className="help-num">4</span>
          <h3>Choose side</h3>
          <p>If the toss winner chooses a side instead of breaking, they pick White or Black and the opponent breaks first.</p>
        </div>
        <div className="help-step">
          <span className="help-num">5</span>
          <h3>Enter points</h3>
          <p>After each board, enter how many coins the losing player has left, turn Queen on only if covered, then tap the board winner.</p>
        </div>
        <div className="help-step">
          <span className="help-num">6</span>
          <h3>Scoring rule</h3>
          <p>The app adds the losing player's coins left as points. Queen +3 counts until the winner already has 22+ points in 25-point games or 11+ points in 15-point games before that board.</p>
        </div>
        <div className="help-step">
          <span className="help-num">7</span>
          <h3>Sets and match</h3>
          <p>In a 1-set match, the first set winner wins the match. In a 3-set match, first to 2 sets wins the match.</p>
        </div>
      </div>

      <div className="help-note">
        Use Undo if you enter a board wrongly. Reset Set removes only the current set's boards. Reset Match keeps names and colors but starts scoring again. Export JSON or CSV from the match screen when you need a saved copy.
      </div>

      <div className="modal-actions" style={{ marginTop: 22 }}>
        <button className="btn primary" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  );
}

// Topbar shared
function TopBar({ onNew, onHome, driveSlot }) {
  return (
    <div className="topbar">
      <div className="brand" style={{ cursor: "pointer" }} onClick={onHome}>
        <BrandMark />
        <div className="brand-name">Striker <em>/</em> Carrom</div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {driveSlot}
        <button className="btn ghost sm" onClick={onNew}>+ New Match</button>
      </div>
    </div>
  );
}

Object.assign(window, { BrandMark, Coin, Avatar, Chip, SetPips, Confetti, Modal, HelpModal, TopBar });
