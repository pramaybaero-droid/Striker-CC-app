# Striker Carrom - Complete Setup Guide

This guide walks you end-to-end through getting the app running with a working
default community PIN and full admin powers.

---

## 1. Supabase one-time setup

### 1a. Create / open a Supabase project
1. Go to https://supabase.com and sign in.
2. Create a new project (or pick the existing one used in `dist/supabase.min.js`
   / `index.html` — the `SUPABASE_URL` constant is `https://csdrlzvkwtkpjfjzglsl.supabase.co`).
   If you use your own project, replace both `SUPABASE_URL` and `SUPABASE_ANON`
   in **two places**: inside `index.html` (search for `SUPABASE_URL =`) and
   inside `claim-owner.html`.

### 1b. Enable Anonymous Auth
1. Supabase dashboard → **Authentication → Sign In / Providers**.
2. Turn **Anonymous Sign-Ins** ON. Save.

   The app uses anonymous auth so Row Level Security policies can attach
   community memberships to the browser session.

### 1c. Run the schema SQL
1. Supabase dashboard → **SQL Editor → New query**.
2. Paste the **entire** contents of `supabase-community-schema.sql`.
3. Click **Run**.

   The schema is idempotent — you can run it more than once.
   At the bottom it calls `setup_default_iisc_community('1234')`, which
   **creates the default `IISc Carrom Club` community with PIN `1234`**.

   To use a different default PIN: edit the literal `'1234'` near the bottom of
   `supabase-community-schema.sql` before running, OR run this afterwards:
   ```sql
   select * from public.setup_default_iisc_community('YOUR_PIN');
   ```

That's the entire database setup. You should now see three communities/players/
matches tables plus several RPC functions.

---

## 2. Run the app

This is a static browser app. No npm/Vite/build required.

**Windows**: double-click `start_localhost.bat`, then open
`http://localhost:8080`.

**Mac/Linux/PowerShell**:
```bash
cd "Carrom_app"
python -m http.server 8080
```
Then open `http://localhost:8080`.

If port 8080 is busy, use `python -m http.server 8001` and visit `:8001`.

If you see a stale page from a previous deploy, open
`http://localhost:8080/clear-cache.html` once and reload.

---

## 3. Join the default IISc community

1. App home → **Join community** tab (default).
2. Community name/code: leave as `iisc-carrom-club`.
3. PIN: `1234` (or whatever you set in step 1c).
4. Click **Join**.

You're now inside the IISc community. The next screen is player sign-in.

---

## 4. Create your player

1. **Your name**: e.g. `Raj`. This name is unique inside the community.
2. **PIN**: 4–6 digits. You'll re-enter this PIN to unlock Admin mode later.
3. Click **Enter**.

You'll land on the home screen with `+ New`, `Play`, `Leaderboard` tabs.
At this point your role is `member`. Admin and edit controls are hidden.

---

## 5. Become the community owner / admin

There are two ways. Pick **A** if it's a fresh community (no owner yet) — this
is the case immediately after step 1c. Pick **B** any other time.

### Option A — Claim ownership from the browser (recommended)

1. Make sure you've already completed step 4 (your player must exist).
2. Open `http://localhost:8080/claim-owner.html`.
3. Fill in:
   - Community slug: `iisc-carrom-club`
   - Community PIN: `1234`
   - Your player name: exactly the name you signed in with in step 4.
4. Click **Claim ownership**.
   On success it says `Success: <name> is now owner.`
5. Go back to the app, **Sign out**, then **sign back in** with the same name +
   PIN. The app re-reads your role.
6. The **Admin** button now appears in the top bar.

> Claim ownership only works while the community has zero owners. After someone
> claims, future admins must be promoted by an existing owner (option B).

### Option B — Promote via Supabase SQL

In the Supabase SQL editor:
```sql
update public.players
set role = 'owner'
where community_id = (select id from public.communities where slug = 'iisc-carrom-club')
  and lower(name) = lower('Your Player Name');
```
(or `'admin'` for a non-owner admin.) Then sign out and back in.

### Option C — Existing owner promotes someone via SQL
Same UPDATE statement, just by an owner running it. A future build can wire
`set_player_role` (already provided in the schema) to a UI button.

---

## 6. Unlock Admin mode in the app

1. Top bar → **Admin** button.
2. Re-enter your **player PIN** (same one you used at sign-in).
3. Click **Unlock**.

You now see Admin controls inside every match:

- **Rollback last set** — undo the most recent completed set.
- **Force-end current set** — finalize whoever is ahead.
- **Re-open match** — flip a finished match back to live for edits.
- **Admin match rules** panel — edit:
  - Total sets / Sets to win
  - Points per set
  - Boards per set
  - Queen cutoff
  - Current set number / Current board number

Admin also enables **Delete** on rows of the Leaderboard → Recent feed.

Admin mode stays on until you tap **Step down**, sign out, or switch community.

---

## 7. Creating additional communities

1. App home → **Create community** tab.
2. Fill in name, slug (auto-derived), community PIN (4 digits), creator name,
   creator PIN.
3. Click **Create and enter**.

The creator is automatically the `owner` of that new community — no SQL or
Claim Ownership step needed.

---

## 8. Day-to-day match flow

1. `+ New` → enter player names → pick sets (1 or 3) → pick scoring rule.
2. Toss the striker, winner picks Break or Side.
3. After each board: opponent coins left + queen toggle → award to winner.
4. Set ends automatically when points or board limit hit.
5. Match ends when sets-to-win is reached.

Owner of the match has full control. Other community members watch live
(read-only). Community admins/owners can edit anyone's match.

---

## 9. Troubleshooting

**"Community not found or wrong PIN"** — schema not installed, or PIN wrong.
Re-run step 1c.

**"Supabase Anonymous Auth is required"** — step 1b not done.

**Admin button doesn't appear** — your `players.role` is still `member`.
Run step 5, then sign out + sign back in.

**Old version showing** — open `clear-cache.html` once, then reload.

**Sync error pill** — usually transient. If persistent, open browser devtools →
Console for the underlying message.

---

## 10. Files in this folder

| File | What it is |
|---|---|
| `index.html` | The app (self-contained, inlines React/ReactDOM/Supabase/bundle). |
| `dist/*` | Same scripts as separate files, for fallback. |
| `src/*.jsx` | Source files (already compiled into `index.html`). |
| `supabase-community-schema.sql` | One-time DB schema + default community seed. |
| `claim-owner.html` | One-time tool to promote yourself to owner. |
| `admin-setup.html` | Generates manual SQL if you'd rather not auto-seed. |
| `clear-cache.html` | Unregister service workers + clear caches. |
| `start_localhost.bat` | Windows shortcut to `python -m http.server 8080`. |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA shell. |
