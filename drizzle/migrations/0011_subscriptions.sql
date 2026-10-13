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