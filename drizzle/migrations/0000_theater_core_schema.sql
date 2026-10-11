-- ROLES
create type public.app_role as enum ('admin','director');
create type public.account_status as enum ('pending','approved','rejected');
create type public.access_kind as enum ('booth','entry');
create type public.access_status as enum ('pending','approved','revoked');

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  mobile text not null default '',
  email text not null default '',
  username text not null unique,
  status public.account_status not null default 'pending',
  is_active boolean not null default true,
  booth_token text not null default encode(gen_random_bytes(16),'hex'),
  entry_token text not null default encode(gen_random_bytes(16),'hex'),
  max_booth_operators int not null default 3,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- SETTINGS (global, e.g. director link token)
create table public.app_settings (
  key text primary key,
  value text not null
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "admin settings" on public.app_settings for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
insert into public.app_settings(key,value) values ('director_link_token', encode(gen_random_bytes(16),'hex'));

-- HALLS
create table public.halls (
  id uuid primary key default gen_random_uuid(),
  director_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  name text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 300,
  height double precision not null default 200,
  color text not null default 'a',
  is_active boolean not null default true
);
create table public.hall_rows (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  label text not null,
  order_index int not null default 0,
  x double precision not null default 0,
  y double precision not null default 0,
  is_active boolean not null default true
);
create table public.seats (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  row_id uuid not null references public.hall_rows(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  number int not null,
  x double precision not null default 0,
  y double precision not null default 0,
  is_active boolean not null default true
);
create table public.hall_objects (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  kind text not null, -- stage | entrance | exit
  label text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 200,
  height double precision not null default 60,
  is_active boolean not null default true
);

-- SHOWS / SESSIONS
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  director_id uuid not null references public.profiles(id) on delete cascade,
  hall_id uuid not null references public.halls(id),
  title text not null,
  description text not null default '',
  poster_url text,
  start_date date not null,
  end_date date not null,
  price bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.show_sessions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  director_id uuid not null references public.profiles(id) on delete cascade,
  hall_id uuid not null references public.halls(id),
  starts_at timestamptz not null,
  is_active boolean not null default true
);

-- OPERATOR ACCESS (device based, no accounts)
create table public.operator_access (
  id uuid primary key default gen_random_uuid(),
  director_id uuid not null references public.profiles(id) on delete cascade,
  kind public.access_kind not null,
  device_id text not null,
  operator_name text not null,
  status public.access_status not null default 'pending',
  session_token text not null default encode(gen_random_bytes(24),'hex'),
  created_at timestamptz not null default now(),
  unique (director_id, kind, device_id)
);

-- SALES
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  director_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id),
  operator_name text not null default '',
  operator_access_id uuid references public.operator_access(id),
  customer_name text not null default '',
  customer_mobile text not null default '',
  serial bigserial,
  total_amount bigint not null default 0,
  created_at timestamptz not null default now()
);
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  director_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id),
  seat_id uuid not null references public.seats(id),
  serial bigserial,
  code text not null unique default encode(gen_random_bytes(6),'hex'),
  qr_token text not null unique default encode(gen_random_bytes(24),'hex'),
  show_title text not null,
  hall_name text not null,
  section_name text not null default '',
  row_label text not null,
  seat_number int not null,
  starts_at timestamptz not null,
  price bigint not null default 0,
  status text not null default 'sold',
  created_at timestamptz not null default now(),
  unique (session_id, seat_id)
);
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade unique,
  director_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id),
  operator_name text not null default '',
  entered_at timestamptz not null default now()
);

-- grants + RLS for director-owned tables
do $$
declare t text;
begin
  foreach t in array array['halls','sections','hall_rows','seats','hall_objects','shows','show_sessions','operator_access','transactions','tickets','entries']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- owner helper
create or replace function public.owns_hall(_hall uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.halls h where h.id = _hall and h.director_id = auth.uid())
$$;

create policy "halls own" on public.halls for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (director_id = auth.uid());

create policy "sections own" on public.sections for all to authenticated
  using (public.owns_hall(hall_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_hall(hall_id));
create policy "rows own" on public.hall_rows for all to authenticated
  using (public.owns_hall(hall_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_hall(hall_id));
create policy "seats own" on public.seats for all to authenticated
  using (public.owns_hall(hall_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_hall(hall_id));
create policy "objects own" on public.hall_objects for all to authenticated
  using (public.owns_hall(hall_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_hall(hall_id));

create policy "shows own" on public.shows for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());
create policy "sessions own" on public.show_sessions for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());
create policy "access own" on public.operator_access for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());
create policy "tx own" on public.transactions for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());
create policy "tickets own" on public.tickets for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());
create policy "entries own" on public.entries for all to authenticated
  using (director_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (director_id = auth.uid());

create index on public.seats(hall_id);
create index on public.hall_rows(hall_id);
create index on public.tickets(session_id);
create index on public.tickets(director_id);
create index on public.show_sessions(show_id);