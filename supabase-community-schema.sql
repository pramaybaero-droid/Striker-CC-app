-- Striker Carrom community schema for Supabase
--
-- Run this file in the Supabase SQL editor before deploying the app.
-- Also enable Authentication > Sign In / Providers > Anonymous in Supabase.
--
-- Default IISc setup after this file is installed:
--   select * from public.setup_default_iisc_community('1234');
-- Replace 1234 with the private 4-digit IISc Carrom Club community PIN.
-- The function stores only a salted SHA-256 hash.

-- pgcrypto provides digest()/gen_random_uuid(). On Supabase it lives in the
-- `extensions` schema by convention, so we install it there and qualify calls.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  pin_hash text not null,
  created_by_player_id uuid null,
  description text null,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  pin_hash text not null,
  role text not null default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.matches (
  id text primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  owner_player_id uuid references public.players(id),
  p1_name text not null,
  p2_name text not null,
  p1_color text,
  p2_color text,
  p1_sets_won int default 0,
  p2_sets_won int default 0,
  winner_name text null,
  phase text,
  data jsonb not null,
  started_at timestamptz null,
  ended_at timestamptz null,
  updated_at timestamptz default now()
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  auth_user_id uuid not null,
  player_id uuid null references public.players(id) on delete set null,
  role text not null default 'member',
  created_at timestamptz default now(),
  unique (community_id, auth_user_id)
);

-- Non-destructive upgrades for older installations.
-- Core columns (in case an older table predates community-scoped schema).
alter table public.communities add column if not exists name text;
alter table public.communities add column if not exists slug text;
alter table public.communities add column if not exists pin_hash text;
alter table public.communities add column if not exists created_by_player_id uuid null;
alter table public.communities add column if not exists description text null;
alter table public.communities add column if not exists is_default boolean default false;
alter table public.communities add column if not exists created_at timestamptz default now();
alter table public.communities add column if not exists updated_at timestamptz default now();
-- Ensure slug uniqueness exists even when the table was created without it.
create unique index if not exists communities_slug_key on public.communities(slug);

alter table public.players add column if not exists name text;
alter table public.players add column if not exists community_id uuid;
alter table public.players add column if not exists pin_hash text;
alter table public.players add column if not exists role text not null default 'member';
alter table public.players add column if not exists created_at timestamptz default now();
alter table public.players add column if not exists updated_at timestamptz default now();

alter table public.matches add column if not exists community_id uuid;
alter table public.matches add column if not exists owner_player_id uuid;
alter table public.matches add column if not exists p1_name text;
alter table public.matches add column if not exists p2_name text;
alter table public.matches add column if not exists p1_color text;
alter table public.matches add column if not exists p2_color text;
alter table public.matches add column if not exists p1_sets_won int default 0;
alter table public.matches add column if not exists p2_sets_won int default 0;
alter table public.matches add column if not exists winner_name text null;
alter table public.matches add column if not exists phase text;
alter table public.matches add column if not exists data jsonb;
alter table public.matches add column if not exists started_at timestamptz null;
alter table public.matches add column if not exists ended_at timestamptz null;
alter table public.matches add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_role_check') then
    alter table public.players add constraint players_role_check check (role in ('owner', 'admin', 'member'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'community_memberships_role_check') then
    alter table public.community_memberships add constraint community_memberships_role_check check (role in ('owner', 'admin', 'member'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_community_id_fkey') then
    alter table public.players add constraint players_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_community_id_fkey') then
    alter table public.matches add constraint matches_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_owner_player_id_fkey') then
    alter table public.matches add constraint matches_owner_player_id_fkey foreign key (owner_player_id) references public.players(id);
  end if;
end $$;

create unique index if not exists communities_slug_key on public.communities (slug);
create unique index if not exists players_community_lower_name_key on public.players (community_id, lower(name));
create index if not exists matches_community_id_idx on public.matches (community_id);
create index if not exists matches_updated_at_idx on public.matches (updated_at);
create index if not exists matches_community_updated_at_idx on public.matches (community_id, updated_at desc);
create index if not exists matches_community_winner_idx on public.matches (community_id, winner_name);
create index if not exists community_memberships_auth_idx on public.community_memberships (auth_user_id);

do $$
begin
  if not exists (select 1 from public.players where community_id is null) then
    alter table public.players alter column community_id set not null;
  else
    raise notice 'players.community_id still has NULL legacy rows. Backfill or delete those rows before enforcing NOT NULL.';
  end if;

  if not exists (select 1 from public.matches where community_id is null) then
    alter table public.matches alter column community_id set not null;
  else
    raise notice 'matches.community_id still has NULL legacy rows. Backfill or delete those rows before enforcing NOT NULL.';
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists communities_set_updated_at on public.communities;
create trigger communities_set_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create or replace function public.normalize_community_slug(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.is_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_memberships cm
    where cm.community_id = p_community_id
      and cm.auth_user_id = auth.uid()
  );
$$;

create or replace function public.current_player_id_for_community(p_community_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.player_id
  from public.community_memberships cm
  where cm.community_id = p_community_id
    and cm.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_current_player(p_community_id uuid, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_player_id is not null
     and public.current_player_id_for_community(p_community_id) = p_player_id;
$$;

create or replace function public.is_community_admin(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_memberships cm
    join public.players p on p.id = cm.player_id and p.community_id = cm.community_id
    where cm.community_id = p_community_id
      and cm.auth_user_id = auth.uid()
      and p.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_edit_match(p_community_id uuid, p_owner_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_community_admin(p_community_id)
      or public.is_current_player(p_community_id, p_owner_player_id);
$$;

create or replace function public.create_community_with_owner(
  p_id uuid,
  p_name text,
  p_slug text,
  p_pin_hash text,
  p_description text,
  p_creator_name text,
  p_creator_pin_hash text
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  description text,
  player_id uuid,
  player_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := public.normalize_community_slug(p_slug);
  v_player_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if p_id is null then
    raise exception 'Community id is required.';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Community name is required.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Community slug can use lowercase letters, numbers, and hyphens.';
  end if;
  if p_pin_hash !~ '^[a-f0-9]{64}$' or p_creator_pin_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid PIN hash.';
  end if;
  if length(trim(coalesce(p_creator_name, ''))) = 0 then
    raise exception 'Creator name is required.';
  end if;

  insert into public.communities (id, name, slug, pin_hash, description, is_default)
  values (p_id, trim(p_name), v_slug, p_pin_hash, nullif(trim(coalesce(p_description, '')), ''), false);

  insert into public.players (community_id, name, pin_hash, role)
  values (p_id, trim(p_creator_name), p_creator_pin_hash, 'owner')
  returning id into v_player_id;

  update public.communities
  set created_by_player_id = v_player_id
  where id = p_id;

  insert into public.community_memberships (community_id, auth_user_id, player_id, role)
  values (p_id, auth.uid(), v_player_id, 'owner')
  on conflict on constraint community_memberships_community_id_auth_user_id_key
  do update set player_id = excluded.player_id, role = excluded.role;

  return query
  select c.id, c.name, c.slug, c.description, p.id, p.name, p.role
  from public.communities c
  join public.players p on p.id = v_player_id
  where c.id = p_id;
end;
$$;

create or replace function public.join_community_with_pin(
  p_slug text,
  p_pin_hash text
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities%rowtype;
  v_slug text := public.normalize_community_slug(p_slug);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  select * into v_community
  from public.communities c
  where c.slug = v_slug;

  if not found or v_community.pin_hash <> p_pin_hash then
    raise exception 'Community not found or wrong PIN.';
  end if;

  insert into public.community_memberships (community_id, auth_user_id, role)
  values (v_community.id, auth.uid(), 'member')
  on conflict on constraint community_memberships_community_id_auth_user_id_key do nothing;

  return query
  select c.id, c.name, c.slug, c.description, coalesce(p.role, cm.role, 'member') as role
  from public.communities c
  join public.community_memberships cm
    on cm.community_id = c.id and cm.auth_user_id = auth.uid()
  left join public.players p on p.id = cm.player_id and p.community_id = c.id
  where c.id = v_community.id;
end;
$$;

create or replace function public.sign_in_or_register_player(
  p_community_id uuid,
  p_name text,
  p_pin_hash text
)
returns table (
  id uuid,
  community_id uuid,
  name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_community_member(p_community_id) then
    raise exception 'Join this community before player sign-in.';
  end if;
  if length(v_name) = 0 then
    raise exception 'Enter a name.';
  end if;
  if p_pin_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid PIN hash.';
  end if;

  select * into v_player
  from public.players p
  where p.community_id = p_community_id
    and lower(p.name) = lower(v_name)
  limit 1;

  if found then
    if v_player.pin_hash <> p_pin_hash then
      raise exception 'Wrong PIN for that name.';
    end if;
  else
    insert into public.players (community_id, name, pin_hash, role)
    values (p_community_id, v_name, p_pin_hash, 'member')
    returning * into v_player;
  end if;

  update public.community_memberships
  set player_id = v_player.id,
      role = v_player.role
  where public.community_memberships.community_id = p_community_id
    and public.community_memberships.auth_user_id = auth.uid();

  return query
  select v_player.id, v_player.community_id, v_player.name, v_player.role;
end;
$$;

create or replace function public.verify_player_pin(
  p_community_id uuid,
  p_player_id uuid,
  p_pin_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.is_community_member(p_community_id) then
    return false;
  end if;

  select p.pin_hash into v_hash
  from public.players p
  where p.id = p_player_id
    and p.community_id = p_community_id;

  return v_hash is not null and v_hash = p_pin_hash;
end;
$$;

create or replace function public.setup_default_iisc_community(p_pin text)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_is_default boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if p_pin !~ '^\d{4}$' then
    raise exception 'IISc community PIN must be exactly 4 digits.';
  end if;

  v_hash := encode(extensions.digest('striker_community_pin_v1|iisc-carrom-club|' || p_pin, 'sha256'), 'hex');

  insert into public.communities (name, slug, pin_hash, is_default, description)
  values ('IISc Carrom Club', 'iisc-carrom-club', v_hash, true, 'PIN-protected IISc Carrom Club community.')
  on conflict (slug)
  do update set
    name = excluded.name,
    pin_hash = excluded.pin_hash,
    is_default = true,
    description = excluded.description,
    updated_at = now();

  return query
  select c.id, c.name, c.slug, c.is_default
  from public.communities c
  where c.slug = 'iisc-carrom-club';
end;
$$;

-- Lock tables down. The browser app uses RPCs for communities/players and direct
-- RLS-filtered access only for matches.
alter table public.communities enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.community_memberships enable row level security;

revoke all on public.communities from anon, authenticated;
revoke all on public.players from anon, authenticated;
revoke all on public.community_memberships from anon, authenticated;
revoke all on public.matches from anon;
grant select, insert, update, delete on public.matches to authenticated;

drop policy if exists matches_select_member on public.matches;
create policy matches_select_member
on public.matches
for select
to authenticated
using (public.is_community_member(community_id));

drop policy if exists matches_insert_owner on public.matches;
create policy matches_insert_owner
on public.matches
for insert
to authenticated
with check (
  public.is_community_member(community_id)
  and (
    public.is_current_player(community_id, owner_player_id)
    or public.is_community_admin(community_id)
  )
);

drop policy if exists matches_update_owner_or_admin on public.matches;
create policy matches_update_owner_or_admin
on public.matches
for update
to authenticated
using (public.can_edit_match(community_id, owner_player_id))
with check (public.can_edit_match(community_id, owner_player_id));

drop policy if exists matches_delete_admin on public.matches;
create policy matches_delete_admin
on public.matches
for delete
to authenticated
using (public.is_community_admin(community_id));

revoke all on function public.create_community_with_owner(uuid, text, text, text, text, text, text) from public;
revoke all on function public.join_community_with_pin(text, text) from public;
revoke all on function public.sign_in_or_register_player(uuid, text, text) from public;
revoke all on function public.verify_player_pin(uuid, uuid, text) from public;
grant execute on function public.create_community_with_owner(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.join_community_with_pin(text, text) to authenticated;
grant execute on function public.sign_in_or_register_player(uuid, text, text) to authenticated;
grant execute on function public.verify_player_pin(uuid, uuid, text) to authenticated;

revoke all on function public.setup_default_iisc_community(text) from public;

-- =================================================================
-- Bootstrap RPC: lets the FIRST player in a community claim ownership
-- by supplying the community PIN + their player name.
-- Once a community has any owner, this RPC refuses further claims --
-- existing owners must promote new admins (via the UI or SQL below).
-- =================================================================
create or replace function public.bootstrap_community_owner(
  p_community_slug text,
  p_community_pin_hash text,
  p_player_name text
)
returns table (
  player_id uuid,
  player_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community public.communities%rowtype;
  v_player public.players%rowtype;
  v_owner_count int;
  v_slug text := public.normalize_community_slug(p_community_slug);
  v_name text := trim(regexp_replace(coalesce(p_player_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_community
  from public.communities c
  where c.slug = v_slug;

  if not found or v_community.pin_hash <> p_community_pin_hash then
    raise exception 'Community not found or wrong PIN.';
  end if;

  select count(*) into v_owner_count
  from public.players p
  where p.community_id = v_community.id and p.role = 'owner';

  if v_owner_count > 0 then
    raise exception 'This community already has an owner. Ask the existing owner to promote you in Supabase SQL.';
  end if;

  select * into v_player
  from public.players p
  where p.community_id = v_community.id
    and lower(p.name) = lower(v_name);

  if not found then
    raise exception 'Player not found. Join the community and sign in once to create your player, then try again.';
  end if;

  update public.players
  set role = 'owner', updated_at = now()
  where id = v_player.id;

  update public.community_memberships
  set role = 'owner'
  where community_id = v_community.id
    and player_id = v_player.id;

  return query
  select v_player.id, v_player.name, 'owner'::text;
end;
$$;

revoke all on function public.bootstrap_community_owner(text, text, text) from public;
grant execute on function public.bootstrap_community_owner(text, text, text) to authenticated;

-- =================================================================
-- Owner-managed promotion RPC: an existing owner promotes another
-- player to 'admin' or 'owner' (or demotes back to 'member').
-- Caller must currently be an owner of the target community.
-- =================================================================
create or replace function public.set_player_role(
  p_community_id uuid,
  p_player_id uuid,
  p_role text
)
returns table (
  player_id uuid,
  player_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_player public.players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'Role must be owner, admin, or member.';
  end if;

  select p.role into v_caller_role
  from public.community_memberships cm
  join public.players p on p.id = cm.player_id
  where cm.community_id = p_community_id
    and cm.auth_user_id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'Only the community owner can change player roles.';
  end if;

  update public.players
  set role = p_role, updated_at = now()
  where id = p_player_id
    and community_id = p_community_id
  returning * into v_player;

  if not found then
    raise exception 'Player not found in this community.';
  end if;

  update public.community_memberships
  set role = v_player.role
  where community_id = p_community_id and player_id = v_player.id;

  return query
  select v_player.id, v_player.name, v_player.role;
end;
$$;

revoke all on function public.set_player_role(uuid, uuid, text) from public;
grant execute on function public.set_player_role(uuid, uuid, text) to authenticated;

-- =================================================================
-- List players RPC: any community member can read the player list
-- (without PIN hashes). Used by the in-app admin promotion UI.
-- =================================================================
create or replace function public.list_community_players(
  p_community_id uuid
)
returns table (
  id uuid,
  name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_community_member(p_community_id) then
    raise exception 'Not a member of this community.';
  end if;
  return query
  select p.id, p.name, p.role, p.created_at
  from public.players p
  where p.community_id = p_community_id
  order by
    case p.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    lower(p.name);
end;
$$;

revoke all on function public.list_community_players(uuid) from public;
grant execute on function public.list_community_players(uuid) to authenticated;

-- =================================================================
-- AUTO-SEED THE DEFAULT IISC COMMUNITY with PIN 1234.
-- Change the PIN below before running, or re-run setup_default_iisc_community()
-- afterwards with your real PIN.
-- =================================================================
select * from public.setup_default_iisc_community('1234');

-- Optional manual promotion (alternative to the in-app Claim Ownership flow):
--   update public.players
--   set role = 'owner'
--   where community_id = (select id from public.communities where slug = 'iisc-carrom-club')
--     and lower(name) = lower('Your Player Name');
-- Then sign out and sign back in to refresh the local role.
