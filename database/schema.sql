-- Combined schema: all migrations in order. Run on an empty PostgreSQL/Supabase database.

-- ===== drizzle/migrations/0000_theater_core_schema.sql =====
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

-- ===== drizzle/migrations/0001_operator_access_enhancements.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_entry_operators integer NOT NULL DEFAULT 3;
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS operator_access_unique_device ON public.operator_access (director_id, kind, device_id);

-- ===== drizzle/migrations/0002_operator_access_device_label.sql =====
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS device_label text NOT NULL DEFAULT '';

-- ===== drizzle/migrations/0003_show_session_ownership.sql =====
CREATE OR REPLACE FUNCTION public.validate_show_hall()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.halls h WHERE h.id = NEW.hall_id AND h.director_id = NEW.director_id) THEN
    RAISE EXCEPTION 'hall does not belong to director';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date before start_date';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shows_validate_hall BEFORE INSERT OR UPDATE ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.validate_show_hall();

CREATE OR REPLACE FUNCTION public.validate_session_show()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT director_id, hall_id INTO s FROM public.shows WHERE id = NEW.show_id;
  IF s IS NULL OR s.director_id <> NEW.director_id THEN
    RAISE EXCEPTION 'show does not belong to director';
  END IF;
  NEW.hall_id := s.hall_id;
  RETURN NEW;
END $$;
CREATE TRIGGER sessions_validate_show BEFORE INSERT OR UPDATE ON public.show_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_session_show();

-- ===== drizzle/migrations/0004_booth_sale.sql =====
ALTER TABLE public.operator_access ADD COLUMN IF NOT EXISTS print_size text NOT NULL DEFAULT 'standard';
CREATE UNIQUE INDEX IF NOT EXISTS tickets_session_seat_unique ON public.tickets (session_id, seat_id) WHERE status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.booth_sell(_director uuid, _session uuid, _access uuid, _operator text, _seats uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; tx uuid; n int; seat record;
BEGIN
  SELECT ss.id, ss.starts_at, ss.hall_id, sh.title, sh.price, h.name AS hall_name
    INTO s FROM show_sessions ss JOIN shows sh ON sh.id = ss.show_id JOIN halls h ON h.id = ss.hall_id
   WHERE ss.id = _session AND ss.director_id = _director AND ss.is_active AND sh.is_active;
  IF s IS NULL THEN RAISE EXCEPTION 'session_unavailable'; END IF;
  SELECT count(*) INTO n FROM seats WHERE id = ANY(_seats) AND hall_id = s.hall_id AND is_active AND number > 0;
  IF n <> array_length(_seats, 1) THEN RAISE EXCEPTION 'seat_invalid'; END IF;
  PERFORM 1 FROM seats WHERE id = ANY(_seats) FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tickets WHERE session_id = _session AND seat_id = ANY(_seats) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'seat_sold';
  END IF;
  INSERT INTO transactions (director_id, session_id, operator_name, operator_access_id, total_amount)
  VALUES (_director, _session, _operator, _access, s.price * n) RETURNING id INTO tx;
  FOR seat IN SELECT se.id, se.number, r.label, coalesce(sc.name, '') AS sname
      FROM seats se JOIN hall_rows r ON r.id = se.row_id LEFT JOIN sections sc ON sc.id = se.section_id
      WHERE se.id = ANY(_seats) LOOP
    INSERT INTO tickets (director_id, transaction_id, session_id, seat_id, show_title, hall_name, section_name, row_label, seat_number, starts_at, price)
    VALUES (_director, tx, _session, seat.id, s.title, s.hall_name, seat.sname, seat.label, seat.number, s.starts_at, s.price);
  END LOOP;
  RETURN tx;
END $$;
REVOKE ALL ON FUNCTION public.booth_sell(uuid, uuid, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booth_sell(uuid, uuid, uuid, text, uuid[]) TO service_role;

-- ===== drizzle/migrations/0005_session_unique.sql =====
CREATE UNIQUE INDEX IF NOT EXISTS show_sessions_show_start_unique ON public.show_sessions (show_id, starts_at);

-- ===== drizzle/migrations/0006_row_price_and_safe_delete.sql =====
ALTER TABLE public.hall_rows ADD COLUMN IF NOT EXISTS price bigint;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_show_hall()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.halls h WHERE h.id = NEW.hall_id AND h.director_id = NEW.director_id
     AND (h.deleted_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.hall_id = OLD.hall_id))) THEN
    RAISE EXCEPTION 'hall does not belong to director';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date before start_date';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.booth_sell(_director uuid, _session uuid, _access uuid, _operator text, _seats uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record; tx uuid; n int; seat record; total bigint;
BEGIN
  SELECT ss.id, ss.starts_at, ss.hall_id, sh.title, sh.price, h.name AS hall_name
    INTO s FROM show_sessions ss JOIN shows sh ON sh.id = ss.show_id JOIN halls h ON h.id = ss.hall_id
   WHERE ss.id = _session AND ss.director_id = _director AND ss.is_active AND sh.is_active AND sh.deleted_at IS NULL;
  IF s IS NULL THEN RAISE EXCEPTION 'session_unavailable'; END IF;
  SELECT count(*) INTO n FROM seats WHERE id = ANY(_seats) AND hall_id = s.hall_id AND is_active AND number > 0;
  IF n <> array_length(_seats, 1) THEN RAISE EXCEPTION 'seat_invalid'; END IF;
  PERFORM 1 FROM seats WHERE id = ANY(_seats) FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tickets WHERE session_id = _session AND seat_id = ANY(_seats) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'seat_sold';
  END IF;
  SELECT coalesce(sum(coalesce(r.price, s.price)), 0) INTO total
    FROM seats se JOIN hall_rows r ON r.id = se.row_id WHERE se.id = ANY(_seats);
  INSERT INTO transactions (director_id, session_id, operator_name, operator_access_id, total_amount)
  VALUES (_director, _session, _operator, _access, total) RETURNING id INTO tx;
  FOR seat IN SELECT se.id, se.number, r.label, coalesce(r.price, s.price) AS p, coalesce(sc.name, '') AS sname
      FROM seats se JOIN hall_rows r ON r.id = se.row_id LEFT JOIN sections sc ON sc.id = se.section_id
      WHERE se.id = ANY(_seats) LOOP
    INSERT INTO tickets (director_id, transaction_id, session_id, seat_id, show_title, hall_name, section_name, row_label, seat_number, starts_at, price)
    VALUES (_director, tx, _session, seat.id, s.title, s.hall_name, seat.sname, seat.label, seat.number, s.starts_at, seat.p);
  END LOOP;
  RETURN tx;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_show(_show uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shows WHERE id = _show AND director_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  DELETE FROM show_sessions ss WHERE ss.show_id = _show
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.session_id = ss.id)
    AND NOT EXISTS (SELECT 1 FROM transactions x WHERE x.session_id = ss.id);
  IF EXISTS (SELECT 1 FROM show_sessions WHERE show_id = _show) THEN
    UPDATE show_sessions SET is_active = false WHERE show_id = _show;
    UPDATE shows SET is_active = false, deleted_at = now() WHERE id = _show;
    RETURN 'archived';
  END IF;
  DELETE FROM shows WHERE id = _show;
  RETURN 'deleted';
END $function$;

CREATE OR REPLACE FUNCTION public.delete_hall(_hall uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sh record; any_archived boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM halls WHERE id = _hall AND director_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  FOR sh IN SELECT id FROM shows WHERE hall_id = _hall LOOP
    IF public.delete_show(sh.id) = 'archived' THEN any_archived := true; END IF;
  END LOOP;
  IF any_archived OR EXISTS (SELECT 1 FROM tickets t JOIN seats se ON se.id = t.seat_id WHERE se.hall_id = _hall) THEN
    UPDATE halls SET is_active = false, deleted_at = now() WHERE id = _hall;
    RETURN 'archived';
  END IF;
  DELETE FROM seats WHERE hall_id = _hall;
  DELETE FROM hall_rows WHERE hall_id = _hall;
  DELETE FROM sections WHERE hall_id = _hall;
  DELETE FROM hall_objects WHERE hall_id = _hall;
  DELETE FROM halls WHERE id = _hall;
  RETURN 'deleted';
END $function$;

REVOKE EXECUTE ON FUNCTION public.delete_show(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_hall(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_show(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_hall(uuid) TO authenticated;

-- ===== drizzle/migrations/0007_noop_check.sql =====
select 1;

-- ===== drizzle/migrations/0008_add_session_switch_minutes.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_switch_minutes integer NOT NULL DEFAULT 60;

-- ===== drizzle/migrations/0009_allow_resell_cancelled_seats.sql =====
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_session_id_seat_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_session_seat_unique ON public.tickets (session_id, seat_id) WHERE status <> 'cancelled';

-- ===== drizzle/migrations/0010_apply_existing_schema.sql =====
SELECT 1;

-- ===== drizzle/migrations/0011_subscriptions.sql =====
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily','monthly')),
  duration integer NOT NULL CHECK (duration > 0),
  price bigint NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read" ON public.subscription_plans FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL REFERENCES public.profiles(id),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  plan_name text NOT NULL,
  kind text NOT NULL,
  duration integer NOT NULL,
  price bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  starts_at timestamptz,
  ends_at timestamptz
);
CREATE UNIQUE INDEX subscription_requests_one_pending ON public.subscription_requests(director_id) WHERE status = 'pending';
CREATE INDEX subscription_requests_active ON public.subscription_requests(director_id, ends_at) WHERE status = 'approved';
GRANT SELECT ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests read" ON public.subscription_requests FOR SELECT TO authenticated
  USING (director_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_active_subscription(_director uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM subscription_requests WHERE director_id = _director
    AND status = 'approved' AND starts_at <= now() AND ends_at > now())
$$;

CREATE OR REPLACE FUNCTION public.request_subscription(_plan uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; rid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'director') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO p FROM subscription_plans WHERE id = _plan AND is_active;
  IF p IS NULL THEN RAISE EXCEPTION 'plan_unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM subscription_requests WHERE director_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'pending_exists';
  END IF;
  INSERT INTO subscription_requests (director_id, plan_id, plan_name, kind, duration, price)
  VALUES (auth.uid(), p.id, p.name, p.kind, p.duration, p.price) RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.decide_subscription(_request uuid, _approve boolean, _reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM subscription_requests WHERE id = _request FOR UPDATE;
  IF r IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF _approve THEN
    -- starts at approval time; if a current subscription is still running, extend after it
    SELECT greatest(now(), coalesce(max(ends_at), now())) INTO st FROM subscription_requests
      WHERE director_id = r.director_id AND status = 'approved' AND ends_at > now();
    UPDATE subscription_requests SET status = 'approved', decided_at = now(), decided_by = auth.uid(),
      starts_at = st,
      ends_at = st + CASE WHEN r.kind = 'daily' THEN make_interval(days => r.duration) ELSE make_interval(months => r.duration) END
      WHERE id = _request;
  ELSE
    UPDATE subscription_requests SET status = 'rejected', decided_at = now(), decided_by = auth.uid(),
      reject_reason = coalesce(_reason, '') WHERE id = _request;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_subscription_plan(_id uuid, _name text, _kind text, _duration int, _price bigint, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO subscription_plans (name, kind, duration, price, is_active) VALUES (_name, _kind, _duration, _price, _active) RETURNING id INTO rid;
  ELSE
    UPDATE subscription_plans SET name = _name, kind = _kind, duration = _duration, price = _price, is_active = _active WHERE id = _id RETURNING id INTO rid;
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.booth_sell(_director uuid, _session uuid, _access uuid, _operator text, _seats uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record; tx uuid; n int; seat record; total bigint;
BEGIN
  IF NOT public.has_active_subscription(_director) THEN RAISE EXCEPTION 'no_subscription'; END IF;
  SELECT ss.id, ss.starts_at, ss.hall_id, sh.title, sh.price, h.name AS hall_name
    INTO s FROM show_sessions ss JOIN shows sh ON sh.id = ss.show_id JOIN halls h ON h.id = ss.hall_id
   WHERE ss.id = _session AND ss.director_id = _director AND ss.is_active AND sh.is_active AND sh.deleted_at IS NULL;
  IF s IS NULL THEN RAISE EXCEPTION 'session_unavailable'; END IF;
  SELECT count(*) INTO n FROM seats WHERE id = ANY(_seats) AND hall_id = s.hall_id AND is_active AND number > 0;
  IF n <> array_length(_seats, 1) THEN RAISE EXCEPTION 'seat_invalid'; END IF;
  PERFORM 1 FROM seats WHERE id = ANY(_seats) FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tickets WHERE session_id = _session AND seat_id = ANY(_seats) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'seat_sold';
  END IF;
  SELECT coalesce(sum(coalesce(r.price, s.price)), 0) INTO total
    FROM seats se JOIN hall_rows r ON r.id = se.row_id WHERE se.id = ANY(_seats);
  INSERT INTO transactions (director_id, session_id, operator_name, operator_access_id, total_amount)
  VALUES (_director, _session, _operator, _access, total) RETURNING id INTO tx;
  FOR seat IN SELECT se.id, se.number, r.label, coalesce(r.price, s.price) AS p, coalesce(sc.name, '') AS sname
      FROM seats se JOIN hall_rows r ON r.id = se.row_id LEFT JOIN sections sc ON sc.id = se.section_id
      WHERE se.id = ANY(_seats) LOOP
    INSERT INTO tickets (director_id, transaction_id, session_id, seat_id, show_title, hall_name, section_name, row_label, seat_number, starts_at, price)
    VALUES (_director, tx, _session, seat.id, s.title, s.hall_name, seat.sname, seat.label, seat.number, s.starts_at, seat.p);
  END LOOP;
  RETURN tx;
END $function$;

-- block direct ticket/transaction inserts without an active subscription (any path)
CREATE OR REPLACE FUNCTION public.enforce_sale_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_active_subscription(NEW.director_id) THEN RAISE EXCEPTION 'no_subscription'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_require_subscription BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_subscription();
CREATE TRIGGER transactions_require_subscription BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_subscription();

INSERT INTO public.subscription_plans (name, kind, duration, price) VALUES
  ('اشتراک روزانه', 'daily', 1, 100000),
  ('اشتراک ماهانه', 'monthly', 1, 10000000);
