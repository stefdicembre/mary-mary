-- Mary Mary: the online part, for sharing a garden between phones (v1.1).
--
-- How to use: in Supabase, open your project → SQL Editor → New query,
-- paste ALL of this in and press Run. Running it again later is safe.
--
-- What it makes:
--   gardens   one row per shared garden, holding the whole garden as one document
--   members   who's in each garden (each phone signs in quietly, with no email or password)
--   invites   invite codes like ROSE-482193: each works once, for 7 days
--   photos    diary photos, so they show on every phone
-- Row level security means a phone can only ever see gardens it has joined.

create extension if not exists pgcrypto;

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My garden',
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'gardener' check (role in ('owner', 'gardener')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

create table if not exists public.invites (
  code text primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  for_name text,
  made_by uuid,
  made_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create table if not exists public.photos (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  id text not null,
  data text not null,
  primary key (garden_id, id)
);

-- Wrong codes are counted, so nobody can sit guessing them.
create table if not exists public.join_tries (
  user_id uuid not null,
  tried_at timestamptz not null default now()
);

alter table public.gardens enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.photos enable row level security;
alter table public.join_tries enable row level security;

-- ── Who's allowed ───────────────────────────────────────────────

create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where garden_id = g and user_id = auth.uid());
$$;

-- The owner, or (if the owner has left) whoever has been in the garden longest.
create or replace function public.is_owner(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.garden_id = g and m.user_id = auth.uid()
      and (m.role = 'owner'
        or (not exists (select 1 from members o where o.garden_id = g and o.role = 'owner')
          and m.joined_at = (select min(joined_at) from members f where f.garden_id = g)))
  );
$$;

drop policy if exists "members read gardens" on public.gardens;
create policy "members read gardens" on public.gardens for select to authenticated using (public.is_member(id));
drop policy if exists "members change gardens" on public.gardens;
create policy "members change gardens" on public.gardens for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members see each other" on public.members;
create policy "members see each other" on public.members for select to authenticated using (public.is_member(garden_id));
drop policy if exists "change your own name" on public.members;
create policy "change your own name" on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members see invites" on public.invites;
create policy "members see invites" on public.invites for select to authenticated using (public.is_member(garden_id));
drop policy if exists "members cancel invites" on public.invites;
create policy "members cancel invites" on public.invites for delete to authenticated using (public.is_member(garden_id));

drop policy if exists "members see photos" on public.photos;
create policy "members see photos" on public.photos for select to authenticated using (public.is_member(garden_id));
drop policy if exists "members add photos" on public.photos;
create policy "members add photos" on public.photos for insert to authenticated with check (public.is_member(garden_id));

grant select on public.gardens to authenticated;
grant update (name, data, updated_name) on public.gardens to authenticated;
grant select on public.members to authenticated;
grant update (name) on public.members to authenticated;
grant select, delete on public.invites to authenticated;
grant select, insert on public.photos to authenticated;

-- Every change bumps the version by one. Phones send "I'm changing version 12";
-- if someone else got there first, nothing changes and the phone merges and tries again.
create or replace function public.garden_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists garden_changed on public.gardens;
create trigger garden_changed before update on public.gardens for each row execute function public.garden_changed();

-- ── What the app can ask for ────────────────────────────────────

-- Put a garden online. The phone that does it becomes its owner.
create or replace function public.create_garden(p_name text, p_data jsonb, p_your_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into gardens (name, data, updated_by, updated_name) values (coalesce(nullif(trim(p_name), ''), 'My garden'), p_data, auth.uid(), p_your_name)
    returning id into g;
  insert into members (garden_id, user_id, name, role) values (g, auth.uid(), coalesce(nullif(trim(p_your_name), ''), 'Me'), 'owner');
  return g;
end;
$$;

-- Make an invite code. Anyone in the garden can invite.
create or replace function public.make_invite(p_garden uuid, p_for text) returns json
language plpgsql security definer set search_path = public as $$
declare
  words text[] := array['ROSE','TULIP','FERN','IVY','OAK','MINT','SAGE','PEA','BEAN','LILY','IRIS','DAISY','POPPY','HOLLY','THYME','BASIL','PLUM','PEAR','KALE','LEEK'];
  c text;
  inv invites;
begin
  if not public.is_member(p_garden) then raise exception 'not in this garden'; end if;
  delete from invites where expires_at < now();
  loop
    c := words[1 + floor(random() * array_length(words, 1))::int] || '-' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from invites where code = c);
  end loop;
  insert into invites (code, garden_id, for_name, made_by) values (c, p_garden, nullif(trim(p_for), ''), auth.uid()) returning * into inv;
  return json_build_object('code', inv.code, 'expires_at', inv.expires_at);
end;
$$;

-- Join a garden with a code. Each code works once.
create or replace function public.join_garden(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  inv invites;
  gname text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from join_tries where user_id = auth.uid() and tried_at > now() - interval '1 hour') >= 10
     or (select count(*) from join_tries where tried_at > now() - interval '10 minutes') >= 60 then
    return json_build_object('ok', false, 'reason', 'too-many');
  end if;
  select * into inv from invites where code = upper(trim(p_code)) and expires_at > now();
  if not found then
    insert into join_tries (user_id) values (auth.uid());
    delete from join_tries where tried_at < now() - interval '1 day';
    return json_build_object('ok', false, 'reason', 'not-found');
  end if;
  insert into members (garden_id, user_id, name) values (inv.garden_id, auth.uid(), coalesce(nullif(trim(p_name), ''), 'A gardener'))
    on conflict (garden_id, user_id) do update set name = excluded.name;
  delete from invites where code = inv.code;
  select name into gname from gardens where id = inv.garden_id;
  return json_build_object('ok', true, 'garden_id', inv.garden_id, 'name', gname);
end;
$$;

-- Leave a garden. When the last person leaves, the online copy is removed
-- (each phone keeps its own copy).
create or replace function public.leave_garden(p_garden uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from members where garden_id = p_garden and user_id = auth.uid();
  if not exists (select 1 from members where garden_id = p_garden) then
    delete from gardens where id = p_garden;
  end if;
end;
$$;

-- The owner can take someone out of the garden.
create or replace function public.remove_member(p_garden uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_garden) then raise exception 'only the owner can do that'; end if;
  delete from members where garden_id = p_garden and user_id = p_user and user_id <> auth.uid();
end;
$$;

revoke execute on function public.create_garden(text, jsonb, text) from public, anon;
revoke execute on function public.make_invite(uuid, text) from public, anon;
revoke execute on function public.join_garden(text, text) from public, anon;
revoke execute on function public.leave_garden(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.create_garden(text, jsonb, text) to authenticated;
grant execute on function public.make_invite(uuid, text) to authenticated;
grant execute on function public.join_garden(text, text) to authenticated;
grant execute on function public.leave_garden(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
