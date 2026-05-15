# Striker - Carrom Scoreboard

A static browser-based scoreboard for singles and doubles carrom matches with Supabase sync, spectator viewing, match history, owner/admin editing, and community-isolated leaderboards.

The deployed `index.html` is self-contained: React, ReactDOM, Supabase JS, and the compiled app bundle are inlined so the app can still start even if a manual Netlify deploy accidentally omits the `dist/` folder. The `dist/` files are still included for maintainability and fallback.

## Community flow

Users must join or create a community before player sign-in.

- Default community: `IISc Carrom Club`
- Default slug/code: `iisc-carrom-club`
- Access: 4-digit community PIN
- Player accounts are scoped by `(community_id, lower(name))`
- Matches, history, stats, and leaderboards are always filtered by `community_id`

After joining a community, users sign in with a community-local player name and PIN. The same player name can exist in different communities.

## Supabase setup

1. In Supabase, enable **Authentication > Sign In / Providers > Anonymous**.
2. Open the Supabase SQL editor.
3. Run `supabase-community-schema.sql`.
4. Create the default IISc community by running:

   ```sql
   select * from public.setup_default_iisc_community('1234');
   ```

   Replace `1234` with the private IISc community PIN. The plain PIN is not stored in source or tables; only a salted SHA-256 hash is stored.

5. Open `index.html` from a static host or local server.

For a fresh Supabase project, the SQL creates:

- `communities`
- `players`
- `matches`
- `community_memberships`
- RPC functions for joining communities and signing in players without exposing PIN hashes
- RLS policies that restrict direct `matches` access to authenticated members of the active community

For an older installation with global rows, the SQL leaves rows with missing `community_id` inaccessible until you intentionally backfill or delete them. This avoids silently mixing old global data into IISc or another club.

## Creating communities

Use the app's **Create community** tab. The creator enters:

- community name
- slug/code
- 4-digit community PIN
- creator display name
- creator player PIN
- optional description

The creator becomes the first `owner` player in that community.

## IISc owner/admin setup

The default IISc community is seeded without a player owner because the app owner chooses the private PIN during setup.

After you join `IISc Carrom Club` in the app and create your player, promote that player in Supabase:

```sql
update public.players
set role = 'owner'
where community_id = (select id from public.communities where slug = 'iisc-carrom-club')
  and lower(name) = lower('Your Player Name');
```

Then sign out and sign back in so the app refreshes your role.

Community owners/admins can unlock Admin mode by re-entering their player PIN. Admin mode is scoped to the active community.

Inside a match, Admin mode includes:

- rollback last completed set
- force-end the current set
- re-open a completed match
- edit total sets and sets needed to win
- edit points per set, boards per set, and queen cutoff
- correct the current set number and board number

## Security notes

- Community PINs use `striker_community_pin_v1|slug|pin`.
- Player PINs use `striker_player_pin_v2|community_id|lower(name)|pin`.
- App-admin hash utilities use a separate `striker_app_admin_pin_v1` context, but global app admin is not enabled by default.
- The app uses Supabase Anonymous Auth so RLS can associate a browser session with a joined community.
- The browser never selects `pin_hash` columns directly. Community join and player sign-in happen through RPCs.
- Direct `matches` reads/writes are RLS-scoped by community membership. Match updates are limited to the owner player or community owners/admins.

## Running the app

This is a pure static app. Host the folder on any static-file server or run a local server from this folder:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

Opening `index.html` directly can work in many browsers, but a local/static server is recommended because service workers and browser crypto APIs are more consistent on `http://localhost` or HTTPS.
